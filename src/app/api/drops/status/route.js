import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getFeaturedDropForCollection,
  getDropVoteWeight,
  MERCH_MOGUL_STAKED_THRESHOLD,
} from '@/lib/dropHelpers';

// GET /api/drops/status — public drop state for Limited Drops collection page
export async function GET(request) {
  try {
    const featured = await getFeaturedDropForCollection(supabaseAdmin);
    if (!featured) {
      return NextResponse.json({ phase: 'none', drop: null });
    }

    const { drop, phase } = featured;
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const auth = token ? await verifyFarcasterUser(token) : { authenticated: false };

    let viewer = { isMogul: false, voteWeight: 0, hasVoted: false, userVoteSubmissionId: null };

    if (auth.authenticated) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('staked_balance')
        .eq('fid', auth.fid)
        .maybeSingle();

      const stakedBalance = Number(profile?.staked_balance || 0);
      const voteWeight = getDropVoteWeight(stakedBalance);
      viewer.isMogul = voteWeight > 0;
      viewer.voteWeight = voteWeight;
      viewer.stakedBalance = stakedBalance;

      if (phase === 'voting') {
        const { data: vote } = await supabaseAdmin
          .from('drop_votes')
          .select('submission_id')
          .eq('drop_id', drop.id)
          .eq('voter_fid', auth.fid)
          .maybeSingle();
        if (vote) {
          viewer.hasVoted = true;
          viewer.userVoteSubmissionId = vote.submission_id;
        }
      }
    }

    const payload = {
      phase,
      drop: {
        id: drop.id,
        weekLabel: drop.week_label,
        status: drop.status,
        maxUnits: drop.max_units,
        unitsSold: drop.units_sold,
        votingEndsAt: drop.voting_ends_at,
        submissionsCloseAt: drop.submissions_close_at,
      },
      viewer,
    };

    if (phase === 'voting') {
      const { data: finalists } = await supabaseAdmin
        .from('drop_submissions')
        .select('id, mockup_id, fid, username, mockup_url, product_type, color_name, vote_count')
        .eq('drop_id', drop.id)
        .eq('status', 'finalist')
        .order('vote_count', { ascending: false });

      payload.finalists = (finalists || []).map(f => ({
        id: f.id,
        mockupId: f.mockup_id,
        username: f.username,
        mockupUrl: f.mockup_url,
        productType: f.product_type,
        colorName: f.color_name,
        voteCount: f.vote_count || 0,
      }));
    }

    if (phase === 'live' || phase === 'sold_out') {
      let winner = null;
      if (drop.winning_submission_id) {
        const { data: winSub } = await supabaseAdmin
          .from('drop_submissions')
          .select('id, mockup_id, fid, username, mockup_url, product_type, color_name')
          .eq('id', drop.winning_submission_id)
          .maybeSingle();
        if (winSub) {
          winner = {
            id: winSub.id,
            mockupId: winSub.mockup_id,
            username: winSub.username,
            mockupUrl: winSub.mockup_url,
            productType: winSub.product_type,
            colorName: winSub.color_name,
          };
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
