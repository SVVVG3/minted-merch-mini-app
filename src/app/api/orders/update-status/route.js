import { NextResponse } from 'next/server';
import { updateOrderStatus } from '@/lib/orders';
import { withAdminAuth } from '@/lib/adminAuth';

// 🔒 SECURITY FIX: Order status updates should be admin-only
// This prevents unauthorized users from marking orders as shipped/delivered/cancelled
export const POST = withAdminAuth(async (request) => {
  try {
    const { orderId, status, ...additionalData } = await request.json();

    console.log(`Admin updating order ${orderId} status to ${status}`);

    // Validate required fields
    if (!orderId || !status) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: orderId, status'
      }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      }, { status: 400 });
    }

    // Update order status
    const result = await updateOrderStatus(orderId, status, additionalData);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: result.order
    });

  } catch (error) {
    console.error('Error in update order status API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}); 