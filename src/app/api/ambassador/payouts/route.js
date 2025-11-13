// API endpoint to get ambassador's payouts
// GET /api/ambassador/payouts
// Returns all payouts for the authenticated ambassador with status and transaction details

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAmbassadorStatus } from '@/lib/ambassadorHelpers';

export async function GET(request) {
  try {
    // Verify authentication
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
    console.log(`💰 Fetching payouts for FID: ${fid}`);

    // Check if user is an ambassador
    const { isAmbassador, ambassadorId } = await checkAmbassadorStatus(fid);

    if (!isAmbassador) {
      return NextResponse.json({
        success: false,
        error: 'User is not an active ambassador'
      }, { status: 403 });
    }

    // Get all payouts with related submission and bounty details (including proof)
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
        bounty_submissions (
          id,
          proof_url,
          proof_description,
          bounties (
            id,
            title,
            category,
            image_url
          )
        )
      `)
      .eq('ambassador_id', ambassadorId)
      .order('created_at', { ascending: false });

    if (payoutsError) {
      console.error('❌ Error fetching payouts:', payoutsError);
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
      proofUrl: payout.bounty_submissions?.proof_url || null,
      proofDescription: payout.bounty_submissions?.proof_description || null,
      bounty: payout.bounty_submissions?.bounties ? {
        id: payout.bounty_submissions.bounties.id,
        title: payout.bounty_submissions.bounties.title,
        category: payout.bounty_submissions.bounties.category,
        imageUrl: payout.bounty_submissions.bounties.image_url
      } : null
    }));

    // Calculate stats
    const stats = {
      total: formattedPayouts.length,
      pending: formattedPayouts.filter(p => p.status === 'pending').length,
      processing: formattedPayouts.filter(p => p.status === 'processing').length,
      completed: formattedPayouts.filter(p => p.status === 'completed').length,
      failed: formattedPayouts.filter(p => p.status === 'failed').length,
      totalEarned: formattedPayouts
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + BigInt(p.amountTokens || 0), BigInt(0))
        .toString(),
      pendingAmount: formattedPayouts
        .filter(p => p.status === 'pending' || p.status === 'processing')
        .reduce((sum, p) => sum + BigInt(p.amountTokens || 0), BigInt(0))
        .toString()
    };

    return NextResponse.json({
      success: true,
      data: formattedPayouts,
      stats
    });

  } catch (error) {
    console.error('❌ Error in payouts endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

