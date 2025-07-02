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
      code: discountCode.code,
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

/**
 * Get all available (unused) discount codes for a user
 */
export async function getUserAvailableDiscounts(fid, includeUsed = false) {
  try {
    console.log('Getting available discount codes for FID:', fid, 'includeUsed:', includeUsed);

    if (!fid || typeof fid !== 'number') {
      return { 
        success: false, 
        error: 'Valid FID is required',
        discountCodes: []
      };
    }

    // Build query conditions
    let query = supabase
      .from('discount_codes')
      .select('*')
      .eq('fid', fid)
      .order('created_at', { ascending: false }); // Most recent first

    // Filter by usage status if specified
    if (!includeUsed) {
      query = query.eq('is_used', false);
    }

    // Add expiration filter (exclude expired codes unless includeUsed is true)
    if (!includeUsed) {
      query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    }

    const { data: discountCodes, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching user discount codes:', fetchError);
      return { 
        success: false, 
        error: fetchError.message,
        discountCodes: []
      };
    }

    // Process and categorize the codes
    const processedCodes = discountCodes.map(code => {
      const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
      const isUsable = !code.is_used && !isExpired;
      
      return {
        ...code,
        isUsable,
        isExpired,
        displayText: formatDiscountDisplayText(code),
        expirationStatus: getExpirationStatus(code)
      };
    });

    // Separate into categories
    const usableCodes = processedCodes.filter(code => code.isUsable);
    const usedCodes = processedCodes.filter(code => code.is_used);
    const expiredCodes = processedCodes.filter(code => code.isExpired && !code.is_used);

    console.log(`✅ Found ${processedCodes.length} total codes for FID ${fid}:`);
    console.log(`- Usable: ${usableCodes.length}`);
    console.log(`- Used: ${usedCodes.length}`);
    console.log(`- Expired: ${expiredCodes.length}`);

    return { 
      success: true,
      discountCodes: processedCodes,
      summary: {
        total: processedCodes.length,
        usable: usableCodes.length,
        used: usedCodes.length,
        expired: expiredCodes.length
      },
      categorized: {
        usable: usableCodes,
        used: usedCodes,
        expired: expiredCodes
      }
    };

  } catch (error) {
    console.error('Error in getUserAvailableDiscounts:', error);
    return { 
      success: false, 
      error: error.message,
      discountCodes: []
    };
  }
}

/**
 * Get the best available discount code for a user
 * Returns the highest value unused, non-expired code
 * @param {number} fid - User's Farcaster ID
 * @param {string} scope - Scope filter: 'site_wide', 'product', 'any' (default: 'site_wide')
 * @param {Array} productIds - Product IDs for product-specific discounts (only used when scope='product')
 */
export async function getBestAvailableDiscount(fid, scope = 'site_wide', productIds = []) {
  try {
    const result = await getUserAvailableDiscounts(fid, false);
    
    if (!result.success || result.categorized.usable.length === 0) {
      return {
        success: false,
        error: 'No usable discount codes available',
        discountCode: null
      };
    }

    // Filter discounts by scope
    let eligibleCodes = result.categorized.usable;
    
    if (scope === 'site_wide') {
      // Only include site-wide discounts or discounts with no scope specified (legacy)
      eligibleCodes = eligibleCodes.filter(code => 
        !code.discount_scope || code.discount_scope === 'site_wide'
      );
      console.log(`🌐 Filtering for site-wide discounts only: ${eligibleCodes.length} eligible`);
    } else if (scope === 'product') {
      // Include site-wide discounts AND product-specific discounts that match the product IDs
      // productIds should now be Supabase product IDs from our products table
      eligibleCodes = eligibleCodes.filter(code => {
        if (!code.discount_scope || code.discount_scope === 'site_wide') {
          return true; // Site-wide discounts apply everywhere
        }
        if (code.discount_scope === 'product') {
          // Check against target_product_ids (Supabase product IDs)
          if (code.target_product_ids && code.target_product_ids.length > 0) {
            const matches = productIds.some(productId => 
              code.target_product_ids.includes(productId)
            );
            console.log(`🎯 Product match for ${code.code}: ${matches} (${JSON.stringify(productIds)} vs ${JSON.stringify(code.target_product_ids)})`);
            return matches;
          }
        }
        return false;
      });
      console.log(`🏷️ Filtering for product-specific discounts: ${eligibleCodes.length} eligible`);
    }
    // scope === 'any' returns all eligible codes without filtering

    if (eligibleCodes.length === 0) {
      return {
        success: false,
        error: `No usable discount codes available for scope: ${scope}`,
        discountCode: null
      };
    }

    // Sort by priority level first, then by discount value
    const sortedCodes = eligibleCodes.sort((a, b) => {
      // Primary sort: Higher priority level first
      const priorityA = a.priority_level || 0;
      const priorityB = b.priority_level || 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority first
      }
      
      // Secondary sort: Higher discount value
      if (a.discount_type === 'percentage' && b.discount_type === 'percentage') {
        return b.discount_value - a.discount_value; // Higher percentage first
      } else if (a.discount_type === 'fixed' && b.discount_type === 'fixed') {
        return b.discount_value - a.discount_value; // Higher amount first
      } else if (a.discount_type === 'percentage') {
        return -1; // Prefer percentage over fixed for simplicity
      } else {
        return 1;
      }
    });

    const bestCode = sortedCodes[0];
    
    console.log(`🎯 Best available discount for FID ${fid} (scope: ${scope}):`, bestCode.code, `(${bestCode.discount_value}% off)`);

    return {
      success: true,
      discountCode: bestCode,
      alternativeCodes: sortedCodes.slice(1) // Other available codes
    };

  } catch (error) {
    console.error('Error in getBestAvailableDiscount:', error);
    return { 
      success: false, 
      error: error.message,
      discountCode: null
    };
  }
}

/**
 * Check if user has any specific type of discount codes
 */
export async function hasDiscountOfType(fid, codeType = 'welcome') {
  try {
    const { data: codes, error } = await supabase
      .from('discount_codes')
      .select('code, is_used, expires_at')
      .eq('fid', fid)
      .eq('code_type', codeType);

    if (error) {
      console.error(`Error checking ${codeType} discount for FID ${fid}:`, error);
      return { success: false, error: error.message };
    }

    const usableCodes = codes.filter(code => {
      const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
      return !code.is_used && !isExpired;
    });

    return { 
      success: true, 
      hasDiscount: usableCodes.length > 0,
      count: usableCodes.length,
      codes: usableCodes
    };

  } catch (error) {
    console.error(`Error in hasDiscountOfType(${codeType}):`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Format discount code for user display
 */
function formatDiscountDisplayText(discountCode) {
  const value = discountCode.discount_value;
  const type = discountCode.discount_type;
  
  if (type === 'percentage') {
    return `${value}% off`;
  } else if (type === 'fixed') {
    return `$${value} off`;
  } else {
    return `${value} discount`;
  }
}

/**
 * Get expiration status for a discount code
 */
function getExpirationStatus(discountCode) {
  if (!discountCode.expires_at) {
    return { status: 'no_expiration', message: 'No expiration' };
  }

  const expirationDate = new Date(discountCode.expires_at);
  const now = new Date();
  const timeDiff = expirationDate - now;

  if (timeDiff <= 0) {
    return { status: 'expired', message: 'Expired' };
  }

  const daysUntilExpiration = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hoursUntilExpiration = Math.floor(timeDiff / (1000 * 60 * 60));

  if (daysUntilExpiration > 7) {
    return { status: 'valid', message: `Expires in ${daysUntilExpiration} days` };
  } else if (daysUntilExpiration > 1) {
    return { status: 'expiring_soon', message: `Expires in ${daysUntilExpiration} days` };
  } else if (hoursUntilExpiration > 1) {
    return { status: 'expiring_today', message: `Expires in ${hoursUntilExpiration} hours` };
  } else {
    return { status: 'expiring_soon', message: 'Expires soon' };
  }
} 