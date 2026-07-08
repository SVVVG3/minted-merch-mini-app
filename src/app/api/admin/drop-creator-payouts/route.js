import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { finalizeEndedDropPayouts } from '@/lib/dropCreatorPayouts';

export const GET = withAdminAuth(async () => {
  try {
    await finalizeEndedDropPayouts();

    const { data: payouts, error } = await supabaseAdmin
      .from('drop_creator_payouts')
      .select(`
        id,
        drop_id,
        creator_fid,
        units_sold,
        amount_tokens,
        status,
        wallet_address,
        transaction_hash,
        claimed_at,
        created_at,
        weekly_drops:drop_id (
          week_label,
          status,
          units_sold
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const fids = [...new Set((payouts || []).map((p) => p.creator_fid).filter(Boolean))];
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

    const enriched = (payouts || []).map((p) => ({
      ...p,
      weekLabel: p.weekly_drops?.week_label || null,
      dropStatus: p.weekly_drops?.status || null,
      profiles: profileMap[p.creator_fid] || null,
    }));

    return NextResponse.json({ payouts: enriched });
  } catch (err) {
    console.error('[admin/drop-creator-payouts] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
