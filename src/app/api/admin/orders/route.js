import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    console.log('🛍️ Fetching all orders for admin dashboard...');

    // Fetch all orders with order items
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          variant_id,
          quantity,
          price_per_item,
          product_title,
          variant_title
        )
      `)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch orders'
      }, { status: 500 });
    }

    // Calculate order totals and format data
    const formattedOrders = orders.map(order => {
      const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const orderTotal = order.order_items?.reduce((sum, item) => sum + (item.price_per_item * item.quantity), 0) || 0;

      return {
        order_id: order.order_id,
        fid: order.fid,
        customer_email: order.customer_email,
        customer_name: order.customer_name,
        status: order.status,
        item_count: itemCount,
        order_total: orderTotal,
        discount_applied: order.discount_applied,
        discount_code: order.discount_code,
        discount_amount: order.discount_amount,
        shipping_cost: order.shipping_cost,
        final_total: order.final_total,
        payment_method: order.payment_method,
        shopify_order_id: order.shopify_order_id,
        created_at: order.created_at,
        updated_at: order.updated_at,
        archived_at: order.archived_at,
        tracking_number: order.tracking_number,
        tracking_url: order.tracking_url
      };
    });

    console.log(`✅ Successfully fetched ${formattedOrders.length} orders`);

    return NextResponse.json({
      success: true,
      data: formattedOrders,
      count: formattedOrders.length
    });

  } catch (error) {
    console.error('Error in admin orders API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 