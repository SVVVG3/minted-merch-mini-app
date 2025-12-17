import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPartnerToken } from '@/lib/partnerAuth';
import { updateOrderStatus } from '@/lib/orders';

// PUT update order assignment (partner only - limited permissions)
export async function PUT(request, { params }) {
  try {
    const { orderId } = await params;
    const decodedOrderId = decodeURIComponent(orderId);
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

    // Get partner type from database
    const { data: partnerData, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('partner_type')
      .eq('id', decoded.id)
      .single();

    const partnerType = partnerData?.partner_type || 'fulfillment';
    console.log(`🤝 Partner ${decoded.email} (${partnerType}) updating order: ${decodedOrderId}`, updateData);

    // 🚫 SECURITY: Only fulfillment partners can update tracking
    if (partnerType !== 'fulfillment') {
      console.warn(`⚠️ Collab partner ${decoded.email} attempted to update order ${decodedOrderId}`);
      return NextResponse.json({
        success: false,
        error: 'Collab partners cannot update order status or tracking info. Only fulfillment partners have this permission.'
      }, { status: 403 });
    }

    // Find the partner's assignment for this order
    const { data: assignment, error: fetchError } = await supabaseAdmin
      .from('order_partner_assignments')
      .select('*')
      .eq('order_id', decodedOrderId)
      .eq('partner_id', decoded.id)
      .single();

    if (fetchError || !assignment) {
      console.error('❌ Assignment not found for this partner:', fetchError);
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

    // Build update fields for the assignment
    const updateFields = {
      tracking_number: updateData.tracking_number.trim(),
      carrier: updateData.carrier?.trim() || null,
      tracking_url: updateData.tracking_url?.trim() || null,
      updated_at: new Date().toISOString()
    };

    // Auto-update assignment status to "shipped" when tracking is added
    if (assignment.status === 'assigned') {
      console.log(`🔄 Partner added tracking - auto-updating assignment status: assigned → shipped`);
      updateFields.status = 'shipped';
      updateFields.shipped_at = new Date().toISOString();
    }
    
    console.log('📝 Partner updating assignment fields:', updateFields);

    const { data: updatedAssignment, error: updateError } = await supabaseAdmin
      .from('order_partner_assignments')
      .update(updateFields)
      .eq('id', assignment.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating assignment:', updateError);
      return NextResponse.json({
        success: false,
        error: updateError.message || 'Failed to update order'
      }, { status: 500 });
    }

    // Also update the main order status to shipped and trigger notifications
    // (This ensures backwards compatibility and sends shipping notifications)
    if (updateFields.status === 'shipped') {
      const statusResult = await updateOrderStatus(decodedOrderId, 'shipped');
      if (statusResult.success) {
        console.log('✅ Main order status updated to shipped with notifications');
      }
      
      // Also update tracking on the main order for backwards compatibility
      await supabaseAdmin
        .from('orders')
        .update({
          tracking_number: updateFields.tracking_number,
          tracking_url: updateFields.tracking_url,
          carrier: updateFields.carrier
        })
        .eq('order_id', decodedOrderId);
    }

    console.log('✅ Partner assignment update successful:', updatedAssignment.id);

    return NextResponse.json({
      success: true,
      data: updatedAssignment,
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