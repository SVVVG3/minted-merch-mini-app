// API endpoint to list ALL bounties for Minted Merch Missions
// GET /api/mogul/bounties
// Returns:
// - Interaction bounties (farcaster_like, recast, comment, engagement) → Available to 50M+ holders OR 1M+ stakers
// - Custom bounties → Available to 50M+ STAKERS only (or targeted users)
// SECURITY: Requires JWT authentication

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { 
  checkMissionsEligibility, 
  checkCustomBountyEligibility,
  getMogulSubmissionCount,
  CUSTOM_BOUNTY_STAKED_THRESHOLD 
} from '@/lib/mogulHelpers';

// Interaction bounty types - available to all missions-eligible users
const INTERACTION_BOUNTY_TYPES = ['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_like_recast', 'farcaster_engagement'];

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
    console.log(`🎯 Fetching missions bounties for FID: ${fid}`);

    // Check eligibility for different bounty types
    const { isEligible, isMogul, isStaker, tokenBalance, stakedBalance } = await checkMissionsEligibility(fid);
    
    // Check if eligible for custom bounties (50M+ staked)
    const isEligibleForCustom = stakedBalance >= CUSTOM_BOUNTY_STAKED_THRESHOLD;

    if (!isEligible) {
      return NextResponse.json({
        success: false,
        error: 'Missions eligibility required (50M+ $mintedmerch tokens OR 1M+ staked)',
        tokenBalance,
        stakedBalance,
        requirements: {
          mogulThreshold: 50_000_000,
          stakerThreshold: 1_000_000
        }
      }, { status: 403 });
    }

    // Get ALL active bounties
    const { data: allBounties, error: bountiesError } = await supabaseAdmin
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

    console.log(`📊 Found ${allBounties.length} total active bounties`);

    // Filter bounties based on type and eligibility
    const filteredBounties = allBounties.filter(bounty => {
      const isInteraction = INTERACTION_BOUNTY_TYPES.includes(bounty.bounty_type);
      const isCustom = bounty.bounty_type === 'custom';

      if (isInteraction) {
        // Interaction bounties - all missions-eligible users can see
        return true;
      }

      if (isCustom) {
        // Custom bounties - check targeting first
        if (bounty.target_ambassador_fids && bounty.target_ambassador_fids.length > 0) {
          // Targeted bounty - only show to targeted users
          return bounty.target_ambassador_fids.includes(fid);
        }
        // Non-targeted - only show to 50M+ stakers
        return isEligibleForCustom;
      }

      // Unknown bounty type - don't show
      return false;
    });

    console.log(`📊 Filtered to ${filteredBounties.length} bounties for FID ${fid}`);

    // Get all user's submissions for these bounties to check status
    const bountyIds = filteredBounties.map(b => b.id);
    const { data: userSubmissionsData } = await supabaseAdmin
      .from('bounty_submissions')
      .select('bounty_id, status, submitted_at, admin_notes')
      .eq('ambassador_fid', fid)
      .in('bounty_id', bountyIds)
      .order('submitted_at', { ascending: false });

    // Create a map of latest submission info per bounty
    const submissionInfoMap = {};
    for (const submission of (userSubmissionsData || [])) {
      // Only keep the most recent submission per bounty
      if (!submissionInfoMap[submission.bounty_id]) {
        submissionInfoMap[submission.bounty_id] = {
          status: submission.status,
          adminNotes: submission.admin_notes
        };
      }
    }

    // Enrich bounties with submission info
    const enrichedBounties = await Promise.all(
      filteredBounties.map(async (bounty) => {
        // Get user's submission count for this bounty
        const userSubmissions = await getMogulSubmissionCount(fid, bounty.id);

        // Get the user's latest submission info for this bounty
        const submissionInfo = submissionInfoMap[bounty.id] || null;
        const latestSubmissionStatus = submissionInfo?.status || null;
        const hasPendingSubmission = latestSubmissionStatus === 'pending';
        const hasApprovedSubmission = latestSubmissionStatus === 'approved';
        const hasRejectedSubmission = latestSubmissionStatus === 'rejected';
        const rejectionReason = hasRejectedSubmission ? submissionInfo?.adminNotes : null;

        // Check if bounty is still accepting submissions
        const slotsRemaining = bounty.max_completions - bounty.current_completions;
        
        // Can submit if: slots available, not at limit, AND (no pending/approved submission OR bounty allows multiple)
        const atSubmissionLimit = bounty.max_submissions_per_ambassador !== null && 
                                   userSubmissions >= bounty.max_submissions_per_ambassador;
        const canSubmit = slotsRemaining > 0 && 
          !atSubmissionLimit && 
          !hasPendingSubmission; // Can't submit if already has pending

        // Check if bounty has expired
        const isExpired = bounty.expires_at && new Date(bounty.expires_at) < new Date();

        const isInteraction = INTERACTION_BOUNTY_TYPES.includes(bounty.bounty_type);

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
          maxSubmissionsPerUser: bounty.max_submissions_per_ambassador,
          userSubmissions,
          userSubmissionStatus: latestSubmissionStatus,
          hasPendingSubmission,
          hasApprovedSubmission,
          hasRejectedSubmission,
          rejectionReason,
          canSubmit: canSubmit && !isExpired,
          isExpired,
          expiresAt: bounty.expires_at,
          bountyType: bounty.bounty_type,
          isInteractionBounty: isInteraction,
          isCustomBounty: bounty.bounty_type === 'custom',
          targetCastUrl: bounty.target_cast_url,
          imageUrl: bounty.image_url,
          category: bounty.category,
          createdAt: bounty.created_at
        };
      })
    );

    // Filter out expired bounties
    const availableBounties = enrichedBounties.filter(b => !b.isExpired);

    // Separate into interaction and custom for frontend display
    const interactionBounties = availableBounties.filter(b => b.isInteractionBounty);
    const customBounties = availableBounties.filter(b => b.isCustomBounty);

    return NextResponse.json({
      success: true,
      data: availableBounties,
      interactionBounties,
      customBounties,
      total: availableBounties.length,
      eligibility: {
        isEligible,
        isMogul,
        isStaker,
        isEligibleForCustom,
        tokenBalance,
        stakedBalance,
        customBountyThreshold: CUSTOM_BOUNTY_STAKED_THRESHOLD
      }
    });

  } catch (error) {
    console.error('❌ Error in mogul bounties endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
