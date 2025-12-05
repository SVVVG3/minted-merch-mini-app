// API endpoint to get Merch Mogul's payouts
// GET /api/mogul/payouts
// Returns all payouts for the authenticated mogul with status and claim details
// SECURITY: Requires JWT authentication and 50M+ token balance

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkMogulStatus } from '@/lib/mogulHelpers';

export async function GET(request) {
  try {
    // SECURITY: Verify JWT authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authResult = await verifyFarcasterUser(token);

    if (!authResult.authenticated) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication token'
      }, { status: 401 });
    }

    const fid = authResult.fid;
    console.log(`💰 Fetching mogul payouts for FID: ${fid}`);

    // SECURITY: Check if user is a Merch Mogul
    const { isMogul, tokenBalance } = await checkMogulStatus(fid);

    if (!isMogul) {
      return NextResponse.json({
        success: false,
        error: 'Merch Mogul status required (50M+ $mintedmerch tokens)',
        tokenBalance,
        requiredBalance: 50_000_000
      }, { status: 403 });
    }

    // Get all payouts for this mogul (using bounty_submissions.ambassador_fid)
    // Mogul payouts have ambassador_id = NULL but bounty_submissions.ambassador_fid = fid
    const { data: payouts, error: payoutsError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select(`
        id,
        amount_tokens,
        wallet_address,
        status,
        transaction_hash,
        claim_deadline,
        created_at,
        completed_at,
        notes,
        bounty_submissions!inner (
          id,
          ambassador_fid,
          proof_url,
          proof_description,
          bounties (
            id,
            title,
            bounty_type,
            target_cast_url
          )
        )
      `)
      .is('ambassador_id', null) // Mogul payouts have NULL ambassador_id
      .eq('bounty_submissions.ambassador_fid', fid)
      .order('created_at', { ascending: false });

    if (payoutsError) {
      console.error('❌ Error fetching mogul payouts:', payoutsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch payouts'
      }, { status: 500 });
    }

    // Format payouts for response
    const formattedPayouts = payouts.map(payout => ({
      id: payout.id,
      amountTokens: payout.amount_tokens,
      walletAddress: payout.wallet_address,
      status: payout.status,
      transactionHash: payout.transaction_hash,
      claimDeadline: payout.claim_deadline,
      createdAt: payout.created_at,
      completedAt: payout.completed_at,
      notes: payout.notes,
      bounty: payout.bounty_submissions?.bounties ? {
        id: payout.bounty_submissions.bounties.id,
        title: payout.bounty_submissions.bounties.title,
        bountyType: payout.bounty_submissions.bounties.bounty_type,
        targetCastUrl: payout.bounty_submissions.bounties.target_cast_url
      } : null
    }));

    // Calculate stats
    const stats = {
      total: formattedPayouts.length,
      claimable: formattedPayouts.filter(p => p.status === 'claimable').length,
      pending: formattedPayouts.filter(p => p.status === 'pending').length,
      completed: formattedPayouts.filter(p => p.status === 'completed').length,
      totalEarned: formattedPayouts
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + (p.amountTokens || 0), 0),
      claimableAmount: formattedPayouts
        .filter(p => p.status === 'claimable')
        .reduce((sum, p) => sum + (p.amountTokens || 0), 0)
    };

    console.log(`✅ Found ${formattedPayouts.length} payouts for mogul FID ${fid}`);

    return NextResponse.json({
      success: true,
      data: formattedPayouts,
      stats
    });

  } catch (error) {
    console.error('❌ Error in mogul payouts endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

