import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getActiveVotingDrop,
  getDropVoteWeight,
  enrichSubmissionsWithProfiles,
  MERCH_MOGUL_STAKED_THRESHOLD,
  WHALE_STAKED_THRESHOLD,
} from '@/lib/dropHelpers';

async function getMogulProfile(fid) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('staked_balance, username')
    .eq('fid', fid)
    .maybeSingle();

  const stakedBalance = Number(profile?.staked_balance || 0);
  return { profile, stakedBalance };
}

async function loadVotingPayload(drop, fid = null) {
  const { data: finalists, error } = await supabaseAdmin
    .from('drop_submissions')
    .select('id, mockup_id, fid, username, mockup_url, product_type, color_name, vote_count, created_at')
    .eq('drop_id', drop.id)
    .eq('status', 'finalist')
    .order('vote_count', { ascending: false });

  if (error) throw error;

  const enriched = await enrichSubmissionsWithProfiles(supabaseAdmin, finalists || []);

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
      votingEndsAt: drop.voting_ends_at,
      maxUnits: drop.max_units,
    },
    finalists: enriched.map(f => ({
      id: f.id,
      mockupId: f.mockup_id,
      fid: f.fid,
      username: f.username,
      pfpUrl: f.pfp_url,
      mockupUrl: f.mockup_url,
      productType: f.product_type,
      colorName: f.color_name,
      voteCount: f.vote_count || 0,
    })),
    userVote: userVote
      ? { submissionId: userVote.submission_id, voteWeight: userVote.vote_weight, votedAt: userVote.created_at }
      : null,
  };
}

// GET /api/drops/vote — active voting drop, finalists, and user's vote (Moguls only)
export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { stakedBalance } = await getMogulProfile(auth.fid);
    const voteWeight = getDropVoteWeight(stakedBalance);
    const isWhale = stakedBalance >= WHALE_STAKED_THRESHOLD;

    if (voteWeight === 0) {
      return NextResponse.json({
        error: 'Merch Mogul status required (50M+ $mintedmerch staked)',
        stakedBalance,
        requiredStaked: MERCH_MOGUL_STAKED_THRESHOLD,
      }, { status: 403 });
    }

    const drop = await getActiveVotingDrop(supabaseAdmin);
    if (!drop) {
      return NextResponse.json({
        drop: null,
        finalists: [],
        userVote: null,
        voteWeight,
        isWhale,
        stakedBalance,
      });
    }

    const payload = await loadVotingPayload(drop, auth.fid);
    return NextResponse.json({ ...payload, voteWeight, isWhale, stakedBalance });
  } catch (err) {
    console.error('[drops/vote] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/drops/vote — cast weighted vote for a finalist (one vote per Mogul per drop)
export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { stakedBalance } = await getMogulProfile(auth.fid);
    const voteWeight = getDropVoteWeight(stakedBalance);
    if (voteWeight === 0) {
      return NextResponse.json({
        error: 'Merch Mogul status required (50M+ $mintedmerch staked)',
      }, { status: 403 });
    }

    const drop = await getActiveVotingDrop(supabaseAdmin);
    if (!drop) {
      return NextResponse.json({ error: 'No drop is open for voting right now.' }, { status: 403 });
    }

    const { submissionId } = await request.json();
    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 });
    }

    const { data: submission } = await supabaseAdmin
      .from('drop_submissions')
      .select('id, drop_id, status, vote_count')
      .eq('id', submissionId)
      .eq('drop_id', drop.id)
      .maybeSingle();

    if (!submission || submission.status !== 'finalist') {
      return NextResponse.json({ error: 'Only finalist designs can be voted on.' }, { status: 400 });
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
      ...payload,
    });
  } catch (err) {
    console.error('[drops/vote] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
