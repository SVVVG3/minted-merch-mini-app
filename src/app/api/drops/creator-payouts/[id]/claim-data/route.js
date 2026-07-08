import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isSignatureExpired } from '@/lib/claimSignatureService';

export async function GET(request, { params }) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const { data: payout, error } = await supabaseAdmin
      .from('drop_creator_payouts')
      .select(`
        *,
        weekly_drops:drop_id (week_label)
      `)
      .eq('id', id)
      .eq('creator_fid', auth.fid)
      .single();

    if (error || !payout) {
      return NextResponse.json({ success: false, error: 'Payout not found' }, { status: 404 });
    }

    if (payout.status !== 'claimable') {
      return NextResponse.json({
        success: false,
        error: 'Payout is not claimable',
        currentStatus: payout.status,
      }, { status: 400 });
    }

    if (!payout.wallet_address) {
      return NextResponse.json({
        success: false,
        error: 'No wallet address configured',
        message: 'Add a wallet to your profile before claiming',
      }, { status: 400 });
    }

    if (isSignatureExpired(payout.claim_deadline)) {
      return NextResponse.json({
        success: false,
        error: 'Claim deadline has passed',
      }, { status: 400 });
    }

    if (!payout.claim_signature) {
      return NextResponse.json({
        success: false,
        error: 'Claim signature not available',
      }, { status: 500 });
    }

    let claimData;
    try {
      claimData = JSON.parse(payout.claim_signature);
      if (!claimData.req || !claimData.signature) throw new Error('Invalid format');
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid claim data' }, { status: 500 });
    }

    const contractAddress = process.env.AIRDROP_CONTRACT_ADDRESS;

    return NextResponse.json({
      success: true,
      data: {
        payoutId: payout.id,
        payoutType: 'drop_creator',
        weekLabel: payout.weekly_drops?.week_label || 'Limited Drop',
        req: claimData.req,
        signature: claimData.signature,
        contractAddress,
        chainId: 8453,
        walletAddress: payout.wallet_address,
        amountTokens: payout.amount_tokens.toString(),
        tokenAddress: claimData.req.tokenAddress,
        deadline: payout.claim_deadline,
        unitsSold: payout.units_sold,
      },
    });
  } catch (err) {
    console.error('[drops/creator-payouts/claim-data] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
