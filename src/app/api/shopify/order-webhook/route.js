import { NextResponse } from 'next/server';
import { archiveOrder, getOrder } from '@/lib/orders';
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

    // Verify webhook signature (if secret is configured)
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValid = verifyShopifyWebhook(body, signature, webhookSecret);
      if (!isValid) {
        console.error('❌ Invalid Shopify webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      console.log('✅ Webhook signature verified');
    } else if (webhookSecret) {
      console.warn('⚠️ Webhook secret configured but no signature provided');
    } else {
      console.log('ℹ️ No webhook secret configured, skipping signature verification');
    }

    const orderData = JSON.parse(body);
    console.log('Order webhook data:', JSON.stringify(orderData, null, 2));

    // Handle different order events
    switch (topic) {
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

    // Archive the cancelled order
    const archiveResult = await archiveOrder(orderName, 'cancelled_in_shopify');
    
    if (archiveResult.success) {
      console.log(`✅ Order ${orderName} successfully marked as cancelled`);
    } else {
      console.error(`❌ Failed to mark order ${orderName} as cancelled:`, archiveResult.error);
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