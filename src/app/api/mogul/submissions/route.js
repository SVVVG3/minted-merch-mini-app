// API endpoint to get mogul's bounty submissions
// GET /api/mogul/submissions
// SECURITY: Requires JWT authentication and 50M+ token balance

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkMogulStatus } from '@/lib/mogulHelpers';

// Interaction bounty types
const INTERACTION_BOUNTY_TYPES = ['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_engagement'];

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
    console.log(`📋 Fetching mogul submissions for FID: ${fid}`);

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

    // Get submissions for this mogul (interaction bounties only)
    const { data: submissions, error } = await supabaseAdmin
      .from('bounty_submissions')
      .select(`
        id,
        bounty_id,
        status,
        proof_url,
        proof_description,
        submitted_at,
        reviewed_at,
        bounty:bounties!inner(
          id,
          title,
          reward_tokens,
          bounty_type,
          target_cast_url
        )
      `)
      .eq('ambassador_fid', fid)
      .in('bounty.bounty_type', INTERACTION_BOUNTY_TYPES)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching mogul submissions:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch submissions'
      }, { status: 500 });
    }

    // Format submissions
    const formattedSubmissions = submissions.map(s => ({
      id: s.id,
      bountyId: s.bounty_id,
      bountyTitle: s.bounty?.title,
      bountyType: s.bounty?.bounty_type,
      rewardTokens: s.bounty?.reward_tokens,
      targetCastUrl: s.bounty?.target_cast_url,
      status: s.status,
      submittedAt: s.submitted_at,
      reviewedAt: s.reviewed_at
    }));

    return NextResponse.json({
      success: true,
      data: formattedSubmissions,
      total: formattedSubmissions.length
    });

  } catch (error) {
    console.error('❌ Error in mogul submissions endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

