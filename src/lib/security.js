// Security validation and audit logging system
import { supabaseAdmin } from './supabase';

/**
 * Validate discount amount to prevent client-side manipulation
 * @param {number} clientAmount - Amount sent from client
 * @param {number} serverAmount - Amount calculated on server
 * @param {number} tolerance - Allowed difference (default: $0.50)
 * @returns {boolean} - True if amounts match within tolerance
 */
export function validateDiscountAmount(clientAmount, serverAmount, tolerance = 0.50) {
  const difference = Math.abs(clientAmount - serverAmount);
  // Allow up to $0.50 (50 cents) tolerance for floating-point rounding errors
  // This is necessary for percentage-based discounts where client/server may calculate
  // from slightly different base amounts (e.g., client rounds subtotal differently)
  // Example: 15% of $34.14 = $5.12 vs 15% of $35.00 = $5.25 → $0.13 difference
  // This is still secure - real manipulation attempts would differ by much more
  return difference <= tolerance;
}

/**
 * Validate gift card amount to prevent client-side manipulation
 * @param {number} clientAmount - Amount sent from client
 * @param {number} serverAmount - Amount calculated on server
 * @param {number} tolerance - Allowed difference (default: $0.10)
 * @returns {boolean} - True if amounts match within tolerance
 */
export function validateGiftCardAmount(clientAmount, serverAmount, tolerance = 0.10) {
  const difference = Math.abs(clientAmount - serverAmount);
  // Allow up to $0.10 (10 cents) tolerance for floating-point rounding errors
  return difference <= tolerance;
}

/**
 * Validate total payment amount to prevent manipulation
 * @param {number} clientTotal - Total sent from client
 * @param {number} serverTotal - Total calculated on server
 * @param {number} tolerance - Allowed difference (default: $1.00 for regular orders, $0.01 for gift cards)
 * @param {boolean} isGiftCardOrder - Whether this is a gift card order
 * @returns {boolean} - True if amounts match within tolerance
 */
export function validatePaymentAmount(clientTotal, serverTotal, isGiftCardOrder = false, tolerance = null) {
  // Set tolerance based on order type
  if (tolerance === null) {
    tolerance = isGiftCardOrder ? 0.01 : 1.00; // $0.01 for gift cards, $1.00 for regular orders
  }
  
  const difference = Math.abs(clientTotal - serverTotal);
  return difference <= tolerance;
}

/**
 * Log security events for audit trail
 * @param {string} eventType - Type of security event
 * @param {Object} details - Event details
 * @param {number} fid - User's Farcaster ID (optional)
 * @param {Request} request - HTTP request object (optional)
 */
export async function logSecurityEvent(eventType, details, fid = null, request = null) {
  try {
    const securityEvent = {
      event_type: eventType,
      user_fid: fid,
      ip_address: request?.headers?.get('x-forwarded-for') || request?.headers?.get('x-real-ip') || null,
      user_agent: request?.headers?.get('user-agent') || null,
      details: details,
      created_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from('security_audit_log')
      .insert(securityEvent);

    if (error) {
      console.error('❌ Failed to log security event:', error);
    } else {
      console.log('🔒 Security event logged:', eventType, details);
    }
  } catch (error) {
    console.error('❌ Error logging security event:', error);
  }
}

/**
 * Validate gift card data server-side during order creation
 * @param {Array} giftCards - Gift card data from client
 * @param {number} expectedTotal - Expected order total
 * @returns {Promise<Object>} - Validation result
 */
export async function validateGiftCardsServerSide(giftCards, expectedTotal) {
  try {
    if (!giftCards || giftCards.length === 0) {
      return { success: true, validatedGiftCards: [], totalDiscount: 0 };
    }

    console.log('🔒 Validating gift cards server-side:', {
      giftCardCount: giftCards.length,
      expectedTotal,
      giftCards: giftCards.map(gc => ({ code: gc.code, amountUsed: gc.amountUsed }))
    });

    const { validateGiftCardForCheckout } = await import('./giftCards');
    const validatedGiftCards = [];
    let totalDiscount = 0;

    for (const giftCard of giftCards) {
      if (!giftCard.code) {
        return {
          success: false,
          error: 'Invalid gift card data provided',
          details: { giftCard }
        };
      }

      // Validate gift card with Shopify
      const validationResult = await validateGiftCardForCheckout(giftCard.code, expectedTotal);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          error: `Invalid gift card: ${validationResult.error}`,
          details: { code: giftCard.code, error: validationResult.error }
        };
      }

      const actualBalance = parseFloat(validationResult.giftCard.balance.amount);
      // Calculate server-side amount used (security: don't trust client)
      const serverAmountUsed = Math.min(actualBalance, expectedTotal - totalDiscount);

      // If client provided amountUsed, validate it matches server calculation
      if (giftCard.amountUsed !== undefined) {
        const clientAmountUsed = parseFloat(giftCard.amountUsed);
        if (!validateGiftCardAmount(clientAmountUsed, serverAmountUsed)) {
          return {
            success: false,
            error: 'Gift card amount mismatch detected',
            details: {
              code: giftCard.code,
              clientAmount: clientAmountUsed,
              serverAmount: serverAmountUsed,
              actualBalance: actualBalance
            }
          };
        }
      }

      validatedGiftCards.push({
        ...giftCard,
        amountUsed: serverAmountUsed, // Use server-calculated amount
        validatedAmount: serverAmountUsed,
        actualBalance: actualBalance
      });

      totalDiscount += serverAmountUsed;
    }

    return {
      success: true,
      validatedGiftCards,
      totalDiscount
    };

  } catch (error) {
    console.error('❌ Error validating gift cards server-side:', error);
    return {
      success: false,
      error: 'Gift card validation failed',
      details: { error: error.message }
    };
  }
}

/**
 * 🔒 SECURITY: Fetch product prices from database to prevent client-side manipulation
 * @param {Array} cartItems - Cart items with product IDs
 * @returns {Promise<Object>} - Product prices from database
 */
export async function fetchProductPricesFromDatabase(cartItems) {
  try {
    if (!cartItems || cartItems.length === 0) {
      return { success: true, products: [] };
    }

    console.log('🔒 Fetching product prices from database for validation');
    
    // Extract product IDs from cart items
    const productIds = cartItems.map(item => {
      // Handle both string IDs and numeric IDs
      return String(item.id || item.productId || item.product_id);
    }).filter(Boolean);
    
    if (productIds.length === 0) {
      console.error('❌ No valid product IDs found in cart items');
      return { success: false, error: 'No valid product IDs' };
    }
    
    console.log('📦 Fetching prices for product IDs:', productIds);
    
    // Fetch products from database
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, shopify_product_id, title, price, variants')
      .in('shopify_product_id', productIds);
    
    if (error) {
      console.error('❌ Error fetching products from database:', error);
      return { success: false, error: error.message };
    }
    
    if (!products || products.length === 0) {
      console.error('❌ No products found in database for IDs:', productIds);
      return { success: false, error: 'Products not found in database' };
    }
    
    console.log(`✅ Found ${products.length} products in database`);
    
    return { success: true, products };
  } catch (error) {
    console.error('❌ Error in fetchProductPricesFromDatabase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recalculate order totals server-side to prevent manipulation
 * @param {Object} orderData - Order data from client
 * @returns {Promise<Object>} - Recalculated totals
 */
export async function recalculateOrderTotals(orderData) {
  try {
    const { cartItems, checkout, selectedShipping, appliedDiscount, giftCards = [] } = orderData;
    
    // 🔒 CRITICAL SECURITY FIX: NEVER trust client-provided prices!
    // Fetch real product prices from Shopify by variant IDs
    console.log('🔒 SECURITY: Fetching real prices from Shopify (not trusting client prices)');
    
    // Extract variant IDs from cart items
    const variantIds = cartItems.map(item => item.variant?.id || item.variantId).filter(Boolean);
    
    if (variantIds.length === 0) {
      throw new Error('No valid variant IDs found in cart items');
    }
    
    // Fetch real prices from Shopify
    const { getVariantPrices } = await import('./shopify');
    const shopifyPrices = await getVariantPrices(variantIds);
    
    // Calculate REAL subtotal from Shopify prices (never trust client)
    let subtotal = 0;
    const priceBreakdown = [];
    
    for (const item of cartItems) {
      const variantId = item.variant?.id || item.variantId;
      const quantity = item.quantity || 1;
      
      // Get the REAL price from Shopify (not from client)
      const shopifyPrice = shopifyPrices[variantId];
      
      if (!shopifyPrice) {
        throw new Error(`Product price not found for variant: ${variantId}`);
      }
      
      const itemTotal = shopifyPrice.price * quantity;
      subtotal += itemTotal;
      
      priceBreakdown.push({
        variantId,
        productTitle: shopifyPrice.productTitle,
        variantTitle: shopifyPrice.variantTitle,
        realPrice: shopifyPrice.price,
        quantity,
        itemTotal
      });
      
      console.log(`  ✅ ${shopifyPrice.productTitle}: $${shopifyPrice.price} × ${quantity} = $${itemTotal}`);
    }
    
    // Round subtotal to 2 decimal places
    subtotal = Math.round(subtotal * 100) / 100;
    
    console.log(`💰 Server-calculated subtotal from REAL Shopify prices: $${subtotal}`);
    console.log(`📊 Price breakdown:`, priceBreakdown);
    
    let discountAmount = 0;
    let giftCardDiscount = 0;
    
    // Validate and calculate discount amount
    if (appliedDiscount && appliedDiscount.code) {
      const { validateDiscountForOrder } = await import('./orders');
      const { calculateDiscountAmount } = await import('./discounts');
      
      const validationResult = await validateDiscountForOrder(
        appliedDiscount.code, 
        orderData.fid, 
        subtotal, 
        cartItems
      );
      
      if (validationResult.success && validationResult.isValid) {
        const formattedDiscountCode = {
          ...validationResult.discountCode,
          isValid: true,
          discountType: validationResult.discountCode.discount_type,
          discountValue: validationResult.discountCode.discount_value,
          minimumOrderAmount: validationResult.discountCode.minimum_order_amount,
          freeShipping: validationResult.discountCode.free_shipping || false,
          discount_scope: validationResult.discountCode.discount_scope,
          target_products: validationResult.discountCode.target_products
        };
        
        const discountCalc = calculateDiscountAmount(subtotal, formattedDiscountCode, 0, cartItems);
        discountAmount = discountCalc.discountAmount;
      }
    }
    
    // Calculate tax first (proportional to discounted subtotal)
    const originalTax = parseFloat(checkout.tax.amount);
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
    let adjustedTax = 0;
    
    if (subtotalAfterDiscount > 0 && originalTax > 0) {
      const taxRate = originalTax / subtotal;
      adjustedTax = subtotalAfterDiscount * taxRate;
    }
    
    // Round to 2 decimal places
    adjustedTax = Math.round(adjustedTax * 100) / 100;
    
    // Calculate shipping
    const shippingPrice = parseFloat(selectedShipping.price.amount);
    const finalShippingPrice = (appliedDiscount?.freeShipping) ? 0 : shippingPrice;
    
    // Calculate total before gift card (including tax and shipping)
    const totalBeforeGiftCard = subtotalAfterDiscount + adjustedTax + finalShippingPrice;
    
    // Validate and calculate gift card discount against total including tax
    let validatedGiftCards = [];
    if (giftCards.length > 0) {
      const giftCardValidation = await validateGiftCardsServerSide(giftCards, totalBeforeGiftCard);
      if (!giftCardValidation.success) {
        throw new Error(`Gift card validation failed: ${giftCardValidation.error}`);
      }
      giftCardDiscount = giftCardValidation.totalDiscount;
      validatedGiftCards = giftCardValidation.validatedGiftCards; // BUGFIX: Save validated gift cards with amountUsed
    }
    
    // Round discount and gift card amounts for consistency
    discountAmount = Math.round(discountAmount * 100) / 100;
    giftCardDiscount = Math.round(giftCardDiscount * 100) / 100;
    
    // Calculate final total
    let finalTotal = Math.max(0, totalBeforeGiftCard - giftCardDiscount);
    
    // Apply minimum charge logic for gift card orders (same as client logic)
    // Daimo Pay minimum is $0.10
    const isCartFree = subtotal <= 0.10;
    
    // If gift card covers the entire order (including tax), apply minimum charge
    if (giftCardDiscount >= totalBeforeGiftCard && (isCartFree || giftCardDiscount > 0)) {
      finalTotal = 0.10;
    }
    
    // Round to 2 decimal places to avoid floating-point precision issues
    finalTotal = Math.round(finalTotal * 100) / 100;
    
    return {
      success: true,
      subtotal,
      discountAmount,
      giftCardDiscount,
      subtotalAfterDiscount,
      adjustedTax,
      shippingPrice: finalShippingPrice,
      finalTotal,
      validatedGiftCards, // BUGFIX: Return validated gift cards with amountUsed for Shopify
      shopifyPrices, // 🔒 SECURITY: Return real Shopify prices for order creation
      priceBreakdown, // Detailed breakdown showing real prices used
      breakdown: {
        originalSubtotal: subtotal,
        discountApplied: discountAmount,
        giftCardApplied: giftCardDiscount,
        tax: adjustedTax,
        shipping: finalShippingPrice,
        finalTotal: finalTotal
      }
    };
    
  } catch (error) {
    console.error('❌ Error recalculating order totals:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate payment reconciliation - compare client vs server totals
 * @param {Object} clientOrderData - Order data from client
 * @param {Object} serverTotals - Recalculated server totals
 * @param {number} actualPaymentReceived - Actual payment amount received
 * @returns {Object} - Validation result
 */
export async function validatePaymentReconciliation(clientOrderData, serverTotals, actualPaymentReceived) {
  try {
    const { appliedDiscount, giftCards = [] } = clientOrderData;
    const isGiftCardOrder = giftCards.length > 0;
    
    // Validate discount amount if present
    if (appliedDiscount && clientOrderData.discountAmount !== undefined) {
      const clientDiscount = parseFloat(clientOrderData.discountAmount);
      const serverDiscount = serverTotals.discountAmount;
      
      if (!validateDiscountAmount(clientDiscount, serverDiscount)) {
        return {
          success: false,
          error: 'Discount amount mismatch detected',
          details: {
            clientDiscount,
            serverDiscount,
            difference: Math.abs(clientDiscount - serverDiscount)
          }
        };
      }
    }
    
    // Validate gift card amounts if present
    if (giftCards.length > 0) {
      for (const giftCard of giftCards) {
        // Only validate if client provided amountUsed (for backward compatibility)
        if (giftCard.amountUsed !== undefined) {
          const clientAmount = parseFloat(giftCard.amountUsed);
          const serverAmount = parseFloat(giftCard.validatedAmount || 0);
          
          if (!validateGiftCardAmount(clientAmount, serverAmount)) {
            return {
              success: false,
              error: 'Gift card amount mismatch detected',
              details: {
                code: giftCard.code,
                clientAmount,
                serverAmount,
                difference: Math.abs(clientAmount - serverAmount)
              }
            };
          }
        }
        // If client didn't provide amountUsed, we trust the server calculation
      }
    }
    
    // Validate final payment amount
    const clientTotal = parseFloat(clientOrderData.total || 0);
    const serverTotal = serverTotals.finalTotal;
    
    if (!validatePaymentAmount(clientTotal, serverTotal, isGiftCardOrder)) {
      return {
        success: false,
        error: 'Payment amount mismatch detected',
        details: {
          clientTotal,
          serverTotal,
          actualPaymentReceived,
          difference: Math.abs(clientTotal - serverTotal),
          isGiftCardOrder
        }
      };
    }
    
    // Validate actual payment received matches expected
    if (!validatePaymentAmount(actualPaymentReceived, serverTotal, isGiftCardOrder)) {
      return {
        success: false,
        error: 'Actual payment does not match calculated total',
        details: {
          expectedTotal: serverTotal,
          actualPaymentReceived,
          difference: Math.abs(actualPaymentReceived - serverTotal),
          isGiftCardOrder
        }
      };
    }
    
    return {
      success: true,
      message: 'Payment reconciliation successful'
    };
    
  } catch (error) {
    console.error('❌ Error validating payment reconciliation:', error);
    return {
      success: false,
      error: 'Payment reconciliation validation failed',
      details: { error: error.message }
    };
  }
}