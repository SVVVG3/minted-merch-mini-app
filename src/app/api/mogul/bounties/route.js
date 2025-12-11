// API endpoint to list interaction bounties for Minted Merch Missions
// GET /api/mogul/bounties
// Returns only interaction bounties (farcaster_like, farcaster_recast, farcaster_comment, farcaster_engagement)
// SECURITY: Requires JWT authentication and missions eligibility (50M+ tokens OR 1M+ staked)

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkMissionsEligibility, getMogulSubmissionCount } from '@/lib/mogulHelpers';

// Interaction bounty types
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

    // SECURITY: Check if user is eligible for missions (50M+ tokens OR 1M+ staked)
    const { isEligible, tokenBalance, stakedBalance } = await checkMissionsEligibility(fid);

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

    // Get all active INTERACTION bounties only
    const { data: bounties, error: bountiesError } = await supabaseAdmin
      .from('bounties')
      .select('*')
      .eq('is_active', true)
      .in('bounty_type', INTERACTION_BOUNTY_TYPES)
      .order('created_at', { ascending: false });

    if (bountiesError) {
      console.error('❌ Error fetching bounties:', bountiesError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch bounties'
      }, { status: 500 });
    }

    // Filter bounties - for moguls, we don't use target_ambassador_fids
    // All interaction bounties are available to all moguls
    console.log(`📊 Found ${bounties.length} active interaction bounties`);

    // Enrich bounties with submission info
    const enrichedBounties = await Promise.all(
      bounties.map(async (bounty) => {
        // Get mogul's submission count for this bounty
        const mogulSubmissions = await getMogulSubmissionCount(fid, bounty.id);

        // Check if bounty is still accepting submissions
        const slotsRemaining = bounty.max_completions - bounty.current_completions;
        const canSubmit = slotsRemaining > 0 && 
          (bounty.max_submissions_per_ambassador === null || 
           mogulSubmissions < bounty.max_submissions_per_ambassador);

        // Check if bounty has expired
        const isExpired = bounty.expires_at && new Date(bounty.expires_at) < new Date();

        return {
          id: bounty.id,
          title: bounty.title,
          description: bounty.description,
          requirements: bounty.requirements,
          rewardTokens: bounty.reward_tokens,
          maxCompletions: bounty.max_completions,
          currentCompletions: bounty.current_completions,
          slotsRemaining,
          maxSubmissionsPerUser: bounty.max_submissions_per_ambassador,
          userSubmissions: mogulSubmissions,
          canSubmit: canSubmit && !isExpired,
          isExpired,
          expiresAt: bounty.expires_at,
          bountyType: bounty.bounty_type,
          targetCastUrl: bounty.target_cast_url,
          createdAt: bounty.created_at
        };
      })
    );

    // Filter out expired bounties and bounties where user reached limit
    const availableBounties = enrichedBounties.filter(b => !b.isExpired);

    return NextResponse.json({
      success: true,
      data: availableBounties,
      total: availableBounties.length,
      mogulStatus: {
        isMogul: true,
        tokenBalance
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

