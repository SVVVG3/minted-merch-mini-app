import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async () => {
  try {
    const { data: requests, error } = await supabaseAdmin
      .from('shop_listing_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ requests: requests || [] });
  } catch (err) {
    console.error('[admin/shop-listing-requests] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const PATCH = withAdminAuth(async (request) => {
  try {
    const { id, status } = await request.json();
    if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('shop_listing_requests')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/shop-listing-requests] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
