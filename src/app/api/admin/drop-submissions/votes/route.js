import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';
import { getDropVoteTier, formatDropVoteTierLabel } from '@/lib/dropHelpers';

// GET /api/admin/drop-submissions/votes?submissionId=xxx
export const GET = withAdminAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('submissionId');

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 });
    }

    const { data: submission, error: subErr } = await supabaseAdmin
      .from('drop_submissions')
      .select('id, drop_id, fid, username, product_type, vote_count')
      .eq('id', submissionId)
      .maybeSingle();

    if (subErr || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const { data: votes, error: votesErr } = await supabaseAdmin
      .from('drop_votes')
      .select('voter_fid, vote_weight, created_at')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false });

    if (votesErr) {
      return NextResponse.json({ error: votesErr.message }, { status: 500 });
    }

    const fids = [...new Set((votes || []).map((v) => v.voter_fid).filter(Boolean))];
    let profilesByFid = {};

    if (fids.length) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('fid, username, pfp_url, staked_balance')
        .in('fid', fids);

      profilesByFid = Object.fromEntries((profiles || []).map((p) => [p.fid, p]));
    }

    const voters = (votes || []).map((vote) => {
      const profile = profilesByFid[vote.voter_fid];
      const stakedBalance = Number(profile?.staked_balance || 0);
      const tier = getDropVoteTier(stakedBalance);
      return {
        fid: vote.voter_fid,
        username: profile?.username || null,
        pfpUrl: profile?.pfp_url || null,
        voteWeight: vote.vote_weight || 1,
        voteTier: tier,
        voteTierLabel: formatDropVoteTierLabel(tier, vote.vote_weight || 1),
        votedAt: vote.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        dropId: submission.drop_id,
        fid: submission.fid,
        username: submission.username,
        productType: submission.product_type,
        voteCount: submission.vote_count || 0,
      },
      voters,
      totalWeightedVotes: voters.reduce((sum, v) => sum + (v.voteWeight || 0), 0),
    });
  } catch (err) {
    console.error('[admin/drop-submissions/votes] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
