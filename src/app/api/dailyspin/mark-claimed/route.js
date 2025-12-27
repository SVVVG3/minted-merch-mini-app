import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';

/**
 * POST /api/dailyspin/mark-claimed
 * 
 * Mark spin winnings as claimed after successful on-chain transaction.
 * 
 * Body:
 * - winningIds: Array of winning IDs to mark as claimed
 * - txHash: Transaction hash of the claim transaction
 * 
 * Security:
 * - Verifies authenticated user owns the winnings
 * - Prevents claiming already-claimed winnings
 * - Records transaction hash for audit trail
 * 
 * Requires authentication.
 */
export async function POST(request) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    // Authenticate user
    const fid = await getAuthenticatedFid(request);
    if (!fid) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { winningIds, txHash } = body;

    // Validate inputs
    if (!winningIds || !Array.isArray(winningIds) || winningIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'winningIds array required' },
        { status: 400 }
      );
    }

    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Transaction hash required' },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] 📝 Marking ${winningIds.length} winnings as claimed for FID ${fid}`);

    // SECURITY: Verify all winnings belong to this user and are unclaimed
    const { data: winnings, error: fetchError } = await supabaseAdmin
      .from('spin_winnings')
      .select('id, user_fid, claimed, claim_tx_hash')
      .in('id', winningIds);

    if (fetchError) {
      console.error(`[${requestId}] Error fetching winnings:`, fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify winnings' },
        { status: 500 }
      );
    }

    if (!winnings || winnings.length !== winningIds.length) {
      console.error(`[${requestId}] ❌ Some winnings not found`);
      return NextResponse.json(
        { success: false, error: 'Some winnings not found' },
        { status: 400 }
      );
    }

    // Verify ownership and claim status
    for (const winning of winnings) {
      // SECURITY: User can only claim their own winnings
      if (winning.user_fid !== fid) {
        console.error(`[${requestId}] ❌ FID ${fid} attempted to claim winning ${winning.id} owned by FID ${winning.user_fid}`);
        return NextResponse.json(
          { success: false, error: 'Cannot claim winnings that belong to another user' },
          { status: 403 }
        );
      }

      // SECURITY: Prevent double-claiming
      if (winning.claimed) {
        console.warn(`[${requestId}] ⚠️ Winning ${winning.id} already claimed with tx ${winning.claim_tx_hash}`);
        return NextResponse.json(
          { success: false, error: 'Some winnings have already been claimed' },
          { status: 400 }
        );
      }
    }

    // Check if this transaction hash has been used before (replay protection)
    const { data: existingTx, error: txCheckError } = await supabaseAdmin
      .from('spin_winnings')
      .select('id')
      .eq('claim_tx_hash', txHash)
      .limit(1)
      .single();

    if (existingTx) {
      console.error(`[${requestId}] ❌ Transaction hash ${txHash} already used`);
      return NextResponse.json(
        { success: false, error: 'Transaction hash already used' },
        { status: 400 }
      );
    }

    // Mark all winnings as claimed
    const now = new Date().toISOString();
    const { data: updatedWinnings, error: updateError } = await supabaseAdmin
      .from('spin_winnings')
      .update({
        claimed: true,
        claim_tx_hash: txHash,
        claimed_at: now
      })
      .in('id', winningIds)
      .eq('user_fid', fid) // Extra safety: only update user's own winnings
      .eq('claimed', false) // Extra safety: only update unclaimed winnings
      .select('id, amount, spin_tokens(symbol)');

    if (updateError) {
      console.error(`[${requestId}] Error updating winnings:`, updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to mark as claimed' },
        { status: 500 }
      );
    }

    console.log(`[${requestId}] ✅ Marked ${updatedWinnings?.length || 0} winnings as claimed`);

    // Calculate totals for response
    const claimedSummary = {};
    for (const winning of updatedWinnings || []) {
      const symbol = winning.spin_tokens?.symbol || 'UNKNOWN';
      if (!claimedSummary[symbol]) {
        claimedSummary[symbol] = {
          symbol,
          count: 0,
          totalAmount: BigInt(0)
        };
      }
      claimedSummary[symbol].count += 1;
      claimedSummary[symbol].totalAmount += BigInt(winning.amount);
    }

    // Convert BigInt to string for JSON
    const summary = Object.values(claimedSummary).map(s => ({
      symbol: s.symbol,
      count: s.count,
      totalAmount: s.totalAmount.toString()
    }));

    return NextResponse.json({
      success: true,
      claimed: {
        count: updatedWinnings?.length || 0,
        txHash,
        claimedAt: now,
        summary
      }
    });

  } catch (error) {
    console.error(`[${requestId}] ❌ Error in /api/dailyspin/mark-claimed:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

