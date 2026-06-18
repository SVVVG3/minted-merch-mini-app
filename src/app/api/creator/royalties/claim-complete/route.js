/**
 * POST /api/creator/royalties/claim-complete
 * Marks the pending royalties as settled after successful on-chain claim.
 * Body: { royaltyIds: string[], transactionHash: string }
 * SECURITY: Requires JWT auth + ownership verification via creator_fid
 */

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authResult = await verifyFarcasterUser(token);
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const fid = authResult.fid;
    const body = await request.json();
    const { royaltyIds, transactionHash } = body;

    if (!royaltyIds?.length) {
      return NextResponse.json({ success: false, error: 'royaltyIds required' }, { status: 400 });
    }
    if (!transactionHash) {
      return NextResponse.json({ success: false, error: 'transactionHash required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Security: only update royalties that belong to this creator and are still pending
    const { data: updated, error } = await supabase
      .from('creator_royalties')
      .update({
        status:           'settled',
        settled_at:       new Date().toISOString(),
        transaction_hash: transactionHash,
      })
      .in('id', royaltyIds)
      .eq('creator_fid', fid)   // ownership check
      .eq('status', 'pending')  // only settle pending ones
      .select('id');

    if (error) {
      console.error('❌ Error settling royalties:', error);
      return NextResponse.json({ success: false, error: 'Failed to settle royalties' }, { status: 500 });
    }

    console.log(`✅ Settled ${updated?.length || 0} royalties for FID ${fid} — TX: ${transactionHash}`);

    return NextResponse.json({
      success: true,
      settledCount: updated?.length || 0,
      transactionHash,
    });
  } catch (err) {
    console.error('❌ /api/creator/royalties/claim-complete POST:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
