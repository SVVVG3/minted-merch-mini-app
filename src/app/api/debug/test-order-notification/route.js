import { NextResponse } from 'next/server';
import { getOrder } from '@/lib/orders';
import { sendOrderConfirmationNotificationAndMark } from '@/lib/orders';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({
        error: 'Order ID is required'
      }, { status: 400 });
    }

    console.log(`Testing order confirmation notification for order: ${orderId}`);

    // Get the order from database
    const orderResult = await getOrder(orderId);
    
    if (!orderResult.success) {
      return NextResponse.json({
        error: 'Order not found',
        details: orderResult.error
      }, { status: 404 });
    }

    const order = orderResult.order;
    
    console.log('Order found:', {
      orderId: order.order_id,
      fid: order.fid,
      status: order.status,
      confirmationSent: order.order_confirmation_sent,
      confirmationSentAt: order.order_confirmation_sent_at,
      amountTotal: order.amount_total,
      currency: order.currency
    });

    // Try to send the notification
    console.log('Attempting to send order confirmation notification...');
    const notificationResult = await sendOrderConfirmationNotificationAndMark(order);
    
    return NextResponse.json({
      success: true,
      order: {
        orderId: order.order_id,
        fid: order.fid,
        status: order.status,
        confirmationSent: order.order_confirmation_sent,
        confirmationSentAt: order.order_confirmation_sent_at
      },
      notificationResult,
      message: 'Test notification attempted'
    });

  } catch (error) {
    console.error('Test order notification error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});