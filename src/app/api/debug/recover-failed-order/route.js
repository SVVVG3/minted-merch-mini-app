import { createShopifyOrder } from '@/lib/shopifyAdmin';
import { createOrder as createSupabaseOrder } from '@/lib/orders';
import { sendOrderConfirmationNotificationAndMark } from '@/lib/orders';
import { NextResponse } from 'next/server';

// Function to sanitize address fields by removing emojis
function sanitizeAddressField(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Remove emojis using regex that matches most emoji ranges
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE0F}]|[\u{200D}]/gu, '').trim();
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
        lastName: sanitizeAddressField('🎩 🟪🟡'), // Remove emojis
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
      shopify_order_id: shopifyOrder.id,
      shopify_order_number: shopifyOrder.name,
      customer_email: failedOrderData.customer.email,
      total_amount: totalPrice,
      subtotal_amount: subtotal,
      tax_amount: tax,
      shipping_amount: shippingPrice,
      discount_amount: failedOrderData.discountAmount,
      discount_code: failedOrderData.appliedDiscount?.code || null,
      transaction_hash: failedOrderData.transactionHash,
      payment_status: 'paid',
      fulfillment_status: 'unfulfilled',
      currency: 'USD',
      order_items: failedOrderData.cartItems.map(item => ({
        product_id: item.variant.id,
        product_title: item.product.title,
        quantity: item.quantity,
        price: item.price,
        variant_id: item.variant.id,
        variant_title: null
      })),
      shipping_address: failedOrderData.shippingAddress,
      notes: 'RECOVERED ORDER - Originally failed due to emoji in customer address'
    };

    const supabaseResult = await createSupabaseOrder(supabaseOrderData);
    
    if (!supabaseResult.success) {
      console.error(`❌ [${requestId}] Supabase order creation failed:`, supabaseResult.error);
      // Don't throw here - Shopify order was already created
    } else {
      console.log(`✅ [${requestId}] Supabase order created with ID: ${supabaseResult.order.id}`);
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