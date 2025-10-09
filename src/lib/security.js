// Security validation and audit logging system
import { supabaseAdmin } from './supabase';

/**
 * Validate discount amount to prevent client-side manipulation
 * @param {number} clientAmount - Amount sent from client
 * @param {number} serverAmount - Amount calculated on server
 * @param {number} tolerance - Allowed difference (default: $0.01)
 * @returns {boolean} - True if amounts match within tolerance
 */
export function validateDiscountAmount(clientAmount, serverAmount, tolerance = 0.01) {
  const difference = Math.abs(clientAmount - serverAmount);
  return difference <= tolerance;
}

/**
 * Validate gift card amount to prevent client-side manipulation
 * @param {number} clientAmount - Amount sent from client
 * @param {number} serverAmount - Amount calculated on server
 * @param {number} tolerance - Allowed difference (default: $0.01)
 * @returns {boolean} - True if amounts match within tolerance
 */
export function validateGiftCardAmount(clientAmount, serverAmount, tolerance = 0.01) {
  const difference = Math.abs(clientAmount - serverAmount);
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
      if (!giftCard.code || !giftCard.amountUsed) {
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
      const clientAmountUsed = parseFloat(giftCard.amountUsed);
      const serverAmountUsed = Math.min(actualBalance, expectedTotal - totalDiscount);

      // Validate amount used
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

      validatedGiftCards.push({
        ...giftCard,
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
 * Recalculate order totals server-side to prevent manipulation
 * @param {Object} orderData - Order data from client
 * @returns {Promise<Object>} - Recalculated totals
 */
export async function recalculateOrderTotals(orderData) {
  try {
    const { cartItems, checkout, selectedShipping, appliedDiscount, giftCards = [] } = orderData;
    
    // Start with Shopify checkout subtotal
    const subtotal = parseFloat(checkout.subtotal.amount);
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
          freeShipping: validationResult.discountCode.free_shipping || false
        };
        
        const discountCalc = calculateDiscountAmount(subtotal, formattedDiscountCode);
        discountAmount = discountCalc.discountAmount;
      }
    }
    
    // Validate and calculate gift card discount
    if (giftCards.length > 0) {
      const giftCardValidation = await validateGiftCardsServerSide(giftCards, subtotal - discountAmount);
      if (!giftCardValidation.success) {
        throw new Error(`Gift card validation failed: ${giftCardValidation.error}`);
      }
      giftCardDiscount = giftCardValidation.totalDiscount;
    }
    
    // Calculate tax (proportional to discounted subtotal)
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
    
    // Apply free shipping if discount includes it
    const finalShippingPrice = (appliedDiscount?.freeShipping) ? 0 : shippingPrice;
    
    // Calculate final total
    const totalBeforeGiftCard = subtotalAfterDiscount + adjustedTax + finalShippingPrice;
    const finalTotal = Math.max(0.01, totalBeforeGiftCard - giftCardDiscount); // Minimum $0.01
    
    return {
      success: true,
      subtotal,
      discountAmount,
      giftCardDiscount,
      subtotalAfterDiscount,
      adjustedTax,
      shippingPrice: finalShippingPrice,
      finalTotal,
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