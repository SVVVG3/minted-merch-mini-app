import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { updateOrderStatus } from '@/lib/orders';
import { sendPartnerAssignmentNotification, sendVendorPaidNotification } from '@/lib/neynar';
import { withAdminAuth } from '@/lib/adminAuth';

export const PUT = withAdminAuth(async (request, { params }) => {
  try {
    const { orderId } = await params;
    const updateData = await request.json();

    console.log('🔄 Updating order:', orderId, 'with data:', updateData);

    // Validate required fields
    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID is required'
      }, { status: 400 });
    }

    // Get current order first to check for status changes
    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (fetchError || !currentOrder) {
      console.error('❌ Error fetching current order:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Order not found'
      }, { status: 404 });
    }

    let updatedOrder = currentOrder;

    // Handle status updates with notifications using the existing system
    if (updateData.status && updateData.status !== currentOrder.status) {
      console.log(`🔄 Status change detected: ${currentOrder.status} → ${updateData.status}`);
      
      const statusResult = await updateOrderStatus(orderId, updateData.status);
      
      if (!statusResult.success) {
        console.error('❌ Error updating order status:', statusResult.error);
        return NextResponse.json({
          success: false,
          error: statusResult.error || 'Failed to update order status'
        }, { status: 500 });
      }
      
      updatedOrder = statusResult.order;
      console.log('✅ Order status updated with notifications:', updatedOrder.order_id);
    }

    // Handle other field updates (non-status fields)
    const otherUpdateFields = {};
    
    // Tracking information
    if (updateData.tracking_number !== undefined) {
      otherUpdateFields.tracking_number = updateData.tracking_number || null;
    }
    if (updateData.tracking_url !== undefined) {
      otherUpdateFields.tracking_url = updateData.tracking_url || null;
    }
    if (updateData.carrier !== undefined) {
      otherUpdateFields.carrier = updateData.carrier || null;
    }

    // Customer information
    if (updateData.customer_name !== undefined) {
      otherUpdateFields.customer_name = updateData.customer_name || null;
    }
    if (updateData.customer_email !== undefined) {
      otherUpdateFields.customer_email = updateData.customer_email || null;
    }

    // Notes field doesn't exist in orders table - removed

    // Shipping address
    if (updateData.shipping_address) {
      otherUpdateFields.shipping_address = updateData.shipping_address;
    }

    // Partner assignment
    if (updateData.assigned_partner_id !== undefined) {
      otherUpdateFields.assigned_partner_id = updateData.assigned_partner_id || null;
      // Set assigned_at timestamp when assigning to a partner
      if (updateData.assigned_partner_id) {
        otherUpdateFields.assigned_at = new Date().toISOString();
      } else {
        // Clear assigned_at when unassigning
        otherUpdateFields.assigned_at = null;
      }
    }

    // Vendor payout tracking
    if (updateData.vendor_payout_amount !== undefined) {
      otherUpdateFields.vendor_payout_amount = updateData.vendor_payout_amount ? parseFloat(updateData.vendor_payout_amount) : null;
    }
    if (updateData.vendor_payout_notes !== undefined) {
      otherUpdateFields.vendor_payout_notes = updateData.vendor_payout_notes || null;
    }
    if (updateData.vendor_payout_partner_notes !== undefined) {
      otherUpdateFields.vendor_payout_partner_notes = updateData.vendor_payout_partner_notes || null;
    }
    // Auto-set vendor_paid_at when status changes to vendor_paid
    if (updateData.status === 'vendor_paid' && currentOrder.status !== 'vendor_paid') {
      otherUpdateFields.vendor_paid_at = new Date().toISOString();
    }

    // If there are other fields to update, do a separate update
    if (Object.keys(otherUpdateFields).length > 0) {
      otherUpdateFields.updated_at = new Date().toISOString();
      
      console.log('📝 Updating other fields:', otherUpdateFields);

      const { data: finalOrder, error: updateError } = await supabaseAdmin
        .from('orders')
        .update(otherUpdateFields)
        .eq('order_id', orderId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating other order fields:', updateError);
        return NextResponse.json({
          success: false,
          error: updateError.message || 'Failed to update order fields'
        }, { status: 500 });
      }

      updatedOrder = finalOrder;
      
      // Send partner assignment notification if a partner was newly assigned
      if (updateData.assigned_partner_id && updateData.assigned_partner_id !== currentOrder.assigned_partner_id) {
        try {
          console.log('🔔 Sending partner assignment notification for order:', orderId);
          
          // Get the partner's FID from the partners table
          const { data: partner, error: partnerError } = await supabaseAdmin
            .from('partners')
            .select('fid')
            .eq('id', updateData.assigned_partner_id)
            .single();

          if (partnerError || !partner?.fid) {
            console.warn('⚠️ Could not get partner FID for notification:', partnerError);
          } else {
            // Send notification to partner (NOT to customer)
            const notificationResult = await sendPartnerAssignmentNotification(
              partner.fid, // Send to PARTNER's FID, not customer's FID
              {
                orderId: currentOrder.order_id,
                customerName: currentOrder.customer_name || 'Customer',
                orderTotal: currentOrder.amount_total
              }
            );

            if (notificationResult.success) {
              console.log('✅ Partner assignment notification sent successfully');
            } else {
              console.log('⚠️ Partner assignment notification failed or skipped:', notificationResult.error || notificationResult.reason);
            }
          }
        } catch (notificationError) {
          console.error('❌ Error sending partner assignment notification:', notificationError);
          // Don't fail the order update if notification fails
        }
      }

      // Send vendor paid notification if status changed to vendor_paid and order has an assigned partner
      if (updateData.status === 'vendor_paid' && currentOrder.status !== 'vendor_paid' && currentOrder.assigned_partner_id) {
        try {
          console.log('💰 Sending vendor paid notification for order:', orderId);
          
          // Get the partner's FID from the partners table
          const { data: partner, error: partnerError } = await supabaseAdmin
            .from('partners')
            .select('fid')
            .eq('id', currentOrder.assigned_partner_id)
            .single();

          if (partnerError || !partner?.fid) {
            console.warn('⚠️ Could not get partner FID for vendor paid notification:', partnerError);
          } else {
            const notificationResult = await sendVendorPaidNotification(
              partner.fid,
              {
                orderId: currentOrder.order_id,
                amount: updateData.vendor_payout_amount || null
              }
            );

            if (notificationResult.success) {
              console.log('✅ Vendor paid notification sent successfully');
            } else {
              console.log('⚠️ Vendor paid notification failed or skipped:', notificationResult.error || notificationResult.reason);
            }
          }
        } catch (notificationError) {
          console.error('❌ Error sending vendor paid notification:', notificationError);
          // Don't fail the order update if notification fails
        }
      }
    }

    console.log('✅ Order updated successfully:', updatedOrder.order_id);

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: 'Order updated successfully'
    });

  } catch (error) {
    console.error('❌ Error in order update API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

export const GET = withAdminAuth(async (request, { params }) => {
  try {
    const { orderId } = await params;

    console.log('🔍 Fetching order details for:', orderId);

    // Get the specific order with related data
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          variant_id,
          quantity,
          price,
          total,
          product_title,
          variant_title,
          product_data
        ),
        profiles (
          username,
          display_name,
          pfp_url
        )
      `)
      .eq('order_id', orderId)
      .single();

    if (error) {
      console.error('❌ Error fetching order:', error);
      return NextResponse.json({
        success: false,
        error: error.message || 'Failed to fetch order'
      }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Order not found'
      }, { status: 404 });
    }

    console.log('✅ Order fetched successfully:', order.order_id);

    return NextResponse.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('❌ Error in order fetch API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}); 