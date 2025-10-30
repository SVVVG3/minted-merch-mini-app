import { NextResponse } from 'next/server';
import { updateOrderStatus, addTrackingInfo, getOrder } from '@/lib/orders';
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
    
    console.log('📦 Shopify fulfillment webhook received:', {
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

    const fulfillmentData = JSON.parse(body);
    console.log('Fulfillment data:', JSON.stringify(fulfillmentData, null, 2));

    // Handle different fulfillment events
    switch (topic) {
      case 'fulfillments/create':
        await handleFulfillmentCreate(fulfillmentData);
        break;
      case 'fulfillments/update':
        await handleFulfillmentUpdate(fulfillmentData);
        break;
      case 'orders/fulfilled':
        await handleOrderFulfilled(fulfillmentData);
        break;
      default:
        console.log(`Unhandled fulfillment topic: ${topic}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Error processing fulfillment webhook:', error);
    return NextResponse.json({
      error: 'Webhook processing failed',
      details: error.message
    }, { status: 500 });
  }
}

async function handleFulfillmentCreate(fulfillment) {
  try {
    console.log('🚚 Processing fulfillment creation...');

    const orderName = fulfillment.order_name || fulfillment.name;
    const trackingNumber = fulfillment.tracking_number;
    const trackingUrl = fulfillment.tracking_url;
    const trackingCompany = fulfillment.tracking_company;

    if (!orderName) {
      console.error('❌ No order name found in fulfillment data');
      return;
    }

    // Check if we have this order in our Supabase database
    const orderResult = await getOrder(orderName);
    
    if (!orderResult.success) {
      console.log(`ℹ️ Order ${orderName} not found in Supabase database - likely not a Mini App order`);
      return;
    }

    console.log(`📦 Found order ${orderName} in database, updating with tracking info...`);

    // Update order with tracking information and send notification
    if (trackingNumber) {
      const trackingResult = await addTrackingInfo(orderName, {
        trackingNumber,
        trackingUrl: trackingUrl || generateTrackingUrl(trackingNumber, trackingCompany),
        carrier: trackingCompany || 'Unknown'
      });

      if (trackingResult.success) {
        console.log(`✅ Tracking info added and shipping notification sent for order ${orderName}`);
      } else {
        console.error(`❌ Failed to add tracking info for order ${orderName}:`, trackingResult.error);
      }
    } else {
      // No tracking number, just update status to shipped
      const statusResult = await updateOrderStatus(orderName, 'shipped');
      
      if (statusResult.success) {
        console.log(`✅ Order ${orderName} marked as shipped`);
      } else {
        console.error(`❌ Failed to update order status for ${orderName}:`, statusResult.error);
      }
    }

  } catch (error) {
    console.error('❌ Error handling fulfillment create:', error);
  }
}

async function handleFulfillmentUpdate(fulfillment) {
  try {
    console.log('📝 Processing fulfillment update...');

    const orderName = fulfillment.order_name || fulfillment.name;
    const trackingNumber = fulfillment.tracking_number;
    const trackingUrl = fulfillment.tracking_url;
    const trackingCompany = fulfillment.tracking_company;

    if (!orderName) {
      console.error('❌ No order name found in fulfillment update data');
      return;
    }

    // Check if we have this order in our Supabase database
    const orderResult = await getOrder(orderName);
    
    if (!orderResult.success) {
      console.log(`ℹ️ Order ${orderName} not found in Supabase database`);
      return;
    }

    // Update tracking information if it changed
    if (trackingNumber && trackingNumber !== orderResult.order.tracking_number) {
      console.log(`📦 Updating tracking info for order ${orderName}...`);
      
      const trackingResult = await addTrackingInfo(orderName, {
        trackingNumber,
        trackingUrl: trackingUrl || generateTrackingUrl(trackingNumber, trackingCompany),
        carrier: trackingCompany || 'Unknown'
      });

      if (trackingResult.success) {
        console.log(`✅ Tracking info updated for order ${orderName}`);
      } else {
        console.error(`❌ Failed to update tracking info for order ${orderName}:`, trackingResult.error);
      }
    }

  } catch (error) {
    console.error('❌ Error handling fulfillment update:', error);
  }
}

async function handleOrderFulfilled(orderData) {
  try {
    console.log('📦 Processing order fulfilled event...');

    const orderName = orderData.name;
    const fulfillments = orderData.fulfillments || [];

    if (!orderName) {
      console.error('❌ No order name found in order fulfilled data');
      return;
    }

    // Check if we have this order in our Supabase database
    const orderResult = await getOrder(orderName);
    
    if (!orderResult.success) {
      console.log(`ℹ️ Order ${orderName} not found in Supabase database - likely not a Mini App order`);
      return;
    }

    console.log(`📦 Found order ${orderName} in database, processing fulfillment...`);

    // Get tracking info from the first fulfillment
    let trackingInfo = null;
    if (fulfillments.length > 0) {
      const fulfillment = fulfillments[0];
      if (fulfillment.tracking_number) {
        trackingInfo = {
          trackingNumber: fulfillment.tracking_number,
          trackingUrl: fulfillment.tracking_url || generateTrackingUrl(fulfillment.tracking_number, fulfillment.tracking_company),
          carrier: fulfillment.tracking_company || 'Unknown'
        };
      }
    }

    // Update order with tracking information and send notification
    if (trackingInfo) {
      const trackingResult = await addTrackingInfo(orderName, trackingInfo);

      if (trackingResult.success) {
        console.log(`✅ Order ${orderName} fulfilled with tracking info and shipping notification sent`);
      } else {
        console.error(`❌ Failed to add tracking info for order ${orderName}:`, trackingResult.error);
      }
    } else {
      // No tracking number, just update status to shipped
      const statusResult = await updateOrderStatus(orderName, 'shipped');
      
      if (statusResult.success) {
        console.log(`✅ Order ${orderName} marked as shipped (no tracking info available)`);
      } else {
        console.error(`❌ Failed to update order status for ${orderName}:`, statusResult.error);
      }
    }

  } catch (error) {
    console.error('❌ Error handling order fulfilled:', error);
  }
}

// Generate tracking URL based on carrier
function generateTrackingUrl(trackingNumber, carrier) {
  if (!trackingNumber) return null;

  const carrierLower = (carrier || '').toLowerCase();

  if (carrierLower.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  } else if (carrierLower.includes('fedex')) {
    return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingNumber}`;
  } else if (carrierLower.includes('usps')) {
    return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`;
  } else if (carrierLower.includes('dhl')) {
    return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`;
  } else {
    // Generic tracking URL
    return `https://www.google.com/search?q=track+package+${trackingNumber}`;
  }
}