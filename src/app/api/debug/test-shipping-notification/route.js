import { NextResponse } from 'next/server';
import { addTrackingInfo, updateOrderStatus } from '@/lib/orders';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { orderId, trackingNumber, carrier } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    console.log(`🧪 Testing shipping notification for order: ${orderId}`);

    let result;

    if (trackingNumber) {
      // Add tracking info and send notification
      result = await addTrackingInfo(orderId, {
        trackingNumber,
        trackingUrl: `https://www.google.com/search?q=track+package+${trackingNumber}`,
        carrier: carrier || 'Test Carrier'
      });
    } else {
      // Just update status to shipped and send notification
      result = await updateOrderStatus(orderId, 'shipped');
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Shipping notification sent successfully',
        order: result.order
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error testing shipping notification:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

export async function GET() {
  return NextResponse.json({
    message: 'Test shipping notification endpoint',
    usage: 'POST with { "orderId": "#1184", "trackingNumber": "1234567890", "carrier": "UPS" }'
  });
} 