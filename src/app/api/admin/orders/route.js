import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request) => {
  try {
    console.log('🛍️ Fetching all orders for admin dashboard...');

    // Fetch all orders with order items, user profiles, and partner assignments
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
          variant_title,
          product_data
        ),
        profiles (
          username,
          display_name,
          pfp_url
        ),
        assigned_partner:partners!assigned_partner_id (
          id,
          name,
          email
        ),
        partner_assignments:order_partner_assignments (
          id,
          partner_id,
          status,
          assigned_at,
          shipped_at,
          vendor_paid_at,
          tracking_number,
          tracking_url,
          carrier,
          vendor_payout_amount,
          vendor_payout_internal_notes,
          vendor_payout_partner_notes,
          assignment_notes,
          partner:partners (
            id,
            name,
            email,
            partner_type
          )
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
      
      // Format product details from order_items table (not line_items JSONB)
      const products = order.order_items?.map(item => {
        // Try to extract image from product_data JSONB if available
        let image = null;
        if (item.product_data) {
          try {
            const productData = typeof item.product_data === 'string' ? JSON.parse(item.product_data) : item.product_data;
            image = productData.image || productData.featured_image || null;
          } catch (e) {
            console.warn('Error parsing product_data:', e);
          }
        }
        
        return {
          title: item.product_title,
          variant: item.variant_title || 'Default',
          quantity: item.quantity,
          price: item.price,
          image: image
        };
      }) || [];
      
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
        
        // Shipping information
        shipping_address: order.shipping_address,
        shipping_method: order.shipping_method,
        shipping_cost: order.shipping_cost,
        
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
        
        // Notification status
        order_confirmation_sent: order.order_confirmation_sent,
        order_confirmation_sent_at: order.order_confirmation_sent_at,
        shipping_notification_sent: order.shipping_notification_sent,
        shipping_notification_sent_at: order.shipping_notification_sent_at,
        
        // Gift card info
        gift_card_codes: order.gift_card_codes,
        gift_card_total_used: order.gift_card_total_used,
        gift_card_count: order.gift_card_count,
        
        // Profile information
        username: order.profiles?.username || null,
        display_name: order.profiles?.display_name || null,
        pfp_url: order.profiles?.pfp_url || null,
        
        // Legacy single partner assignment (for backwards compatibility)
        assigned_partner: order.assigned_partner || null,
        assigned_partner_id: order.assigned_partner_id || null,
        assigned_at: order.assigned_at || null,
        
        // Legacy vendor payout tracking (for backwards compatibility)
        vendor_payout_amount: order.vendor_payout_amount || null,
        vendor_paid_at: order.vendor_paid_at || null,
        vendor_payout_notes: order.vendor_payout_notes || null,
        
        // NEW: Multi-partner assignments
        partner_assignments: order.partner_assignments || [],
        
        // Product details from order_items table
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
}); 