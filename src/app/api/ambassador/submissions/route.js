// API endpoint to get ambassador's submissions
// GET /api/ambassador/submissions
// Returns all submissions by the authenticated ambassador with bounty details and payout status

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
    console.log(`📋 Fetching submissions for FID: ${fid}`);

    // Check if user is an ambassador
    const { isAmbassador, ambassadorId } = await checkAmbassadorStatus(fid);

    if (!isAmbassador) {
      return NextResponse.json({
        success: false,
        error: 'User is not an active ambassador'
      }, { status: 403 });
    }

    // Get all submissions with bounty details and payout info
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from('bounty_submissions')
      .select(`
        id,
        proof_url,
        proof_description,
        submission_notes,
        status,
        admin_notes,
        reviewed_at,
        submitted_at,
        bounties (
          id,
          title,
          reward_tokens,
          category,
          image_url
        ),
        ambassador_payouts (
          id,
          amount_tokens,
          wallet_address,
          status,
          transaction_hash,
          created_at,
          completed_at
        )
      `)
      .eq('ambassador_id', ambassadorId)
      .order('submitted_at', { ascending: false });

    if (submissionsError) {
      console.error('❌ Error fetching submissions:', submissionsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch submissions'
      }, { status: 500 });
    }

    // Format submissions for response
    const formattedSubmissions = submissions.map(submission => ({
      id: submission.id,
      proofUrl: submission.proof_url,
      proofDescription: submission.proof_description,
      submissionNotes: submission.submission_notes,
      status: submission.status,
      adminNotes: submission.admin_notes,
      reviewedAt: submission.reviewed_at,
      submittedAt: submission.submitted_at,
      bounty: {
        id: submission.bounties?.id,
        title: submission.bounties?.title,
        rewardTokens: submission.bounties?.reward_tokens,
        category: submission.bounties?.category,
        imageUrl: submission.bounties?.image_url
      },
      payout: submission.ambassador_payouts ? {
        id: submission.ambassador_payouts.id,
        amountTokens: submission.ambassador_payouts.amount_tokens,
        walletAddress: submission.ambassador_payouts.wallet_address,
        status: submission.ambassador_payouts.status,
        transactionHash: submission.ambassador_payouts.transaction_hash,
        createdAt: submission.ambassador_payouts.created_at,
        completedAt: submission.ambassador_payouts.completed_at
      } : null
    }));

    // Calculate stats
    const stats = {
      total: formattedSubmissions.length,
      pending: formattedSubmissions.filter(s => s.status === 'pending').length,
      approved: formattedSubmissions.filter(s => s.status === 'approved').length,
      rejected: formattedSubmissions.filter(s => s.status === 'rejected').length
    };

    return NextResponse.json({
      success: true,
      data: formattedSubmissions,
      stats
    });

  } catch (error) {
    console.error('❌ Error in submissions endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

