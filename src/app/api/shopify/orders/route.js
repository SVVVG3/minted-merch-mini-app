import { createShopifyOrder, getOrderStatus } from '@/lib/shopifyAdmin';
import { createOrder as createSupabaseOrder } from '@/lib/orders';
import { sendOrderConfirmationNotificationAndMark } from '@/lib/orders';
import { markDiscountCodeAsUsed } from '@/lib/discounts';
import { NextResponse } from 'next/server';

// Function to sanitize address fields by removing emojis and non-alphabetic characters
function sanitizeAddressField(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Only keep alphabetic characters, spaces, apostrophes, hyphens, and periods
  // This approach is more reliable than trying to match all emoji ranges
  return text.replace(/[^a-zA-Z\s'\-\.]/g, '').replace(/\s+/g, ' ').trim();
}

// Function to sanitize address object
function sanitizeAddress(address) {
  if (!address) return address;
  
  return {
    ...address,
    firstName: sanitizeAddressField(address.firstName),
    lastName: sanitizeAddressField(address.lastName),
    // Keep other fields as-is since they typically don't contain emojis
    address1: address.address1,
    address2: address.address2,
    city: address.city,
    province: address.province,
    zip: address.zip,
    country: address.country,
    phone: address.phone,
    email: address.email
  };
}

export async function POST(request) {
  const requestId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const body = await request.json();
    
    const {
      cartItems,
      shippingAddress,
      billingAddress,
      customer,
      checkout,
      selectedShipping,
      transactionHash,
      notes,
      fid, // User's Farcaster ID for notifications
      appliedDiscount, // Discount information
      discountAmount, // Discount amount
      giftCards = [] // Gift card information array
    } = body;

    // Convert FID to integer to ensure proper database type matching
    const fidInt = fid ? parseInt(fid, 10) : null;
    
    // Enhanced debug logging
    console.log(`📦 [${requestId}] Order creation request received:`, {
      hasFid: !!fid,
      fid: fid,
      fidType: typeof fid,
      fidValue: fid,
      fidInt: fidInt,
      fidIntType: typeof fidInt,
      fidIsNull: fid === null,
      fidIsUndefined: fid === undefined,
      hasCartItems: !!cartItems,
      cartItemsLength: cartItems?.length,
      hasShippingAddress: !!shippingAddress,
      hasTransactionHash: !!transactionHash,
      transactionHash: transactionHash,
      customerEmail: customer?.email,
      hasDiscount: !!appliedDiscount,
      discountCode: appliedDiscount?.code,
      discountAmount: discountAmount,
      hasGiftCards: !!giftCards,
      giftCardsLength: giftCards?.length,
      giftCardsData: giftCards,
      timestamp: new Date().toISOString(),
      requestId: requestId
    });

    // CRITICAL: Check if FID is missing - warn but allow order creation as fallback
    if (!fidInt) {
      console.warn(`⚠️ [${requestId}] WARNING: Missing or invalid FID in Farcaster mini app - allowing as fallback!`, {
        fidReceived: fid,
        fidType: typeof fid,
        fidInt: fidInt,
        fidIntType: typeof fidInt,
        bodyKeys: Object.keys(body),
        bodyFid: body.fid,
        bodyFidType: typeof body.fid,
        note: 'Order will be created in Shopify but may fail in Supabase - can be manually fixed'
      });
      // Don't return error - allow order creation to proceed
      // This ensures at least Shopify order gets created for payment recovery
    }

    // Log detailed cart items structure
    console.log(`📦 [${requestId}] Cart items detail:`, cartItems?.map(item => ({
      hasVariant: !!item.variant,
      variantId: item.variant?.id,
      hasProduct: !!item.product,
      productTitle: item.product?.title,
      quantity: item.quantity,
      hasPrice: !!(item.price || item.variant?.price?.amount),
      price: item.price || item.variant?.price?.amount
    })));

    // Log shipping and checkout data structure
    console.log(`📦 [${requestId}] Order structure validation:`, {
      shippingAddress: {
        hasFirstName: !!shippingAddress?.firstName,
        hasLastName: !!shippingAddress?.lastName,
        hasAddress1: !!shippingAddress?.address1,
        hasCity: !!shippingAddress?.city,
        hasProvince: !!shippingAddress?.province,
        hasZip: !!shippingAddress?.zip,
        hasCountry: !!shippingAddress?.country,
        hasEmail: !!shippingAddress?.email
      },
      checkout: {
        hasSubtotal: !!checkout?.subtotal,
        subtotalAmount: checkout?.subtotal?.amount,
        hasTax: !!checkout?.tax,
        taxAmount: checkout?.tax?.amount
      },
      selectedShipping: {
        hasTitle: !!selectedShipping?.title,
        hasPrice: !!selectedShipping?.price,
        shippingAmount: selectedShipping?.price?.amount
      },
      customer: {
        hasEmail: !!customer?.email,
        email: customer?.email
      }
    });

    // Validate required fields
    if (!cartItems || cartItems.length === 0) {
      console.error(`❌ [${requestId}] Validation failed: No cart items`);
      return NextResponse.json(
        { 
          error: 'Cart items are required', 
          requestId: requestId,
          step: 'validation'
        },
        { status: 400 }
      );
    }

    if (!shippingAddress) {
      console.error(`❌ [${requestId}] Validation failed: No shipping address`);
      return NextResponse.json(
        { 
          error: 'Shipping address is required', 
          requestId: requestId,
          step: 'validation'
        },
        { status: 400 }
      );
    }

    if (!transactionHash) {
      console.error(`❌ [${requestId}] Validation failed: No transaction hash`);
      return NextResponse.json(
        { 
          error: 'Transaction hash is required', 
          requestId: requestId,
          step: 'validation'
        },
        { status: 400 }
      );
    }

    if (!checkout || !checkout.subtotal || !checkout.tax || !selectedShipping) {
      console.error(`❌ [${requestId}] Validation failed: Incomplete checkout data`, {
        hasCheckout: !!checkout,
        hasSubtotal: !!checkout?.subtotal,
        hasTax: !!checkout?.tax,
        hasSelectedShipping: !!selectedShipping
      });
      return NextResponse.json(
        { 
          error: 'Complete checkout data is required', 
          requestId: requestId,
          step: 'validation'
        },
        { status: 400 }
      );
    }

    // Calculate totals with discount OUTSIDE retry loops - shared by both Shopify and Supabase
    const subtotalPrice = parseFloat(checkout.subtotal.amount);
    const discountAmountValue = discountAmount ? parseFloat(discountAmount) : 0;
    
    // CRITICAL FIX: Ensure subtotal never goes negative
    const subtotalAfterDiscount = Math.max(0, subtotalPrice - discountAmountValue);
    
    // CRITICAL FIX: Calculate proportional tax based on discounted subtotal
    const originalTax = parseFloat(checkout.tax.amount);
    let adjustedTax = 0;
    
    if (subtotalAfterDiscount > 0 && originalTax > 0) {
      // Calculate tax rate from original amounts
      const taxRate = originalTax / subtotalPrice;
      // Apply tax rate to discounted subtotal
      adjustedTax = subtotalAfterDiscount * taxRate;
    }
    
    // Round to 2 decimal places for currency precision
    adjustedTax = Math.round(adjustedTax * 100) / 100;
    
    const shippingPrice = parseFloat(selectedShipping.price.amount);
    const totalPrice = subtotalAfterDiscount + adjustedTax + shippingPrice;
    
    // Apply minimum charge for payment processing (consistent with frontend logic)
    const finalTotalPrice = totalPrice <= 0.01 ? 0.01 : totalPrice;

    console.log(`💰 [${requestId}] Discount calculation (shared):`, {
      originalSubtotal: subtotalPrice,
      discountAmount: discountAmountValue,
      subtotalAfterDiscount: subtotalAfterDiscount,
      originalTax: originalTax,
      taxRate: originalTax > 0 ? ((originalTax / subtotalPrice) * 100).toFixed(4) + '%' : '0%',
      adjustedTax: adjustedTax,
      taxAdjustment: originalTax - adjustedTax,
      shippingPrice: shippingPrice,
      finalTotal: totalPrice,
      finalTotalWithMinCharge: finalTotalPrice,
      isFullDiscount: subtotalAfterDiscount === 0,
      minChargeApplied: totalPrice <= 0.01
    });

    // Format line items for Shopify (shared data)
    const lineItems = cartItems.map(item => ({
      variantId: item.variant.id,
      quantity: item.quantity,
      // Handle both data structures: item.variant.price.amount or item.price
      price: item.variant.price?.amount ? parseFloat(item.variant.price.amount) : parseFloat(item.price),
      // Keep product info for internal use, but don't pass to Shopify API
      productTitle: item.product.title
    }));

    // RETRY LOGIC: Wrap Shopify order creation with retries
    let shopifyOrder = null;
    let shopifyAttempts = 0;
    const maxShopifyRetries = 3;
    
    while (!shopifyOrder && shopifyAttempts < maxShopifyRetries) {
      shopifyAttempts++;
      console.log(`🔄 [${requestId}] Shopify order creation attempt ${shopifyAttempts}/${maxShopifyRetries}`);
      
      try {
        // Format shipping lines
        const shippingLines = {
          title: selectedShipping.title,
          price: shippingPrice,
          code: selectedShipping.code || selectedShipping.title
        };

        // Sanitize addresses to remove emojis before sending to Shopify
        const sanitizedShippingAddress = sanitizeAddress(shippingAddress);
        const sanitizedBillingAddress = billingAddress ? sanitizeAddress(billingAddress) : null;
        
        console.log(`🧹 [${requestId}] Address sanitization:`, {
          originalShipping: { firstName: shippingAddress.firstName, lastName: shippingAddress.lastName },
          sanitizedShipping: { firstName: sanitizedShippingAddress.firstName, lastName: sanitizedShippingAddress.lastName },
          originalBilling: billingAddress ? { firstName: billingAddress.firstName, lastName: billingAddress.lastName } : null,
          sanitizedBilling: sanitizedBillingAddress ? { firstName: sanitizedBillingAddress.firstName, lastName: sanitizedBillingAddress.lastName } : null
        });

        // Prepare order data for Shopify Admin API
        const orderData = {
          lineItems,
          shippingAddress: {
            firstName: sanitizedShippingAddress.firstName,
            lastName: sanitizedShippingAddress.lastName,
            address1: sanitizedShippingAddress.address1,
            address2: sanitizedShippingAddress.address2 || '',
            city: sanitizedShippingAddress.city,
            province: sanitizedShippingAddress.province, // Use province directly
            zip: sanitizedShippingAddress.zip,
            country: sanitizedShippingAddress.country,
            phone: sanitizedShippingAddress.phone || ''
          },
          billingAddress: sanitizedBillingAddress || null,
          customer: {
            email: customer?.email || shippingAddress.email || '',
            phone: customer?.phone || shippingAddress.phone || ''
          },
          totalPrice: finalTotalPrice,
          subtotalPrice: subtotalAfterDiscount, // Use discounted subtotal
          totalTax: adjustedTax, // Use tax adjusted for discount
          shippingLines,
          transactionHash,
          notes: notes || '',
          userFid: fidInt, // Add FID to include in order notes
          discountCodes: appliedDiscount ? [{
            code: appliedDiscount.code,
            amount: discountAmountValue,
            type: appliedDiscount.discountType
          }] : [],
          giftCards: giftCards || [] // Pass gift card data to Shopify order creation
        };

        console.log(`📦 [${requestId}] Creating Shopify order (attempt ${shopifyAttempts}) with data:`, {
          lineItems: lineItems.length,
          lineItemsDetails: lineItems.map(item => ({
            variantId: item.variantId,
            name: item.productTitle,
            title: item.productTitle,
            price: item.price,
            quantity: item.quantity
          })),
          totalPrice: finalTotalPrice,
          originalTotalPrice: totalPrice,
          subtotalAfterDiscount,
          adjustedTax,
          shippingPrice,
          transactionHash,
          hasDiscountCodes: orderData.discountCodes.length > 0,
          discountCodes: orderData.discountCodes
        });

        // Create order in Shopify with timeout protection
        const shopifyPromise = createShopifyOrder(orderData);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shopify API timeout after 30 seconds')), 30000)
        );
        
        const result = await Promise.race([shopifyPromise, timeoutPromise]);
        
        if (result.success) {
          shopifyOrder = result.order;
          console.log(`✅ [${requestId}] Shopify order created successfully on attempt ${shopifyAttempts}:`, shopifyOrder.name);
          break;
        } else {
          throw new Error(result.error || 'Unknown Shopify error');
        }
        
      } catch (shopifyError) {
        console.error(`❌ [${requestId}] Shopify order creation failed on attempt ${shopifyAttempts}:`, {
          error: shopifyError.message,
          stack: shopifyError.stack,
          attempt: shopifyAttempts,
          maxRetries: maxShopifyRetries
        });
        
        if (shopifyAttempts >= maxShopifyRetries) {
          console.error(`❌ [${requestId}] All Shopify attempts exhausted. Final error:`, shopifyError.message);
          return NextResponse.json(
            { 
              error: 'Shopify order creation failed', 
              details: shopifyError.message,
              requestId: requestId,
              step: 'shopify_creation',
              attempts: shopifyAttempts
            },
            { status: 500 }
          );
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, shopifyAttempts - 1) * 1000; // 1s, 2s, 4s
        console.log(`⏳ [${requestId}] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // RETRY LOGIC: Wrap Supabase order creation with retries
    let supabaseOrder = null;
    let supabaseAttempts = 0;
    const maxSupabaseRetries = 3;
    
    while (!supabaseOrder && supabaseAttempts < maxSupabaseRetries) {
      supabaseAttempts++;
      console.log(`🔄 [${requestId}] Supabase order creation attempt ${supabaseAttempts}/${maxSupabaseRetries}`);
      
      try {
        // Create order in our database (skip if FID is null)
        if (!fidInt) {
          console.warn(`⚠️ [${requestId}] Skipping Supabase order creation due to missing FID - Shopify order ${shopifyOrder.name} created successfully`);
          supabaseOrder = { 
            success: false, 
            error: 'FID missing - Supabase creation skipped',
            order_id: shopifyOrder.name,
            manual_fix_needed: true
          };
          break; // Exit the retry loop
        }
        
        const supabaseOrderData = {
          fid: fidInt,
          orderId: shopifyOrder.name,
          sessionId: null,
          status: 'paid',
          currency: 'USDC',
          amountTotal: finalTotalPrice,
          amountSubtotal: subtotalAfterDiscount, // Use the already calculated discounted subtotal
          amountTax: adjustedTax, // Use the already calculated adjusted tax
          amountShipping: parseFloat(selectedShipping.price.amount),
          discountCode: appliedDiscount?.code || null,
          discountAmount: discountAmount || 0,
          discountPercentage: appliedDiscount?.discountValue || null,
          customerEmail: customer?.email || shippingAddress.email || '',
          customerName: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
          shippingAddress: shippingAddress,
          shippingMethod: selectedShipping.title,
          shippingCost: parseFloat(selectedShipping.price.amount),
          lineItems: cartItems.map(item => {
            // Try to get product image from various sources
            let productImageUrl = null;
            try {
              if (item.product?.image?.url) {
                productImageUrl = item.product.image.url;
              } else if (item.variant?.image?.url) {
                productImageUrl = item.variant.image.url;
              } else if (item.product?.images?.edges?.[0]?.node?.url) {
                productImageUrl = item.product.images.edges[0].node.url;
              }
            } catch (imageError) {
              console.warn(`⚠️ [${requestId}] Could not extract image URL:`, imageError);
            }

            return {
              id: item.variant.id,
              title: item.product.title, // FIXED: Use item.product.title not item.productTitle
              quantity: item.quantity,
              price: item.variant.price?.amount ? parseFloat(item.variant.price.amount) : parseFloat(item.price),
              variant: item.variant?.title !== 'Default Title' ? item.variant?.title : null, // FIXED: Use variant title
              imageUrl: productImageUrl // Store the product image URL!
            };
          }),
          paymentMethod: 'USDC',
          paymentStatus: 'completed',
          paymentIntentId: transactionHash,
          giftCards: giftCards || [] // Include gift card data for database tracking
        };

        console.log(`💾 [${requestId}] Creating Supabase order (attempt ${supabaseAttempts}):`, {
          orderId: supabaseOrderData.orderId,
          fid: supabaseOrderData.fid,
          customerEmail: supabaseOrderData.customerEmail,
          amountTotal: supabaseOrderData.amountTotal,
          hasDiscount: !!supabaseOrderData.discountCode,
          discountCode: supabaseOrderData.discountCode,
          hasGiftCards: !!supabaseOrderData.giftCards,
          giftCardsCount: supabaseOrderData.giftCards?.length,
          giftCardsDetails: supabaseOrderData.giftCards
        });

        // 🔒 SECURITY: Using supabaseAdmin client for order creation (admin access)

        // Create Supabase order with timeout protection
        const supabasePromise = createSupabaseOrder(supabaseOrderData);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Supabase timeout after 15 seconds')), 15000)
        );
        
        const supabaseResult = await Promise.race([supabasePromise, timeoutPromise]);
        
        if (supabaseResult.success) {
          supabaseOrder = supabaseResult;
          console.log(`✅ [${requestId}] Supabase order created successfully on attempt ${supabaseAttempts}`);
          break;
        } else {
          throw new Error(supabaseResult.error || 'Unknown Supabase error');
        }
        
      } catch (supabaseError) {
        console.error(`❌ [${requestId}] Supabase order creation failed on attempt ${supabaseAttempts}:`, {
          error: supabaseError.message,
          stack: supabaseError.stack,
          attempt: supabaseAttempts,
          maxRetries: maxSupabaseRetries
        });
        
        if (supabaseAttempts >= maxSupabaseRetries) {
          console.error(`❌ [${requestId}] All Supabase attempts exhausted. Continuing without database order.`);
          // Don't fail the entire request - Shopify order succeeded
          break;
        }
        
        // Wait before retry
        const delay = Math.pow(2, supabaseAttempts - 1) * 1000;
        console.log(`⏳ [${requestId}] Waiting ${delay}ms before Supabase retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Mark discount code as used if one was applied (track usage whenever Shopify order succeeds)
    if (shopifyOrder && appliedDiscount && appliedDiscount.code) {
      try {
        const orderIdForTracking = supabaseOrder?.order?.order_id || shopifyOrder.name;
        const markUsedResult = await markDiscountCodeAsUsed(
          appliedDiscount.code, 
          orderIdForTracking,
          fidInt,
          discountAmount || 0,
          subtotalPrice // Use original subtotal for discount calculation
        );
        if (markUsedResult.success) {
          console.log('✅ Discount code marked as used:', appliedDiscount.code);
        } else {
          console.error('❌ Failed to mark discount code as used:', markUsedResult.error);
        }
      } catch (discountError) {
        console.error('❌ Error marking discount code as used:', discountError);
      }
    }

    if (shopifyOrder && (supabaseOrder || supabaseOrder?.manual_fix_needed)) {
      console.log(`✅ [${requestId}] Order created in Shopify${supabaseOrder?.manual_fix_needed ? ' (Supabase skipped - manual fix needed)' : ' and Supabase'}`);
      
      
      // Send order confirmation notification (only if FID provided and Supabase order created)
      if (fidInt && supabaseOrder?.success !== false) {
        try {
          await sendOrderConfirmationNotificationAndMark(supabaseOrder.order);
          console.log('✅ Order confirmation notification sent');
        } catch (notificationError) {
          console.error('❌ Failed to send order confirmation notification:', notificationError);
        }
      } else if (!fidInt) {
        console.log('ℹ️ No FID provided, skipping notification');
      } else if (supabaseOrder?.manual_fix_needed) {
        console.log('ℹ️ Supabase order creation skipped, notification will be handled after manual fix');
      }
      
      return NextResponse.json({
        success: true,
        order: shopifyOrder,
        message: supabaseOrder?.manual_fix_needed 
          ? 'Order created in Shopify - Supabase entry needs manual fix due to missing FID'
          : 'Order created successfully',
        requestId: requestId,
        ...(supabaseOrder?.manual_fix_needed && {
          warning: 'Missing FID - Supabase order creation skipped',
          manual_fix_needed: true,
          shopify_order: shopifyOrder.name,
          transaction_hash: transactionHash
        })
      });
    } else if (shopifyOrder) {
      console.error(`❌ [${requestId}] Supabase order creation failed:`, {
        error: 'Supabase order creation failed',
        requestId: requestId,
        step: 'supabase_creation'
      });
      
      return NextResponse.json({
        error: 'Failed to create order in Supabase',
        requestId: requestId,
        step: 'supabase_creation'
      }, { status: 500 });
    } else {
      console.error(`❌ [${requestId}] Shopify order creation failed:`, {
        error: 'Shopify order creation failed',
        requestId: requestId,
        step: 'shopify_creation'
      });
      
      return NextResponse.json({
        error: 'Failed to create order in Shopify',
        requestId: requestId,
        step: 'shopify_creation'
      }, { status: 500 });
    }

  } catch (error) {
    const requestId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.error(`❌ [${requestId}] Order creation API top-level error:`, {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      requestBody: {
        hasCartItems: !!body?.cartItems,
        cartItemsLength: body?.cartItems?.length,
        hasShippingAddress: !!body?.shippingAddress,
        hasTransactionHash: !!body?.transactionHash,
        customerEmail: body?.customer?.email
      }
    });
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message,
      requestId: requestId,
      timestamp: new Date().toISOString(),
      step: 'top_level_error'
    }, { status: 500 });
  }
}

// GET endpoint to retrieve order status
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const order = await getOrderStatus(orderId);

    return NextResponse.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Order status API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch order status',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 