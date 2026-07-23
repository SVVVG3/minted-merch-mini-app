import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  applyDropVoteAllocation,
  buildUserVoteState,
  getActiveDrop,
  getDropEndsAt,
  getDropVoteWeight,
  getDropVoteTier,
  loadUserDropVotes,
  loadVotableSubmissions,
  mapSubmissionForClient,
} from '@/lib/dropHelpers';

async function getVoterProfile(fid) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('staked_balance, username')
    .eq('fid', fid)
    .maybeSingle();

  const stakedBalance = Number(profile?.staked_balance || 0);
  const voteWeight = getDropVoteWeight(stakedBalance);
  const voteTier = getDropVoteTier(stakedBalance);
  return { profile, stakedBalance, voteWeight, voteTier };
}

async function loadVotingPayload(drop, fid = null, maxVoteWeight = 1) {
  const enriched = await loadVotableSubmissions(supabaseAdmin, drop.id);
  const entries = enriched.map(mapSubmissionForClient);

  let voteState = buildUserVoteState([], maxVoteWeight);
  if (fid) {
    const votes = await loadUserDropVotes(supabaseAdmin, drop.id, fid);
    voteState = buildUserVoteState(votes, maxVoteWeight);
  }

  return {
    drop: {
      id: drop.id,
      status: drop.status,
      votingEndsAt: getDropEndsAt(drop),
      maxUnits: drop.max_units,
    },
    entries,
    // Legacy alias for clients not yet updated
    finalists: entries,
    ...voteState,
  };
}

// GET /api/drops/vote — active drop entries + user's vote allocations
export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { stakedBalance, voteWeight, voteTier } = await getVoterProfile(auth.fid);

    const drop = await getActiveDrop(supabaseAdmin);
    if (!drop) {
      return NextResponse.json({
        drop: null,
        entries: [],
        finalists: [],
        userVotes: [],
        userVote: null,
        votesUsed: 0,
        votesRemaining: voteWeight,
        hasVoted: false,
        voteWeight,
        voteTier,
        stakedBalance,
      });
    }

    const payload = await loadVotingPayload(drop, auth.fid, voteWeight);
    return NextResponse.json({ ...payload, voteWeight, voteTier, stakedBalance });
  } catch (err) {
    console.error('[drops/vote] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/drops/vote — allocate weighted vote points (split across entries for Moguls/Whales)
export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { voteWeight, voteTier, stakedBalance } = await getVoterProfile(auth.fid);

    const drop = await getActiveDrop(supabaseAdmin);
    if (!drop) {
      return NextResponse.json({ error: 'No drop is open right now.' }, { status: 403 });
    }

    const body = await request.json();
    const { submissionId, points, addPoints } = body;
    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 });
    }

    const { data: submission } = await supabaseAdmin
      .from('drop_submissions')
      .select('id, drop_id, fid, status, vote_count')
      .eq('id', submissionId)
      .eq('drop_id', drop.id)
      .maybeSingle();

    if (!submission || !['submitted', 'finalist'].includes(submission.status)) {
      return NextResponse.json({ error: 'This design is not available for voting.' }, { status: 400 });
    }

    if (String(submission.fid) === String(auth.fid)) {
      return NextResponse.json({ error: 'You cannot vote on your own design.' }, { status: 403 });
    }

    const existingVotes = await loadUserDropVotes(supabaseAdmin, drop.id, auth.fid);
    const currentOnSubmission =
      existingVotes.find((vote) => vote.submission_id === submissionId)?.vote_weight || 0;

    let targetPoints;
    if (typeof points === 'number' && Number.isFinite(points)) {
      targetPoints = points;
    } else if (typeof addPoints === 'number' && Number.isFinite(addPoints)) {
      targetPoints = currentOnSubmission + addPoints;
    } else if (voteWeight === 1) {
      targetPoints = 1;
    } else {
      targetPoints = currentOnSubmission + 1;
    }

    try {
      await applyDropVoteAllocation({
        supabaseAdmin,
        dropId: drop.id,
        voterFid: auth.fid,
        submissionId,
        targetPoints,
        maxVoteWeight: voteWeight,
      });
    } catch (allocErr) {
      const status = allocErr.statusCode || 500;
      return NextResponse.json({ error: allocErr.message || 'Failed to record vote.' }, { status });
    }

    const payload = await loadVotingPayload(drop, auth.fid, voteWeight);
    return NextResponse.json({
      success: true,
      voteWeight,
      voteTier,
      stakedBalance,
      ...payload,
    });
  } catch (err) {
    console.error('[drops/vote] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
