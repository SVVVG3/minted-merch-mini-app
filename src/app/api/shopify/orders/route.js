import { createShopifyOrder, getOrderStatus } from '@/lib/shopifyAdmin';
import { createOrder as createSupabaseOrder } from '@/lib/orders';
import { sendOrderConfirmationNotificationAndMark } from '@/lib/orders';
import { markDiscountCodeAsUsed } from '@/lib/discounts';
import { NextResponse } from 'next/server';

export async function POST(request) {
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
      discountAmount // Discount amount
    } = body;

    // Enhanced debug logging
    const requestId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`📦 [${requestId}] Order creation request received:`, {
      hasFid: !!fid,
      fid: fid,
      fidType: typeof fid,
      hasCartItems: !!cartItems,
      cartItemsLength: cartItems?.length,
      hasShippingAddress: !!shippingAddress,
      hasTransactionHash: !!transactionHash,
      transactionHash: transactionHash,
      customerEmail: customer?.email,
      hasDiscount: !!appliedDiscount,
      discountCode: appliedDiscount?.code,
      discountAmount: discountAmount,
      timestamp: new Date().toISOString(),
      requestId: requestId
    });

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
      return NextResponse.json(
        { error: 'Cart items are required' },
        { status: 400 }
      );
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: 'Shipping address is required' },
        { status: 400 }
      );
    }

    if (!transactionHash) {
      return NextResponse.json(
        { error: 'Transaction hash is required' },
        { status: 400 }
      );
    }

    if (!checkout || !checkout.subtotal || !checkout.tax || !selectedShipping) {
      return NextResponse.json(
        { error: 'Complete checkout data is required' },
        { status: 400 }
      );
    }

    // Format line items for Shopify
    const lineItems = cartItems.map(item => ({
      variantId: item.variant.id,
      quantity: item.quantity,
      // Handle both data structures: item.variant.price.amount or item.price
      price: item.variant.price?.amount ? parseFloat(item.variant.price.amount) : parseFloat(item.price),
      // Add required name and title fields
      name: item.product.title,
      title: item.variant?.title || 'Default',
      productTitle: item.product.title
    }));

    // Calculate totals with discount
    const subtotalPrice = parseFloat(checkout.subtotal.amount);
    const discountAmountValue = discountAmount ? parseFloat(discountAmount) : 0;
    const subtotalAfterDiscount = subtotalPrice - discountAmountValue;
    const totalTax = parseFloat(checkout.tax.amount);
    const shippingPrice = parseFloat(selectedShipping.price.amount);
    const totalPrice = subtotalAfterDiscount + totalTax + shippingPrice;

    // Format shipping lines
    const shippingLines = {
      title: selectedShipping.title,
      price: shippingPrice,
      code: selectedShipping.code || selectedShipping.title
    };

    // Prepare order data for Shopify Admin API
    const orderData = {
      lineItems,
      shippingAddress: {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.province, // Map province field to state for Shopify
        zip: shippingAddress.zip,
        country: shippingAddress.country,
        phone: shippingAddress.phone || ''
      },
      billingAddress: billingAddress || null,
      customer: {
        email: customer?.email || shippingAddress.email || '',
        phone: customer?.phone || shippingAddress.phone || ''
      },
      totalPrice,
      subtotalPrice: subtotalAfterDiscount, // Use discounted subtotal
      totalTax,
      shippingLines,
      transactionHash,
      notes: notes || '',
      discountCodes: appliedDiscount ? [{
        code: appliedDiscount.code,
        amount: discountAmountValue,
        type: appliedDiscount.discountType
      }] : []
    };

    console.log(`📦 [${requestId}] Creating Shopify order with data:`, {
      lineItems: lineItems.length,
      lineItemsDetails: lineItems.map(item => ({
        variantId: item.variantId,
        name: item.name,
        title: item.title,
        price: item.price,
        quantity: item.quantity
      })),
      totalPrice,
      subtotalAfterDiscount,
      totalTax,
      shippingPrice,
      transactionHash,
      shippingAddress: {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        city: shippingAddress.city,
        province: shippingAddress.province,
        country: shippingAddress.country,
        address1: shippingAddress.address1
      },
      customer: {
        email: customer?.email || shippingAddress.email || ''
      },
      hasDiscount: !!appliedDiscount,
      discountCodes: orderData.discountCodes
    });

    console.log(`📦 [${requestId}] Attempting Shopify order creation...`);
    
    // Create order in Shopify with enhanced error handling
    let result;
    try {
      result = await createShopifyOrder(orderData);
      console.log(`📦 [${requestId}] Shopify API response:`, {
        success: result.success,
        hasOrder: !!result.order,
        orderName: result.order?.name,
        orderId: result.order?.id,
        hasError: !!result.error
      });
    } catch (shopifyError) {
      console.error(`❌ [${requestId}] Shopify order creation threw exception:`, {
        error: shopifyError.message,
        stack: shopifyError.stack,
        orderData: {
          lineItemsCount: orderData.lineItems?.length,
          totalPrice: orderData.totalPrice,
          hasShippingAddress: !!orderData.shippingAddress,
          hasCustomer: !!orderData.customer
        }
      });
      
      return NextResponse.json({
        error: 'Shopify order creation failed',
        details: shopifyError.message,
        requestId: requestId,
        step: 'shopify_creation'
      }, { status: 500 });
    }

    if (result.success) {
      console.log(`✅ [${requestId}] Shopify order created successfully:`, result.order.name);
      
      // Create order in Supabase database for notifications and tracking
      // CRITICAL FIX: Always create Supabase record, FID is optional
      console.log(`📦 [${requestId}] Starting Supabase order creation...`);
      try {
        const supabaseOrderData = {
          fid: fid || null, // FID can be null
          orderId: result.order.name, // Use Shopify order name as our order ID
          sessionId: null, // No session for direct orders
          status: 'paid', // Payment is verified at this point
          currency: 'USDC',
          amountTotal: totalPrice,
          amountSubtotal: subtotalAfterDiscount, // Use discounted subtotal
          amountTax: totalTax,
          amountShipping: shippingPrice,
          discountCode: appliedDiscount?.code || null, // Track discount code
          discountAmount: discountAmountValue, // Track discount amount
          discountPercentage: appliedDiscount?.discountValue || null, // Track discount percentage
          customerEmail: customer?.email || shippingAddress.email || '',
          customerName: shippingAddress.firstName ? 
            `${shippingAddress.firstName} ${shippingAddress.lastName || ''}`.trim() : 
            (customer?.email || shippingAddress.email || ''),
          shippingAddress: shippingAddress,
          shippingMethod: selectedShipping.title || 'Standard',
          lineItems: lineItems.map(item => {
            // Extract product image URL from the cart item
            const productImageUrl = cartItems.find(cartItem => 
              cartItem.variant?.id === item.variantId
            )?.product?.image?.url || null;
            
            return {
              id: item.variantId,
              title: item.productTitle,
              quantity: item.quantity,
              price: item.price,
              variant: item.title !== 'Default' ? item.title : null,
              imageUrl: productImageUrl // Store the product image URL!
            };
          }),
          paymentMethod: 'USDC',
          paymentStatus: 'completed',
          paymentIntentId: transactionHash
        };

        console.log(`📦 [${requestId}] Supabase order data prepared:`, {
          fid: supabaseOrderData.fid,
          orderId: supabaseOrderData.orderId,
          status: supabaseOrderData.status,
          amountTotal: supabaseOrderData.amountTotal,
          amountSubtotal: supabaseOrderData.amountSubtotal,
          customerEmail: supabaseOrderData.customerEmail,
          hasShippingAddress: !!supabaseOrderData.shippingAddress,
          lineItemsCount: supabaseOrderData.lineItems?.length,
          hasDiscount: !!supabaseOrderData.discountCode
        });

        const supabaseResult = await createSupabaseOrder(supabaseOrderData);
        
        console.log(`📦 [${requestId}] Supabase creation result:`, {
          success: supabaseResult.success,
          hasOrder: !!supabaseResult.order,
          orderId: supabaseResult.order?.order_id,
          error: supabaseResult.error
        });
        
        if (supabaseResult.success) {
          console.log(`✅ [${requestId}] Order created in Supabase:`, supabaseResult.order.order_id);
          
          // Mark discount code as used if one was applied
          if (appliedDiscount && appliedDiscount.code) {
            try {
              const markUsedResult = await markDiscountCodeAsUsed(
                appliedDiscount.code, 
                supabaseResult.order.order_id,
                fid || null, // FID can be null for discount tracking
                discountAmountValue,
                subtotalPrice
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
          
          // Send order confirmation notification (only if FID provided)
          if (fid) {
            try {
              await sendOrderConfirmationNotificationAndMark(supabaseResult.order);
              console.log('✅ Order confirmation notification sent');
            } catch (notificationError) {
              console.error('❌ Failed to send order confirmation notification:', notificationError);
            }
          } else {
            console.log('ℹ️ No FID provided, skipping notification (order still saved to Supabase)');
          }
        } else {
          console.error(`❌ [${requestId}] Failed to create order in Supabase:`, {
            error: supabaseResult.error,
            orderData: {
              orderId: supabaseOrderData.orderId,
              customerEmail: supabaseOrderData.customerEmail,
              amountTotal: supabaseOrderData.amountTotal
            }
          });
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error creating Supabase order:`, {
          error: error.message,
          stack: error.stack,
          orderData: {
            orderId: result.order.name,
            step: 'supabase_creation'
          }
        });
      }
      
      console.log(`✅ [${requestId}] Order creation completed successfully`);
      
      return NextResponse.json({
        success: true,
        order: result.order,
        message: 'Order created successfully',
        requestId: requestId
      });
    } else {
      console.error(`❌ [${requestId}] Shopify order creation failed:`, {
        error: result.error,
        orderData: {
          lineItemsCount: orderData.lineItems?.length,
          totalPrice: orderData.totalPrice,
          transactionHash: orderData.transactionHash
        }
      });
      
      return NextResponse.json({
        error: 'Failed to create order in Shopify',
        details: result.error,
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