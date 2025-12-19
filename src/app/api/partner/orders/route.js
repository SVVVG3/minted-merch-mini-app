import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPartnerToken } from '@/lib/partnerAuth';

// GET orders assigned to authenticated partner
export async function GET(request) {
  try {
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

    // Always fetch current partner type from database (in case it changed after login)
    const { data: partnerData, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('partner_type')
      .eq('id', decoded.id)
      .single();

    if (partnerError || !partnerData) {
      console.error('❌ Error fetching partner data:', partnerError);
      return NextResponse.json({
        success: false,
        error: 'Partner not found'
      }, { status: 404 });
    }

    const partnerType = partnerData.partner_type || 'fulfillment';
    console.log(`🤝 Fetching orders for ${partnerType} partner ${decoded.email}...`);

    // Fetch partner assignments with order details
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('order_partner_assignments')
      .select(`
        id,
        order_id,
        status,
        assigned_at,
        shipped_at,
        payment_processing_at,
        vendor_paid_at,
        tracking_number,
        tracking_url,
        carrier,
        vendor_payout_estimated,
        vendor_payout_amount,
        vendor_payout_partner_notes,
        assignment_notes,
        orders (
          id,
          order_id,
          status,
          amount_total,
          discount_code,
          discount_amount,
          created_at,
          fid,
          customer_name,
          customer_email,
          shipping_address,
          shipping_method,
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
            pfp_url,
            fid
          )
        )
      `)
      .eq('partner_id', decoded.id)
      .order('assigned_at', { ascending: false });

    if (assignmentsError) {
      console.error('❌ Error fetching partner assignments:', assignmentsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch orders'
      }, { status: 500 });
    }

    // Transform assignments into the expected order format
    const orders = assignments.map(assignment => {
      const order = assignment.orders;
      
      // Base order data
      const orderData = {
        id: order.id,
        order_id: order.order_id,
        status: assignment.status, // Use assignment status instead of order status
        order_status: order.status,
        amount_total: order.amount_total,
        discount_code: order.discount_code,
        discount_amount: order.discount_amount,
        created_at: order.created_at,
        assigned_at: assignment.assigned_at,
        shipped_at: assignment.shipped_at,
        payment_processing_at: assignment.payment_processing_at,
        vendor_payout_estimated: assignment.vendor_payout_estimated,
        vendor_payout_amount: assignment.vendor_payout_amount,
        vendor_paid_at: assignment.vendor_paid_at,
        vendor_payout_partner_notes: assignment.vendor_payout_partner_notes,
        assignment_notes: assignment.assignment_notes,
        assignment_id: assignment.id,
        order_items: order.order_items
      };
      
      // Add tracking info for fulfillment partners
      if (partnerType === 'fulfillment') {
        orderData.tracking_number = assignment.tracking_number;
        orderData.tracking_url = assignment.tracking_url;
        orderData.carrier = assignment.carrier;
        orderData.customer_name = order.customer_name;
        orderData.customer_email = order.customer_email;
        orderData.shipping_address = order.shipping_address;
        orderData.shipping_method = order.shipping_method;
      }
      
      // Add profile info for collab partners
      if (partnerType === 'collab') {
        orderData.fid = order.fid;
        orderData.profiles = order.profiles;
      }
      
      return orderData;
    });

    console.log(`✅ Retrieved ${orders.length} orders for ${partnerType} partner ${decoded.email}`);

    return NextResponse.json({
      success: true,
      data: orders,
      partnerType // Include partner type so frontend knows what to display
    });

  } catch (error) {
    console.error('❌ Error in GET /api/partner/orders:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch orders'
    }, { status: 500 });
  }
} 