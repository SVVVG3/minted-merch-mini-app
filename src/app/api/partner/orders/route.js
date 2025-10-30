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

    const partnerType = decoded.partnerType || 'fulfillment';
    console.log(`🤝 Fetching orders for ${partnerType} partner ${decoded.email}...`);

    // Fetch orders assigned to this partner
    // Include profiles for collab partners, exclude for fulfillment partners
    const selectQuery = partnerType === 'collab'
      ? `
        id,
        name,
        status,
        amount_total,
        created_at,
        assigned_at,
        fid,
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
      `
      : `
        id,
        name,
        status,
        amount_total,
        created_at,
        assigned_at,
        shipping_name,
        shipping_address1,
        shipping_address2,
        shipping_city,
        shipping_province,
        shipping_zip,
        shipping_country,
        shipping_phone,
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
        )
      `;

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(selectQuery)
      .eq('assigned_partner_id', decoded.id)
      .order('assigned_at', { ascending: false });

    if (ordersError) {
      console.error('❌ Error fetching partner orders:', ordersError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch orders'
      }, { status: 500 });
    }

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