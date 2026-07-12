import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request, { params }) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const { transactionHash } = await request.json();

  if (!transactionHash) {
    return NextResponse.json({ success: false, error: 'Transaction hash is required' }, { status: 400 });
  }

  try {
    const { data: payout, error } = await supabaseAdmin
      .from('drop_creator_payouts')
      .select('id, creator_fid, status, amount_tokens, wallet_address')
      .eq('id', id)
      .eq('creator_fid', auth.fid)
      .single();

    if (error || !payout) {
      return NextResponse.json({ success: false, error: 'Payout not found' }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('drop_creator_payouts')
      .update({
        status: 'completed',
        transaction_hash: transactionHash,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .in('status', ['claimable', 'completed']);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to update payout' }, { status: 500 });
    }

    console.log(
      `✅ Drop creator payout ${id} completed — ${payout.amount_tokens} $mintedmerch claimed by FID ${auth.fid}`
    );

    return NextResponse.json({ success: true, transactionHash });
  } catch (err) {
    console.error('[drops/creator-payouts/claim-complete] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
