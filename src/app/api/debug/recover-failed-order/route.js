import { createShopifyOrder } from '@/lib/shopifyAdmin';
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

export async function POST(request) {
  const requestId = `recover-${Date.now()}`;
  
  try {
    console.log(`🔧 [${requestId}] Starting failed order recovery...`);
    
    // Failed order data from the logs - FID 214447
    const failedOrderData = {
      fid: 214447,
      transactionHash: '0x544d526848dac358e6d5a55221beb04888b49f2268aaecf5cb7490f043834620',
      customer: {
        email: 'yes@yes2crypto.com'
      },
      shippingAddress: {
        firstName: 'YES2Crypto',
        lastName: '', // Manually remove emojis - was "🎩 🟪🟡"
        address1: '6001 West Parmer Lane',
        address2: 'STE 370 PMB 1654',
        city: 'Austin',
        province: 'TX',
        zip: '78727',
        country: 'US',
        phone: '',
        email: 'yes@yes2crypto.com'
      },
      cartItems: [
        {
          variant: { id: 'gid://shopify/ProductVariant/50352720118041' },
          product: { title: 'Bankr Cap' },
          quantity: 1,
          price: 29.97
        },
        {
          variant: { id: 'gid://shopify/ProductVariant/50324131053849' },
          product: { title: 'Bankr Hoodie' },
          quantity: 1,
          price: 60.00
        }
      ],
      selectedShipping: {
        title: 'US Flat Rate',
        price: 12.98,
        code: 'US Flat Rate'
      },
      appliedDiscount: {
        code: 'BANKRCLUB-MERCH-20',
        discountType: 'percentage'
      },
      discountAmount: 0, // No discount was actually applied
      checkout: {
        subtotal: { amount: 89.97 },
        tax: { amount: 0 }
      }
    };

    console.log(`🔧 [${requestId}] Recovered order data:`, {
      fid: failedOrderData.fid,
      transactionHash: failedOrderData.transactionHash,
      customerEmail: failedOrderData.customer.email,
      sanitizedLastName: failedOrderData.shippingAddress.lastName,
      originalLastName: '🎩 🟪🟡',
      itemCount: failedOrderData.cartItems.length,
      totalValue: failedOrderData.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) + failedOrderData.selectedShipping.price
    });

    // Calculate totals
    const subtotal = failedOrderData.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingPrice = failedOrderData.selectedShipping.price;
    const tax = 0;
    const totalPrice = subtotal + shippingPrice + tax;

    // Format line items for Shopify
    const lineItems = failedOrderData.cartItems.map(item => ({
      variantId: item.variant.id,
      quantity: item.quantity,
      price: item.price
    }));

    // Create order data for Shopify
    const orderData = {
      lineItems,
      shippingAddress: failedOrderData.shippingAddress,
      billingAddress: failedOrderData.shippingAddress, // Use same as shipping
      customer: failedOrderData.customer,
      totalPrice: totalPrice,
      subtotalPrice: subtotal,
      totalTax: tax,
      shippingLines: {
        title: failedOrderData.selectedShipping.title,
        price: shippingPrice,
        code: failedOrderData.selectedShipping.code
      },
      transactionHash: failedOrderData.transactionHash,
      notes: 'RECOVERED ORDER - Originally failed due to emoji in address',
      userFid: failedOrderData.fid,
      discountCodes: failedOrderData.appliedDiscount ? [{
        code: failedOrderData.appliedDiscount.code,
        amount: failedOrderData.discountAmount,
        type: failedOrderData.appliedDiscount.discountType
      }] : [],
      giftCards: []
    };

    console.log(`🔧 [${requestId}] Creating Shopify order...`);
    
    // Create order in Shopify
    const shopifyResult = await createShopifyOrder(orderData);
    
    if (!shopifyResult.success) {
      throw new Error(`Shopify order creation failed: ${shopifyResult.error}`);
    }

    const shopifyOrder = shopifyResult.order;
    console.log(`✅ [${requestId}] Shopify order created: ${shopifyOrder.name}`);

    // Create order in Supabase
    console.log(`🔧 [${requestId}] Creating Supabase order...`);
    
    const supabaseOrderData = {
      fid: failedOrderData.fid,
      orderId: shopifyOrder.name, // Required by createOrder function
      sessionId: null,
      status: 'paid',
      currency: 'USD',
      amountTotal: totalPrice,
      amountSubtotal: subtotal,
      amountTax: tax,
      amountShipping: shippingPrice,
      discountCode: failedOrderData.appliedDiscount?.code || null,
      discountAmount: failedOrderData.discountAmount || 0,
      discountPercentage: null,
      customerEmail: failedOrderData.customer.email,
      customerName: `${failedOrderData.shippingAddress.firstName} ${failedOrderData.shippingAddress.lastName}`.trim(),
      shippingAddress: failedOrderData.shippingAddress,
      shippingMethod: 'Standard Shipping',
      shippingCost: shippingPrice,
      lineItems: failedOrderData.cartItems.map(item => ({
        id: item.variant.id,
        title: item.product.title,
        quantity: item.quantity,
        price: item.price,
        variant: null,
        imageUrl: null
      })),
      paymentMethod: 'USDC',
      paymentStatus: 'completed',
      paymentIntentId: failedOrderData.transactionHash,
      giftCards: failedOrderData.giftCards || []
    };

    const supabaseResult = await createSupabaseOrder(supabaseOrderData);
    
    if (!supabaseResult.success) {
      console.error(`❌ [${requestId}] Supabase order creation failed:`, supabaseResult.error);
      // Don't throw here - Shopify order was already created
    } else {
      console.log(`✅ [${requestId}] Supabase order created with ID: ${supabaseResult.order.id}`);
    }

    // Mark discount code as used
    console.log(`🔧 [${requestId}] Marking discount code as used...`);
    
    try {
      const markUsedResult = await markDiscountCodeAsUsed(
        failedOrderData.appliedDiscount.code,
        shopifyOrder.name,
        failedOrderData.fid,
        failedOrderData.discountAmount || 0,
        subtotal
      );
      if (markUsedResult.success) {
        console.log(`✅ [${requestId}] Discount code marked as used: ${failedOrderData.appliedDiscount.code}`);
      } else {
        console.error(`❌ [${requestId}] Failed to mark discount code as used:`, markUsedResult.error);
      }
    } catch (discountError) {
      console.error(`⚠️ [${requestId}] Discount code marking failed:`, discountError);
      // Don't throw - order is created, discount tracking failure is non-critical
    }

    // Send order confirmation notification
    console.log(`🔧 [${requestId}] Sending order confirmation notification...`);
    
    try {
      await sendOrderConfirmationNotificationAndMark(
        failedOrderData.fid,
        shopifyOrder.name,
        totalPrice,
        failedOrderData.cartItems
      );
      console.log(`✅ [${requestId}] Order confirmation notification sent`);
    } catch (notificationError) {
      console.error(`⚠️ [${requestId}] Notification sending failed:`, notificationError);
      // Don't throw - order is created, notification failure is non-critical
    }

    return NextResponse.json({
      success: true,
      message: 'Failed order successfully recovered',
      data: {
        shopifyOrder: {
          id: shopifyOrder.id,
          name: shopifyOrder.name,
          email: shopifyOrder.email,
          totalPrice: shopifyOrder.totalPriceSet?.shopMoney?.amount
        },
        supabaseOrder: supabaseResult.success ? {
          id: supabaseResult.order.id,
          status: 'created'
        } : {
          status: 'failed',
          error: supabaseResult.error
        },
        customerNotification: 'sent',
        originalIssue: 'emoji in customer last name',
        recoveryMethod: 'manual order creation with sanitized address',
        transactionHash: failedOrderData.transactionHash
      }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Order recovery failed:`, error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      requestId: requestId
    }, { status: 500 });
  }
} 