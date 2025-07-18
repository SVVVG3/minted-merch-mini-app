import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PUT(request, { params }) {
  try {
    const { orderId } = params;
    const updateData = await request.json();

    console.log('🔄 Updating order:', orderId, 'with data:', updateData);

    // Validate required fields
    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID is required'
      }, { status: 400 });
    }

    // Prepare update object with only the fields that can be updated
    const updateFields = {};
    
    // Order status
    if (updateData.status) {
      updateFields.status = updateData.status;
    }

    // Tracking information
    if (updateData.tracking_number !== undefined) {
      updateFields.tracking_number = updateData.tracking_number || null;
    }
    if (updateData.tracking_url !== undefined) {
      updateFields.tracking_url = updateData.tracking_url || null;
    }
    if (updateData.carrier !== undefined) {
      updateFields.carrier = updateData.carrier || null;
    }

    // Customer information
    if (updateData.customer_name !== undefined) {
      updateFields.customer_name = updateData.customer_name || null;
    }
    if (updateData.customer_email !== undefined) {
      updateFields.customer_email = updateData.customer_email || null;
    }

    // Notes
    if (updateData.notes !== undefined) {
      updateFields.notes = updateData.notes || null;
    }

    // Shipping address
    if (updateData.shipping_address) {
      updateFields.shipping_address = updateData.shipping_address;
    }

    // Set shipped_at timestamp when status changes to shipped
    if (updateData.status === 'shipped' && updateFields.status === 'shipped') {
      updateFields.shipped_at = new Date().toISOString();
    }

    // Set delivered_at timestamp when status changes to delivered
    if (updateData.status === 'delivered' && updateFields.status === 'delivered') {
      updateFields.delivered_at = new Date().toISOString();
    }

    // Always update the updated_at timestamp
    updateFields.updated_at = new Date().toISOString();

    console.log('📝 Update fields:', updateFields);

    // Update the order in the database
    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update(updateFields)
      .eq('order_id', orderId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating order:', error);
      return NextResponse.json({
        success: false,
        error: error.message || 'Failed to update order'
      }, { status: 500 });
    }

    if (!updatedOrder) {
      return NextResponse.json({
        success: false,
        error: 'Order not found'
      }, { status: 404 });
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
}

export async function GET(request, { params }) {
  try {
    const { orderId } = params;

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
} 