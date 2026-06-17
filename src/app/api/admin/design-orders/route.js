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
        printful_order_id,
        printful_order_status,
        shopify_order_id,
        shopify_order_number,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching design orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orders = designOrders || [];

    // Fetch profiles for all unique FIDs
    const fids = [...new Set(orders.map((o) => o.fid).filter(Boolean))];
    let profileMap = {};
    if (fids.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('fid, username, display_name, pfp_url')
        .in('fid', fids);
      if (profiles) {
        profileMap = Object.fromEntries(profiles.map((p) => [p.fid, p]));
      }
    }

    const enriched = orders.map((o) => ({ ...o, profiles: profileMap[o.fid] || null }));

    return NextResponse.json({ designOrders: enriched });
  } catch (err) {
    console.error('Unexpected error fetching design orders:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
