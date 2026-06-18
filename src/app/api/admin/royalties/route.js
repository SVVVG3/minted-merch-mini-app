import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async () => {
  try {
    const { data: royalties, error } = await supabaseAdmin
      .from('creator_royalties')
      .select('id, creator_fid, buyer_fid, design_order_request_id, mintedmerch_amount, status, created_at, settled_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = royalties || [];
    const allFids = [...new Set([
      ...rows.map(r => r.creator_fid),
      ...rows.map(r => r.buyer_fid),
    ].filter(Boolean))];

    let profileMap = {};
    if (allFids.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('fid, username, display_name, pfp_url, staked_balance')
        .in('fid', allFids);
      if (profiles) profileMap = Object.fromEntries(profiles.map(p => [p.fid, p]));
    }

    const enriched = rows.map(r => ({
      ...r,
      creator: profileMap[r.creator_fid] || null,
      buyer: profileMap[r.buyer_fid] || null,
    }));

    // Aggregate totals per creator
    const totals = {};
    for (const r of rows) {
      if (!totals[r.creator_fid]) {
        totals[r.creator_fid] = { pending: 0, settled: 0 };
      }
      if (r.status === 'pending') totals[r.creator_fid].pending += Number(r.mintedmerch_amount);
      else totals[r.creator_fid].settled += Number(r.mintedmerch_amount);
    }

    return NextResponse.json({ royalties: enriched, totals });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/royalties — mark royalties as settled
export const PATCH = withAdminAuth(async (request) => {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('creator_royalties')
      .update({ status: 'settled', settled_at: new Date().toISOString() })
      .in('id', ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, settledCount: ids.length });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
