import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { finalizeEndedDropPayouts } from '@/lib/dropCreatorPayouts';

/** GET /api/drops/creator-payouts — list drop earnings for the signed-in creator */
export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
        claim_deadline,
        transaction_hash,
        claimed_at,
        created_at,
        weekly_drops:drop_id (
          week_label,
          status
        )
      `)
      .eq('creator_fid', auth.fid)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatted = (payouts || []).map((p) => {
      const { weekly_drops, ...rest } = p;
      return {
        ...rest,
        weekLabel: weekly_drops?.week_label || 'Limited Drop',
        dropStatus: weekly_drops?.status || null,
        amountTokens: Number(p.amount_tokens),
      };
    });

    return NextResponse.json({ success: true, payouts: formatted });
  } catch (err) {
    console.error('[drops/creator-payouts] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
