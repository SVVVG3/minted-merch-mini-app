import { NextResponse } from 'next/server';
import { fulfillOrder } from '@/lib/shopifyAdmin';
import { addTrackingInfo, getOrder } from '@/lib/orders';

export async function POST(request) {
  try {
    const { orderId, trackingNumber, trackingCompany, trackingUrl } = await request.json();

    console.log(`🔄 Syncing fulfillment for order ${orderId}...`);

    // Validate required fields
    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: orderId'
      }, { status: 400 });
    }

    // Check if order exists in our database
    const orderResult = await getOrder(orderId);
    if (!orderResult.success) {
      return NextResponse.json({
        success: false,
        error: `Order ${orderId} not found in database`
      }, { status: 404 });
    }

    const order = orderResult.order;
    
    // Get Shopify order ID from our database (stored as payment_intent_id or separate field)
    const shopifyOrderId = order.payment_intent_id; // This might need adjustment based on your data structure

    let fulfillmentResult = null;
    let trackingResult = null;

    // 1. Fulfill order in Shopify (if not already fulfilled)
    if (shopifyOrderId) {
      try {
        fulfillmentResult = await fulfillOrder(
          shopifyOrderId,
          trackingNumber,
          trackingCompany
        );
        console.log('✅ Order fulfilled in Shopify:', fulfillmentResult);
      } catch (error) {
        console.error('❌ Error fulfilling Shopify order:', error);
        // Continue with our database update even if Shopify fails
      }
    }

    // 2. Update our database and send notification
    if (trackingNumber) {
      trackingResult = await addTrackingInfo(orderId, {
        trackingNumber,
        trackingUrl: trackingUrl || generateTrackingUrl(trackingNumber, trackingCompany),
        carrier: trackingCompany || 'Unknown'
      });

      if (!trackingResult.success) {
        return NextResponse.json({
          success: false,
          error: trackingResult.error,
          shopifyFulfillment: fulfillmentResult
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order fulfillment synced successfully',
      order: trackingResult?.order || order,
      shopifyFulfillment: fulfillmentResult,
      notificationSent: trackingResult?.order?.shipping_notification_sent || false
    });

  } catch (error) {
    console.error('❌ Error syncing fulfillment:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to sync fulfillment',
      details: error.message
    }, { status: 500 });
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