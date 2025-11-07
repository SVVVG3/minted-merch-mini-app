import { NextResponse } from 'next/server';
import { archiveOrder, cancelOrder, getOrder, createOrder as createSupabaseOrder } from '@/lib/orders';
import crypto from 'crypto';

// Verify Shopify webhook signature
function verifyShopifyWebhook(body, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body, 'utf8');
  const calculatedSignature = hmac.digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(calculatedSignature, 'utf8')
  );
}

export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-shopify-hmac-sha256');
    const topic = request.headers.get('x-shopify-topic');
    const shopDomain = request.headers.get('x-shopify-shop-domain');
    
    console.log('📦 Shopify order webhook received:', {
      topic,
      shopDomain,
      hasSignature: !!signature,
      bodyLength: body.length,
      timestamp: new Date().toISOString()
    });

    // 🔒 SECURITY: REQUIRE webhook signature verification
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('❌ SECURITY: SHOPIFY_WEBHOOK_SECRET not configured - rejecting webhook');
      return NextResponse.json({ 
        error: 'Webhook secret not configured' 
      }, { status: 500 });
    }
    
    if (!signature) {
      console.error('❌ SECURITY: Missing webhook signature - rejecting webhook');
      return NextResponse.json({ 
        error: 'Missing signature' 
      }, { status: 401 });
    }
    
    const isValid = verifyShopifyWebhook(body, signature, webhookSecret);
    if (!isValid) {
      console.error('❌ SECURITY: Invalid Shopify webhook signature - rejecting webhook');
      return NextResponse.json({ 
        error: 'Invalid signature' 
      }, { status: 401 });
    }
    
    console.log('✅ Webhook signature verified');

    const orderData = JSON.parse(body);
    console.log('Order webhook data:', JSON.stringify(orderData, null, 2));

    // Handle different order events
    switch (topic) {
      case 'orders/create':
        await handleOrderCreate(orderData);
        break;
      case 'orders/updated':
        await handleOrderUpdated(orderData);
        break;
      case 'orders/cancelled':
        await handleOrderCancelled(orderData);
        break;
      case 'orders/paid':
        await handleOrderPaid(orderData);
        break;
      default:
        console.log(`Unhandled order topic: ${topic}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Error processing order webhook:', error);
    return NextResponse.json({
      error: 'Webhook processing failed',
      details: error.message
    }, { status: 500 });
  }
}

async function handleOrderUpdated(order) {
  try {
    console.log('📝 Processing order update...');

    const orderName = order.name;
    const closedAt = order.closed_at;
    const financialStatus = order.financial_status;
    const fulfillmentStatus = order.fulfillment_status;

    if (!orderName) {
      console.error('❌ No order name found in order update data');
      return;
    }

    // Check if we have this order in our Supabase database
    const orderResult = await getOrder(orderName);
    
    if (!orderResult.success) {
      console.log(`ℹ️ Order ${orderName} not found in Supabase database - likely not a Mini App order`);
      return;
    }

    console.log(`📦 Found order ${orderName} in database, checking for archiving...`);

    // Check if order was archived (closed_at is not null)
    if (closedAt && !orderResult.order.archived_at) {
      console.log(`🗄️ Order ${orderName} was archived in Shopify at ${closedAt}, archiving in our database...`);
      
      const archiveResult = await archiveOrder(orderName, 'archived_in_shopify');
      
      if (archiveResult.success) {
        console.log(`✅ Order ${orderName} successfully archived in our database`);
      } else {
        console.error(`❌ Failed to archive order ${orderName}:`, archiveResult.error);
      }
    } else if (closedAt) {
      console.log(`ℹ️ Order ${orderName} already archived in our database`);
    } else {
      console.log(`ℹ️ Order ${orderName} is not archived (closed_at is null)`);
    }

    // Log other status changes for debugging
    console.log(`📊 Order ${orderName} status - Financial: ${financialStatus}, Fulfillment: ${fulfillmentStatus}`);

  } catch (error) {
    console.error('❌ Error handling order update:', error);
  }
}

async function handleOrderCancelled(order) {
  try {
    console.log('❌ Processing order cancellation...');

    const orderName = order.name;

    if (!orderName) {
      console.error('❌ No order name found in order cancellation data');
      return;
    }

    // Check if we have this order in our Supabase database
    const orderResult = await getOrder(orderName);
    
    if (!orderResult.success) {
      console.log(`ℹ️ Order ${orderName} not found in Supabase database - likely not a Mini App order`);
      return;
    }

    console.log(`📦 Found order ${orderName} in database, marking as cancelled...`);

    // Cancel the order (this sets status to cancelled AND archives it)
    const cancelResult = await cancelOrder(orderName, 'cancelled_in_shopify');
    
    if (cancelResult.success) {
      console.log(`✅ Order ${orderName} successfully cancelled and archived`);
    } else {
      console.error(`❌ Failed to cancel order ${orderName}:`, cancelResult.error);
    }

  } catch (error) {
    console.error('❌ Error handling order cancellation:', error);
  }
}

async function handleOrderPaid(order) {
  try {
    console.log('💰 Processing order paid event...');

    const orderName = order.name;

    if (!orderName) {
      console.error('❌ No order name found in order paid data');
      return;
    }

    // Check if we have this order in our Supabase database
    const orderResult = await getOrder(orderName);
    
    if (!orderResult.success) {
      console.log(`ℹ️ Order ${orderName} not found in Supabase database - likely not a Mini App order`);
      return;
    }

    console.log(`📦 Found order ${orderName} in database, order paid event received`);
    
    // Note: Order confirmation notifications are typically sent when the order is created
    // This webhook is mainly for logging and potential future use cases

  } catch (error) {
    console.error('❌ Error handling order paid:', error);
  }
}

async function handleOrderCreate(order) {
  try {
    console.log('🆕 Processing order creation from webhook...');

    const orderName = order.name;

    if (!orderName) {
      console.error('❌ No order name found in order create data');
      return;
    }

    // Check if this order already exists in our Supabase database
    const existingOrderResult = await getOrder(orderName);
    
    if (existingOrderResult.success) {
      console.log(`ℹ️ Order ${orderName} already exists in Supabase database - likely created via direct API`);
      return;
    }

    console.log(`📦 Order ${orderName} not found in database, creating from webhook data...`);

    // Extract order data and create in Supabase
    const supabaseOrderData = {
      fid: null, // Webhook orders typically don't have FID
      orderId: orderName,
      sessionId: null,
      status: order.financial_status === 'paid' ? 'paid' : 'pending',
      currency: order.currency || 'USD',
      amountTotal: parseFloat(order.total_price || 0),
      amountSubtotal: parseFloat(order.subtotal_price || 0),
      amountTax: parseFloat(order.total_tax || 0),
      amountShipping: parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0),
      discountCode: order.discount_codes?.length > 0 ? order.discount_codes[0].code : null,
      discountAmount: order.discount_codes?.length > 0 ? parseFloat(order.discount_codes[0].amount || 0) : null,
      discountPercentage: null, // Not available in webhook data
      customerEmail: order.customer?.email || order.email || '',
      customerName: order.customer ? 
        `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() :
        (order.billing_address ? 
          `${order.billing_address.first_name || ''} ${order.billing_address.last_name || ''}`.trim() : ''),
      shippingAddress: order.shipping_address ? {
        firstName: order.shipping_address.first_name || '',
        lastName: order.shipping_address.last_name || '',
        address1: order.shipping_address.address1 || '',
        address2: order.shipping_address.address2 || '',
        city: order.shipping_address.city || '',
        province: order.shipping_address.province || '',
        zip: order.shipping_address.zip || '',
        country: order.shipping_address.country || '',
        phone: order.shipping_address.phone || ''
      } : null,
      shippingMethod: order.shipping_lines?.length > 0 ? order.shipping_lines[0].title : 'Standard',
      lineItems: (order.line_items || []).map(item => ({
        id: item.variant_id,
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price),
        variant: item.variant_title !== 'Default Title' ? item.variant_title : null,
        imageUrl: null // Not available in webhook data
      })),
      paymentMethod: 'Unknown', // Not available in webhook data
      paymentStatus: order.financial_status === 'paid' ? 'completed' : 'pending',
      paymentIntentId: order.id.toString() // Use Shopify order ID as fallback
    };

    const supabaseResult = await createSupabaseOrder(supabaseOrderData);
    
    if (supabaseResult.success) {
      console.log(`✅ Order ${orderName} created in Supabase from webhook`);
    } else {
      console.error(`❌ Failed to create order ${orderName} from webhook:`, supabaseResult.error);
    }

  } catch (error) {
    console.error('❌ Error handling order create:', error);
  }
} 