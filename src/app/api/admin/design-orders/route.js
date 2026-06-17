import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request) => {
  try {
    console.log('🎨 Fetching custom design orders for admin dashboard...');

    const { data: designOrders, error } = await supabaseAdmin
      .from('design_order_requests')
      .select(`
        id,
        fid,
        product_type,
        size,
        color_name,
        technique,
        design_url,
        mockup_url,
        placement,
        design_scale,
        printful_template_id,
        shopify_order_id,
        shopify_order_number,
        created_at,
        profiles (
          username,
          display_name,
          pfp_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching design orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ designOrders: designOrders || [] });
  } catch (err) {
    console.error('Unexpected error fetching design orders:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
