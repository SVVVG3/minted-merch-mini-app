import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    console.log('🛍️ Fetching all orders for admin dashboard...');

    // Fetch all orders with order items and user profiles - using correct column names from database
    const { data: orders, error: ordersError } = await supabaseAdmin
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
          variant_title
        ),
        profiles (
          username,
          display_name,
          pfp_url
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

    // Sort by order number (extract numeric part and sort descending)
    orders.sort((a, b) => {
      const orderNumA = parseInt(a.order_id.replace('#', '')) || 0;
      const orderNumB = parseInt(b.order_id.replace('#', '')) || 0;
      return orderNumB - orderNumA; // Descending order (newest first)
    });

    // Format orders using correct database column names
    const formattedOrders = orders.map(order => {
      const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      
      // Parse line_items JSONB to get product details
      let lineItems = [];
      try {
        lineItems = JSON.parse(order.line_items || '[]');
      } catch (error) {
        console.error('Error parsing line_items:', error);
        lineItems = [];
      }
      
      // Format product details from line_items
      const products = lineItems.map(item => ({
        title: item.title || item.product_title,
        variant: item.variant_title || 'Default',
        quantity: item.quantity,
        price: item.price,
        image: item.image || null
      }));
      
      return {
        order_id: order.order_id,
        fid: order.fid,
        customer_email: order.customer_email,
        customer_name: order.customer_name,
        status: order.status,
        item_count: itemCount,
        
        // Use correct database columns for amounts
        amount_total: order.amount_total,
        amount_subtotal: order.amount_subtotal,
        amount_tax: order.amount_tax,
        amount_shipping: order.amount_shipping,
        
        // Discount information
        discount_applied: !!order.discount_code, // true if discount_code exists
        discount_code: order.discount_code,
        discount_amount: order.discount_amount,
        discount_percentage: order.discount_percentage,
        
        // Other order details
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        currency: order.currency,
        
        // Shopify and tracking info
        shopify_order_id: order.order_id, // The order_id is the Shopify order number
        tracking_number: order.tracking_number,
        tracking_url: order.tracking_url,
        carrier: order.carrier,
        
        // Timestamps
        created_at: order.created_at,
        updated_at: order.updated_at,
        shipped_at: order.shipped_at,
        delivered_at: order.delivered_at,
        archived_at: order.archived_at,
        
        // Gift card info
        gift_card_codes: order.gift_card_codes,
        gift_card_total_used: order.gift_card_total_used,
        gift_card_count: order.gift_card_count,
        
        // Profile information
        username: order.profiles?.username || null,
        display_name: order.profiles?.display_name || null,
        pfp_url: order.profiles?.pfp_url || null,
        
        // Product details
        products: products
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