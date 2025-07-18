import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPartnerToken } from '@/lib/partnerAuth';
import { updateOrderStatus } from '@/lib/orders';

// PUT update order status (partner only - limited permissions)
export async function PUT(request, { params }) {
  try {
    const { orderId } = params;
    const updateData = await request.json();

    // Get token from cookie
    const token = request.cookies.get('partner-token')?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Verify token
    const decoded = verifyPartnerToken(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired token'
      }, { status: 401 });
    }

    console.log(`🤝 Partner ${decoded.email} updating order: ${orderId}`, updateData);

    // First, verify this order is assigned to this partner
    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('assigned_partner_id', decoded.id)
      .single();

    if (fetchError || !currentOrder) {
      console.error('❌ Order not found or not assigned to this partner:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Order not found or not assigned to you'
      }, { status: 404 });
    }

    // Validate status transitions (partners can only do: assigned -> processing -> shipped)
    const allowedTransitions = {
      'assigned': ['processing'],
      'processing': ['shipped']
    };

    if (updateData.status) {
      const currentStatus = currentOrder.status;
      const newStatus = updateData.status;

      if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
        return NextResponse.json({
          success: false,
          error: `Invalid status transition: ${currentStatus} → ${newStatus}. Partners can only update: assigned → processing → shipped`
        }, { status: 400 });
      }

      // If transitioning to shipped, tracking number is required
      if (newStatus === 'shipped' && !updateData.tracking_number) {
        return NextResponse.json({
          success: false,
          error: 'Tracking number is required when marking order as shipped'
        }, { status: 400 });
      }
    }

    let updatedOrder = currentOrder;

    // Handle status updates using the existing system (for notifications)
    if (updateData.status && updateData.status !== currentOrder.status) {
      console.log(`🔄 Partner status change: ${currentOrder.status} → ${updateData.status}`);
      
      const statusResult = await updateOrderStatus(orderId, updateData.status);
      
      if (!statusResult.success) {
        console.error('❌ Error updating order status:', statusResult.error);
        return NextResponse.json({
          success: false,
          error: statusResult.error || 'Failed to update order status'
        }, { status: 500 });
      }
      
      updatedOrder = statusResult.order;
      console.log('✅ Partner order status updated with notifications:', updatedOrder.order_id);
    }

    // Handle other field updates (tracking info, carrier)
    const otherUpdateFields = {};
    
    if (updateData.tracking_number !== undefined) {
      otherUpdateFields.tracking_number = updateData.tracking_number || null;
    }
    if (updateData.tracking_url !== undefined) {
      otherUpdateFields.tracking_url = updateData.tracking_url || null;
    }
    if (updateData.carrier !== undefined) {
      otherUpdateFields.carrier = updateData.carrier || null;
    }

    // Update other fields if provided
    if (Object.keys(otherUpdateFields).length > 0) {
      otherUpdateFields.updated_at = new Date().toISOString();
      
      console.log('📝 Partner updating tracking fields:', otherUpdateFields);

      const { data: finalOrder, error: updateError } = await supabaseAdmin
        .from('orders')
        .update(otherUpdateFields)
        .eq('order_id', orderId)
        .eq('assigned_partner_id', decoded.id) // Security: ensure partner can only update their orders
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating tracking fields:', updateError);
        return NextResponse.json({
          success: false,
          error: updateError.message || 'Failed to update order'
        }, { status: 500 });
      }

      updatedOrder = finalOrder;
    }

    console.log('✅ Partner order update successful:', updatedOrder.order_id);

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: 'Order updated successfully'
    });

  } catch (error) {
    console.error('❌ Error in PUT /api/partner/orders/[orderId]:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update order'
    }, { status: 500 });
  }
} 