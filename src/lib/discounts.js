import { supabase } from './supabase';
import { setUserContext } from './auth';

/**
 * Check if a code looks like a gift card code (vs discount code)
 * Gift card codes typically follow different patterns than discount codes
 */
export function isGiftCardCode(code) {
  if (!code || typeof code !== 'string') return false;
  
  const upperCode = code.toUpperCase();
  
  // Common gift card patterns:
  // - Shopify gift cards are often numeric or alphanumeric without dashes
  // - Usually longer than discount codes
  // - Don't contain patterns like "WELCOME", "BANKR", etc.
  
  // Check if it looks like a discount code first
  const discountPatterns = [
    /^WELCOME\d+-/,           // WELCOME15-XXXXX
    /^BANKR/,                 // BANKRCLUB-MERCH-20
    /^DICKBUTT/,              // DICKBUTT20
    /^SNAPSHOT-/,             // SNAPSHOT-TINY-HYPER-FREE
    /^PROMO-/,                // PROMO-XXXXX
    /^SAVE\d+/,               // SAVE20, SAVE15, etc.
    /^[A-Z]+\d+-[A-Z0-9]+$/,  // General pattern: CODE15-XXXXX
  ];
  
  // If it matches discount patterns, it's likely a discount code
  if (discountPatterns.some(pattern => pattern.test(upperCode))) {
    return false;
  }
  
  // Remove spaces and dashes for gift card pattern matching
  const cleanCode = upperCode.replace(/[\s-]/g, '');
  
  // Gift card patterns:
  // - All numeric (e.g., "1234567890123456")
  // - Mix of letters and numbers without dashes (e.g., "ABCD1234EFGH5678")
  // - Length typically 8-20 characters
  const giftCardPatterns = [
    /^\d{8,20}$/,                    // All numeric, 8-20 digits
    /^[A-Z0-9]{8,20}$/,              // Alphanumeric, 8-20 chars, no dashes
    /^[A-Z]{4}\d{4}[A-Z]{4}\d{4}$/,  // Pattern like ABCD1234EFGH5678
  ];
  
  // Also check for common gift card formats with spaces or dashes
  const giftCardFormats = [
    /^[A-Z0-9]{4}\s[A-Z0-9]{4}\s[A-Z0-9]{4}\s[A-Z0-9]{4}$/,  // XXXX XXXX XXXX XXXX
    /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/,     // XXXX-XXXX-XXXX-XXXX
    /^[A-Z0-9]{3}\s[A-Z0-9]{1}\s[A-Z0-9]{4}\s[A-Z0-9]{4}\s[A-Z0-9]{4}$/,  // XXX X XXXX XXXX XXXX
  ];
  
  // Check both cleaned code and formatted code
  return giftCardPatterns.some(pattern => pattern.test(cleanCode)) || 
         giftCardFormats.some(pattern => pattern.test(upperCode));
}

/**
 * Check if cart contains gift cards
 */
export function cartContainsGiftCards(cartItems) {
  if (!cartItems || !Array.isArray(cartItems)) return false;
  
  return cartItems.some(item => {
    const productTitle = item.product?.title || item.title || '';
    const productHandle = item.product?.handle || '';
    
    // Check if product is a gift card
    return (
      productTitle.toLowerCase().includes('gift card') ||
      productHandle.includes('gift-card') ||
      productTitle.toLowerCase().includes('gift') ||
      productHandle.includes('gift')
    );
  });
}

/**
 * Validate a gift card code with Shopify
 */
export async function validateGiftCardCode(code, customerEmail = null) {
  try {
    console.log('🎁 Validating gift card code with Shopify:', code);
    
    // Clean the code - remove spaces and convert to uppercase
    const cleanCode = code.replace(/\s+/g, '').toUpperCase();
    
    // Use Shopify REST API to validate gift card directly
    const shopDomain = process.env.SHOPIFY_SITE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    
    if (!shopDomain || !accessToken) {
      console.error('Missing Shopify credentials');
      return {
        success: false,
        error: 'Gift card validation unavailable',
        isValid: false
      };
    }
    
    const url = `https://${shopDomain}.myshopify.com/admin/api/2024-10/gift_cards.json?code=${cleanCode}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('Shopify REST API error:', response.status, response.statusText);
      return {
        success: false,
        error: 'Gift card not found or invalid code',
        isValid: false
      };
    }
    
    const data = await response.json();
    
    if (!data.gift_cards || data.gift_cards.length === 0) {
      console.log('Gift card not found in Shopify');
      return {
        success: false,
        error: 'Gift card not found or invalid code',
        isValid: false
      };
    }
    
    const giftCard = data.gift_cards[0];
    
    // Check if gift card is enabled
    if (giftCard.disabled_at !== null) {
      return {
        success: false,
        error: 'Gift card is disabled',
        isValid: false
      };
    }
    
    // Check if gift card has expired
    if (giftCard.expires_on && new Date(giftCard.expires_on) < new Date()) {
      return {
        success: false,
        error: 'Gift card has expired',
        isValid: false
      };
    }
    
    return {
      success: true,
      isValid: true,
      isGiftCard: true,
      balance: parseFloat(giftCard.balance),
      currency: giftCard.currency,
      code: cleanCode,
      message: 'Gift card is valid'
    };
    
  } catch (error) {
    console.error('Error validating gift card:', error);
    return {
      success: false,
      error: 'Failed to validate gift card code',
      isValid: false
    };
  }
}

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
 * Check if a user has already used a specific discount code (for shared codes)
 */
async function hasUserUsedSharedCode(discountCodeId, fid) {
  try {
    const { data, error } = await supabase
      .from('discount_code_usage')
      .select('id')
      .eq('discount_code_id', discountCodeId)
      .eq('fid', fid)
      .limit(1);

    if (error) {
      console.error('Error checking shared code usage:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      hasUsed: data && data.length > 0 
    };
  } catch (error) {
    console.error('Error in hasUserUsedSharedCode:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current usage count for a discount code
 */
async function getDiscountUsageCount(discountCodeId) {
  try {
    const { data, error } = await supabase
      .from('discount_code_usage')
      .select('id')
      .eq('discount_code_id', discountCodeId);

    if (error) {
      console.error('Error getting usage count:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      count: data ? data.length : 0 
    };
  } catch (error) {
    console.error('Error in getDiscountUsageCount:', error);
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

    // Check if this is a gift card code first
    if (isGiftCardCode(code)) {
      console.log('🎁 Code detected as gift card, redirecting to gift card validation');
      return {
        success: false,
        error: 'This appears to be a gift card code, not a discount code',
        isValid: false,
        isGiftCard: true
      };
    }

    // 🔒 Set user context for RLS policies
    if (fid) {
      await setUserContext(fid);
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

    // Check if code has expired
    if (discountCode.expires_at && new Date(discountCode.expires_at) < new Date()) {
      return { 
        success: false, 
        error: 'This discount code has expired',
        isValid: false,
        discountCode: discountCode
      };
    }

    // Handle shared codes vs user-specific codes differently
    if (discountCode.is_shared_code) {
      console.log('🔄 Validating shared discount code:', discountCode.code);
      
      // Check total usage limits for shared codes
      if (discountCode.max_uses_total) {
        const usageResult = await getDiscountUsageCount(discountCode.id);
        if (!usageResult.success) {
          return { success: false, error: 'Failed to check usage limits', isValid: false };
        }
        
        if (usageResult.count >= discountCode.max_uses_total) {
          return { 
            success: false, 
            error: 'This discount code has reached its usage limit',
            isValid: false,
            discountCode: discountCode
          };
        }
      }

      // Check per-user usage for shared codes (if FID provided)
      if (fid) {
        const userUsageResult = await hasUserUsedSharedCode(discountCode.id, fid);
        if (!userUsageResult.success) {
          return { success: false, error: 'Failed to check user usage', isValid: false };
        }
        
        if (userUsageResult.hasUsed) {
          return { 
            success: false, 
            error: 'You have already used this discount code',
            isValid: false,
            discountCode: discountCode
          };
        }
      }
    } else {
      console.log('👤 Validating user-specific discount code:', discountCode.code);
      
      // For user-specific codes, use the original logic
      if (discountCode.is_used) {
        return { 
          success: false, 
          error: 'This discount code has already been used',
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
    }

    console.log('✅ Discount code is valid:', discountCode);
    return { 
      success: true, 
      isValid: true,
      code: discountCode.code,
      discountCode: discountCode,
      discountType: discountCode.discount_type,
      discountValue: discountCode.discount_value,
      minimumOrderAmount: discountCode.minimum_order_amount,
      isSharedCode: discountCode.is_shared_code || false,
      freeShipping: discountCode.free_shipping || false
    };

  } catch (error) {
    console.error('Error in validateDiscountCode:', error);
    return { success: false, error: error.message, isValid: false };
  }
}

/**
 * Calculate discount amount for an order
 */
export function calculateDiscountAmount(subtotal, discountCode, shippingAmount = 0) {
  try {
    if (!discountCode || !discountCode.isValid) {
      return { discountAmount: 0, finalTotal: subtotal, shippingDiscount: 0 };
    }

    const { discountType, discountValue, minimumOrderAmount, freeShipping } = discountCode;

    // Check minimum order amount
    if (minimumOrderAmount && subtotal < minimumOrderAmount) {
      return { 
        discountAmount: 0, 
        finalTotal: subtotal,
        shippingDiscount: 0,
        error: `Minimum order amount of $${minimumOrderAmount} required for this discount`
      };
    }

    let discountAmount = 0;
    let shippingDiscount = 0;

    // Calculate product discount
    if (discountType === 'percentage') {
      discountAmount = (subtotal * discountValue) / 100;
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(discountValue, subtotal); // Don't exceed subtotal
    }

    // Calculate shipping discount
    if (freeShipping && shippingAmount > 0) {
      shippingDiscount = shippingAmount;
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;
    shippingDiscount = Math.round(shippingDiscount * 100) / 100;
    const finalTotal = Math.max(0, subtotal - discountAmount);

    return {
      discountAmount: discountAmount,
      shippingDiscount: shippingDiscount,
      finalTotal: finalTotal,
      discountPercentage: discountType === 'percentage' ? discountValue : null,
      freeShipping: freeShipping || false
    };

  } catch (error) {
    console.error('Error calculating discount amount:', error);
    return { discountAmount: 0, finalTotal: subtotal, shippingDiscount: 0, error: error.message };
  }
}

/**
 * Record discount code usage for shared codes
 */
async function recordSharedCodeUsage(discountCode, fid, orderId, discountAmount, originalSubtotal) {
  try {
    const { data: usageRecord, error: insertError } = await supabase
      .from('discount_code_usage')
      .insert({
        discount_code_id: discountCode.id,
        discount_code_name: discountCode.code,
        fid: fid,
        order_id: orderId,
        discount_amount: discountAmount,
        original_subtotal: originalSubtotal,
        used_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error recording shared code usage:', insertError);
      return { success: false, error: insertError.message };
    }

    console.log('✅ Shared code usage recorded:', usageRecord);
    console.log(`📊 Usage counter will be automatically updated by database trigger`);
    return { success: true, usageRecord };
  } catch (error) {
    console.error('Error in recordSharedCodeUsage:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark a discount code as used
 * Handles both shared codes (via usage tracking) and user-specific codes (via is_used flag)
 */
export async function markDiscountCodeAsUsed(code, orderId, fid = null, discountAmount = 0, originalSubtotal = 0) {
  try {
    console.log('Marking discount code as used:', code, 'for order:', orderId, 'FID:', fid);

    // First, get the discount code to check if it's shared
    const { data: discountCode, error: fetchError } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (fetchError) {
      console.error('Error fetching discount code:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (discountCode.is_shared_code) {
      console.log('🔄 Recording usage for shared code:', code);
      
      if (!fid) {
        return { success: false, error: 'FID is required for shared code usage tracking' };
      }

      // For shared codes, record usage in the tracking table
      const usageResult = await recordSharedCodeUsage(
        discountCode,
        fid, 
        orderId, 
        discountAmount, 
        originalSubtotal
      );

      if (!usageResult.success) {
        return { success: false, error: usageResult.error };
      }

      console.log('✅ Shared discount code usage recorded:', discountCode.code);
      console.log('📊 current_total_uses counter automatically updated by database trigger');
      return { success: true, discountCode, usageRecord: usageResult.usageRecord };

    } else {
      console.log('👤 Marking user-specific code as used:', code);
      
      // For user-specific codes, use the original logic
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

      console.log('✅ User-specific discount code marked as used:', updatedCode);
      return { success: true, discountCode: updatedCode };
    }

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

    // 🔒 Set user context for RLS policies
    await setUserContext(fid);

    // Build query conditions - get user's codes AND global/shared codes
    let query = supabase
      .from('discount_codes')
      .select('*')
      .or(`fid.eq.${fid},fid.is.null,is_shared_code.eq.true`)
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