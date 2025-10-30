import { NextResponse } from 'next/server';
import { addTrackingInfo } from '@/lib/orders';

export async function POST(request) {
  try {
    const { orderId, trackingNumber, trackingUrl, carrier } = await request.json();

    console.log(`Adding tracking info to order ${orderId}`);

    // Validate required fields
    if (!orderId || !trackingNumber) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: orderId, trackingNumber'
      }, { status: 400 });
    }

    // Add tracking information
    const result = await addTrackingInfo(orderId, {
      trackingNumber,
      trackingUrl,
      carrier
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      message: 'Tracking information added and shipping notification sent'
    });

  } catch (error) {
    console.error('Error in add tracking API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 