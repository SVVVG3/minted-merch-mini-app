import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getFeaturedDropForCollection,
  getDropVoteWeight,
  getDropVoteTier,
  getDropEndsAt,
  loadVotableSubmissions,
  mapSubmissionForClient,
  enrichSubmissionsWithProfiles,
  loadUserDropVotes,
  buildUserVoteState,
} from '@/lib/dropHelpers';
import { resolveDueDrops } from '@/lib/dropResolve';
import { closeExpiredLiveDrops, getDropLiveEndsAt } from '@/lib/dropInventory';

// GET /api/drops/status — public drop state for Limited Drops collection page
export async function GET(request) {
  try {
    // Lazy resolve: if any drop is past ends_at, resolve before returning state
    await resolveDueDrops();
    await closeExpiredLiveDrops();

    const featured = await getFeaturedDropForCollection(supabaseAdmin);
    if (!featured) {
      return NextResponse.json({ phase: 'none', drop: null });
    }

    const { drop, phase } = featured;
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const auth = token ? await verifyFarcasterUser(token) : { authenticated: false };

    let viewer = {
      fid: null,
      voteWeight: 1,
      voteTier: 'standard',
      userVotes: [],
      votesUsed: 0,
      votesRemaining: 1,
      hasVoted: false,
      votesFullyAllocated: false,
      userVoteSubmissionId: null,
    };

    if (auth.authenticated) {
      viewer.fid = auth.fid;

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('staked_balance')
        .eq('fid', auth.fid)
        .maybeSingle();

      const stakedBalance = Number(profile?.staked_balance || 0);
      viewer.voteWeight = getDropVoteWeight(stakedBalance);
      viewer.voteTier = getDropVoteTier(stakedBalance);
      viewer.stakedBalance = stakedBalance;
      viewer.isMogul = viewer.voteTier !== 'standard';
      viewer.isWhale = viewer.voteTier === 'whale';

      if (phase === 'active') {
        const votes = await loadUserDropVotes(supabaseAdmin, drop.id, auth.fid);
        const voteState = buildUserVoteState(votes, viewer.voteWeight);
        Object.assign(viewer, voteState);
        viewer.votesRemaining = voteState.votesRemaining;

        const { data: userSub } = await supabaseAdmin
          .from('drop_submissions')
          .select('id, mockup_id, fid, username, mockup_url, product_type, color_name, status, created_at, vote_count')
          .eq('drop_id', drop.id)
          .eq('fid', auth.fid)
          .maybeSingle();

        if (userSub) {
          const [enriched] = await enrichSubmissionsWithProfiles(supabaseAdmin, [userSub]);
          viewer.userSubmission = mapSubmissionForClient(enriched);
        }
      }
    }

    const payload = {
      phase,
      drop: {
        id: drop.id,
        status: drop.status,
        maxUnits: drop.max_units,
        unitsSold: drop.units_sold,
        dropStartsAt: drop.drop_starts_at || null,
        dropEndsAt: getDropLiveEndsAt(drop),
        votingEndsAt: getDropEndsAt(drop),
        submissionsCloseAt: drop.submissions_close_at,
        shopifyProductId: drop.shopify_product_id || null,
        designRequestId: drop.design_request_id || null,
      },
      viewer,
    };

    if (phase === 'active') {
      const enriched = await loadVotableSubmissions(supabaseAdmin, drop.id);
      const entries = enriched.map(mapSubmissionForClient);
      payload.entries = entries;
      payload.finalists = entries; // legacy alias
    }

    if (phase === 'live' || phase === 'sold_out' || phase === 'winner_pending') {
      let winner = null;
      if (drop.winning_submission_id) {
        const { data: winSub } = await supabaseAdmin
          .from('drop_submissions')
          .select('id, mockup_id, fid, username, mockup_url, product_type, color_name')
          .eq('id', drop.winning_submission_id)
          .maybeSingle();
        if (winSub) {
          const [enriched] = await enrichSubmissionsWithProfiles(supabaseAdmin, [winSub]);
          winner = mapSubmissionForClient(enriched);
        }
      }
      payload.winner = winner;
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[drops/status] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
