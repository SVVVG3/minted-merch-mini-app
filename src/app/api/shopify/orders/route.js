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

    // Debug logging
    console.log('📦 Order creation request received:', {
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
      timestamp: new Date().toISOString()
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
      price: parseFloat(item.variant.price.amount),
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

    console.log('Creating Shopify order with data:', {
      lineItems: lineItems.length,
      totalPrice,
      transactionHash,
      shippingAddress: {
        city: shippingAddress.city,
        province: shippingAddress.province,
        country: shippingAddress.country,
        address1: shippingAddress.address1
      }
    });

    // Create order in Shopify
    const result = await createShopifyOrder(orderData);

    if (result.success) {
      console.log('Order created successfully:', result.order.name);
      
      // Create order in Supabase database for notifications and tracking
      if (fid) {
        try {
          const supabaseOrderData = {
            fid: fid,
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

          const supabaseResult = await createSupabaseOrder(supabaseOrderData);
          
          if (supabaseResult.success) {
            console.log('✅ Order created in Supabase:', supabaseResult.order.order_id);
            
            // Mark discount code as used if one was applied
            if (appliedDiscount && appliedDiscount.code) {
              try {
                const markUsedResult = await markDiscountCodeAsUsed(
                  appliedDiscount.code, 
                  supabaseResult.order.order_id,
                  fid,
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
            
            // Send order confirmation notification
            try {
              await sendOrderConfirmationNotificationAndMark(supabaseResult.order);
              console.log('✅ Order confirmation notification sent');
            } catch (notificationError) {
              console.error('❌ Failed to send order confirmation notification:', notificationError);
            }
          } else {
            console.error('❌ Failed to create order in Supabase:', supabaseResult.error);
          }
        } catch (error) {
          console.error('❌ Error creating Supabase order:', error);
        }
      } else {
        console.log('⚠️ No FID provided, skipping Supabase order creation and notifications');
      }
      
      return NextResponse.json({
        success: true,
        order: result.order,
        message: 'Order created successfully'
      });
    } else {
      console.error('Order creation failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to create order in Shopify' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Order creation API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
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