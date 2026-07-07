import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getActiveDrop,
  getDropEndsAt,
  getDropVoteWeight,
  getDropVoteTier,
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

async function loadVotingPayload(drop, fid = null) {
  const enriched = await loadVotableSubmissions(supabaseAdmin, drop.id);
  const entries = enriched.map(mapSubmissionForClient);

  let userVote = null;
  if (fid) {
    const { data: vote } = await supabaseAdmin
      .from('drop_votes')
      .select('submission_id, vote_weight, created_at')
      .eq('drop_id', drop.id)
      .eq('voter_fid', fid)
      .maybeSingle();
    userVote = vote || null;
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
    userVote: userVote
      ? { submissionId: userVote.submission_id, voteWeight: userVote.vote_weight, votedAt: userVote.created_at }
      : null,
  };
}

// GET /api/drops/vote — active drop entries + user's vote
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
        userVote: null,
        voteWeight,
        voteTier,
        stakedBalance,
      });
    }

    const payload = await loadVotingPayload(drop, auth.fid);
    return NextResponse.json({ ...payload, voteWeight, voteTier, stakedBalance });
  } catch (err) {
    console.error('[drops/vote] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/drops/vote — cast weighted vote (one per user per drop; no self-vote)
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

    const { submissionId } = await request.json();
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

    const { data: existingVote } = await supabaseAdmin
      .from('drop_votes')
      .select('id, submission_id')
      .eq('drop_id', drop.id)
      .eq('voter_fid', auth.fid)
      .maybeSingle();

    if (existingVote) {
      return NextResponse.json({
        error: existingVote.submission_id === submissionId
          ? 'You already voted for this design.'
          : 'You already cast your vote for this drop.',
      }, { status: 409 });
    }

    const { error: insertErr } = await supabaseAdmin
      .from('drop_votes')
      .insert({
        drop_id: drop.id,
        submission_id: submissionId,
        voter_fid: auth.fid,
        vote_weight: voteWeight,
      });

    if (insertErr) {
      console.error('[drops/vote] insert error:', insertErr);
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'You already cast your vote for this drop.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to record vote.' }, { status: 500 });
    }

    const newVoteCount = (submission.vote_count || 0) + voteWeight;
    await supabaseAdmin
      .from('drop_submissions')
      .update({ vote_count: newVoteCount })
      .eq('id', submissionId);

    const payload = await loadVotingPayload(drop, auth.fid);
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
