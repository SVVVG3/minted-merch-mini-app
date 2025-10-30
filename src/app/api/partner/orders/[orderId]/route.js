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

    // Verify token (now async with jose)
    const decoded = await verifyPartnerToken(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired token'
      }, { status: 401 });
    }

    const partnerType = decoded.partnerType || 'fulfillment';
    console.log(`🤝 Partner ${decoded.email} (${partnerType}) updating order: ${orderId}`, updateData);

    // 🚫 SECURITY: Only fulfillment partners can update orders
    if (partnerType !== 'fulfillment') {
      console.warn(`⚠️ Collab partner ${decoded.email} attempted to update order ${orderId}`);
      return NextResponse.json({
        success: false,
        error: 'Collab partners cannot update order status or tracking info. Only fulfillment partners have this permission.'
      }, { status: 403 });
    }

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

    // 📦 SIMPLIFIED WORKFLOW: Adding tracking number automatically marks as shipped
    // Partners just enter tracking info, status auto-updates to "shipped"
    
    // Validate tracking number is provided
    if (!updateData.tracking_number || updateData.tracking_number.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Tracking number is required'
      }, { status: 400 });
    }

    let updatedOrder = currentOrder;

    // Auto-update status to "shipped" when tracking is added (triggers notifications)
    if (currentOrder.status !== 'shipped') {
      console.log(`🔄 Partner added tracking - auto-updating status: ${currentOrder.status} → shipped`);
      
      const statusResult = await updateOrderStatus(orderId, 'shipped');
      
      if (!statusResult.success) {
        console.error('❌ Error updating order status:', statusResult.error);
        return NextResponse.json({
          success: false,
          error: statusResult.error || 'Failed to update order status'
        }, { status: 500 });
      }
      
      updatedOrder = statusResult.order;
      console.log('✅ Order auto-marked as shipped with notifications:', updatedOrder.order_id);
    }

    // Update tracking info and carrier
    const trackingUpdateFields = {
      tracking_number: updateData.tracking_number.trim(),
      carrier: updateData.carrier?.trim() || null,
      tracking_url: updateData.tracking_url?.trim() || null,
      updated_at: new Date().toISOString()
    };
    
    console.log('📝 Partner updating tracking fields:', trackingUpdateFields);

    const { data: finalOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(trackingUpdateFields)
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