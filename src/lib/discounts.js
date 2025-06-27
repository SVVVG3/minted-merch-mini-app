import { supabase } from './supabase';

/**
 * Generate a unique discount code for a user
 * Format: WELCOME15-{shortId}
 */
export function generateDiscountCode(fid) {
  // Create a short ID from the FID
  const shortId = fid.toString().padStart(6, '0').slice(-6);
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `WELCOME15-${shortId}${randomSuffix}`;
}

/**
 * Create a welcome discount code for a new user
 */
export async function createWelcomeDiscountCode(fid) {
  try {
    console.log('Creating welcome discount code for FID:', fid);

    // Check if user already has a welcome discount code
    const { data: existingCode, error: checkError } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('fid', fid)
      .eq('code_type', 'welcome')
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing discount code:', checkError);
      return { success: false, error: checkError.message };
    }

    if (existingCode) {
      console.log('User already has a welcome discount code:', existingCode.code);
      return { 
        success: true, 
        code: existingCode.code,
        discountCode: existingCode,
        isExisting: true 
      };
    }

    // Generate unique code
    let code;
    let attempts = 0;
    const maxAttempts = 5;

    do {
      code = generateDiscountCode(fid);
      attempts++;

      // Check if code already exists
      const { data: duplicateCheck } = await supabase
        .from('discount_codes')
        .select('id')
        .eq('code', code)
        .single();

      if (!duplicateCheck) {
        break; // Code is unique
      }

      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique discount code after multiple attempts');
      }
    } while (attempts < maxAttempts);

    // Create the discount code record
    const discountData = {
      fid: fid,
      code: code,
      discount_type: 'percentage',
      discount_value: 15.00,
      code_type: 'welcome',
      is_used: false,
      expires_at: null, // No expiration for welcome codes
      minimum_order_amount: null // No minimum for welcome codes
    };

    const { data: newCode, error: createError } = await supabase
      .from('discount_codes')
      .insert(discountData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating discount code:', createError);
      return { success: false, error: createError.message };
    }

    console.log('✅ Welcome discount code created:', newCode.code);
    return { 
      success: true, 
      code: newCode.code,
      discountCode: newCode,
      isExisting: false 
    };

  } catch (error) {
    console.error('Error in createWelcomeDiscountCode:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate a discount code and return discount information
 */
export async function validateDiscountCode(code, fid = null) {
  try {
    console.log('Validating discount code:', code, 'for FID:', fid);

    if (!code || typeof code !== 'string') {
      return { 
        success: false, 
        error: 'Invalid discount code format',
        isValid: false 
      };
    }

    // Get discount code from database
    const { data: discountCode, error: fetchError } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return { 
          success: false, 
          error: 'Discount code not found',
          isValid: false 
        };
      }
      console.error('Error fetching discount code:', fetchError);
      return { success: false, error: fetchError.message, isValid: false };
    }

    // Check if code has already been used
    if (discountCode.is_used) {
      return { 
        success: false, 
        error: 'This discount code has already been used',
        isValid: false,
        discountCode: discountCode
      };
    }

    // Check if code has expired
    if (discountCode.expires_at && new Date(discountCode.expires_at) < new Date()) {
      return { 
        success: false, 
        error: 'This discount code has expired',
        isValid: false,
        discountCode: discountCode
      };
    }

    // If FID is provided, check if it matches the code owner (for welcome codes)
    if (fid && discountCode.code_type === 'welcome' && discountCode.fid !== fid) {
      return { 
        success: false, 
        error: 'This discount code is not valid for your account',
        isValid: false,
        discountCode: discountCode
      };
    }

    console.log('✅ Discount code is valid:', discountCode);
    return { 
      success: true, 
      isValid: true,
      discountCode: discountCode,
      discountType: discountCode.discount_type,
      discountValue: discountCode.discount_value,
      minimumOrderAmount: discountCode.minimum_order_amount
    };

  } catch (error) {
    console.error('Error in validateDiscountCode:', error);
    return { success: false, error: error.message, isValid: false };
  }
}

/**
 * Calculate discount amount for an order
 */
export function calculateDiscountAmount(subtotal, discountCode) {
  try {
    if (!discountCode || !discountCode.isValid) {
      return { discountAmount: 0, finalTotal: subtotal };
    }

    const { discountType, discountValue, minimumOrderAmount } = discountCode;

    // Check minimum order amount
    if (minimumOrderAmount && subtotal < minimumOrderAmount) {
      return { 
        discountAmount: 0, 
        finalTotal: subtotal,
        error: `Minimum order amount of $${minimumOrderAmount} required for this discount`
      };
    }

    let discountAmount = 0;

    if (discountType === 'percentage') {
      discountAmount = (subtotal * discountValue) / 100;
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(discountValue, subtotal); // Don't exceed subtotal
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalTotal = Math.max(0, subtotal - discountAmount);

    return {
      discountAmount: discountAmount,
      finalTotal: finalTotal,
      discountPercentage: discountType === 'percentage' ? discountValue : null
    };

  } catch (error) {
    console.error('Error calculating discount amount:', error);
    return { discountAmount: 0, finalTotal: subtotal, error: error.message };
  }
}

/**
 * Mark a discount code as used
 */
export async function markDiscountCodeAsUsed(code, orderId) {
  try {
    console.log('Marking discount code as used:', code, 'for order:', orderId);

    const { data: updatedCode, error: updateError } = await supabase
      .from('discount_codes')
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        order_id: orderId
      })
      .eq('code', code.toUpperCase())
      .select()
      .single();

    if (updateError) {
      console.error('Error marking discount code as used:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log('✅ Discount code marked as used:', updatedCode);
    return { success: true, discountCode: updatedCode };

  } catch (error) {
    console.error('Error in markDiscountCodeAsUsed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's discount codes
 */
export async function getUserDiscountCodes(fid, includeUsed = false) {
  try {
    console.log('Getting discount codes for FID:', fid, 'includeUsed:', includeUsed);

    let query = supabase
      .from('discount_codes')
      .select('*')
      .eq('fid', fid)
      .order('created_at', { ascending: false });

    if (!includeUsed) {
      query = query.eq('is_used', false);
    }

    const { data: discountCodes, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching user discount codes:', fetchError);
      return { success: false, error: fetchError.message };
    }

    return { success: true, discountCodes: discountCodes || [] };

  } catch (error) {
    console.error('Error in getUserDiscountCodes:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if user has any unused welcome discount codes
 */
export async function hasUnusedWelcomeDiscount(fid) {
  try {
    const { data: codes, error } = await supabase
      .from('discount_codes')
      .select('code')
      .eq('fid', fid)
      .eq('code_type', 'welcome')
      .eq('is_used', false);

    if (error) {
      console.error('Error checking unused welcome discount:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      hasUnusedWelcome: codes && codes.length > 0,
      count: codes ? codes.length : 0
    };

  } catch (error) {
    console.error('Error in hasUnusedWelcomeDiscount:', error);
    return { success: false, error: error.message };
  }
} 