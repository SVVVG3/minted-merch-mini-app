// API endpoint to list active bounties
// GET /api/ambassador/bounties
// Returns all active bounties with remaining slots and ambassador's submission count

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAmbassadorStatus, getAmbassadorSubmissionCount } from '@/lib/ambassadorHelpers';

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
    console.log(`🎯 Fetching bounties for FID: ${fid}`);

    // Check if user is an ambassador
    const { isAmbassador, ambassadorId } = await checkAmbassadorStatus(fid);

    if (!isAmbassador) {
      return NextResponse.json({
        success: false,
        error: 'User is not an active ambassador'
      }, { status: 403 });
    }

    // Get all active bounties
    const { data: bounties, error: bountiesError } = await supabaseAdmin
      .from('bounties')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (bountiesError) {
      console.error('❌ Error fetching bounties:', bountiesError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch bounties'
      }, { status: 500 });
    }

    // Filter bounties based on targeting - only show bounties that:
    // 1. Have no target (available to all), OR
    // 2. Target this specific ambassador's FID
    const filteredBounties = bounties.filter(bounty => {
      if (!bounty.target_ambassador_fids || bounty.target_ambassador_fids.length === 0) {
        // No targeting - available to all
        return true;
      }
      // Check if this ambassador's FID is in the target list
      return bounty.target_ambassador_fids.includes(fid);
    });

    console.log(`📊 Filtered bounties: ${bounties.length} total → ${filteredBounties.length} available to FID ${fid}`);

    // Enrich bounties with submission info
    const enrichedBounties = await Promise.all(
      filteredBounties.map(async (bounty) => {
        // Get ambassador's submission count for this bounty
        const ambassadorSubmissions = await getAmbassadorSubmissionCount(ambassadorId, bounty.id);

        // Check if bounty is still accepting submissions
        const slotsRemaining = bounty.max_completions - bounty.current_completions;
        const canSubmit = slotsRemaining > 0 && 
          (bounty.max_submissions_per_ambassador === null || 
           ambassadorSubmissions < bounty.max_submissions_per_ambassador);

        // Check if bounty has expired
        const isExpired = bounty.expires_at && new Date(bounty.expires_at) < new Date();

        return {
          id: bounty.id,
          title: bounty.title,
          description: bounty.description,
          requirements: bounty.requirements,
          proofRequirements: bounty.proof_requirements,
          rewardTokens: bounty.reward_tokens,
          maxCompletions: bounty.max_completions,
          currentCompletions: bounty.current_completions,
          slotsRemaining,
          maxSubmissionsPerAmbassador: bounty.max_submissions_per_ambassador,
          ambassadorSubmissions,
          canSubmit: canSubmit && !isExpired,
          isExpired,
          expiresAt: bounty.expires_at,
          category: bounty.category,
          imageUrl: bounty.image_url,
          bountyType: bounty.bounty_type,
          targetCastUrl: bounty.target_cast_url,
          createdAt: bounty.created_at
        };
      })
    );

    // Filter out expired bounties
    const activeBounties = enrichedBounties.filter(b => !b.isExpired);

    return NextResponse.json({
      success: true,
      data: activeBounties,
      total: activeBounties.length
    });

  } catch (error) {
    console.error('❌ Error in bounties endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

