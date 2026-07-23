export const MERCH_MOGUL_STAKED_THRESHOLD = 50_000_000;
export const WHALE_STAKED_THRESHOLD = 200_000_000;

/** Deadline for submit + vote window (voting_ends_at preferred; submissions_close_at fallback). */
export function getDropEndsAt(drop) {
  if (!drop) return null;
  return drop.voting_ends_at || drop.submissions_close_at || null;
}

/** Vote weight: everyone 1×, Mogul 5×, Whale 10× (replacement tiers, not additive). */
export function getDropVoteWeight(stakedBalance) {
  const staked = Number(stakedBalance) || 0;
  if (staked >= WHALE_STAKED_THRESHOLD) return 10;
  if (staked >= MERCH_MOGUL_STAKED_THRESHOLD) return 5;
  return 1;
}

export function getDropVoteTier(stakedBalance) {
  const staked = Number(stakedBalance) || 0;
  if (staked >= WHALE_STAKED_THRESHOLD) return 'whale';
  if (staked >= MERCH_MOGUL_STAKED_THRESHOLD) return 'mogul';
  return 'standard';
}

export function formatDropVoteTierLabel(tier, voteWeight) {
  if (tier === 'whale') return `🐋 ${voteWeight} votes (Whale)`;
  if (tier === 'mogul') return `⭐ ${voteWeight} votes (Mogul)`;
  return `${voteWeight} vote`;
}

/** All vote rows a user cast on a drop (may span multiple submissions). */
export async function loadUserDropVotes(supabaseAdmin, dropId, voterFid) {
  const { data, error } = await supabaseAdmin
    .from('drop_votes')
    .select('submission_id, vote_weight, created_at')
    .eq('drop_id', dropId)
    .eq('voter_fid', voterFid)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function sumDropVoteWeight(votes) {
  return (votes || []).reduce((sum, row) => sum + (row.vote_weight || 0), 0);
}

/** Client-friendly voting budget for the current user on a drop. */
export function buildUserVoteState(votes, maxVoteWeight) {
  const userVotes = (votes || []).map((row) => ({
    submissionId: row.submission_id,
    voteWeight: row.vote_weight || 0,
    votedAt: row.created_at,
  }));
  const votesUsed = sumDropVoteWeight(votes);
  const votesRemaining = Math.max(0, maxVoteWeight - votesUsed);
  const primaryVote = userVotes.length === 1 ? userVotes[0] : null;

  return {
    userVotes,
    votesUsed,
    votesRemaining,
    hasVoted: votesUsed > 0,
    votesFullyAllocated: votesRemaining === 0 && votesUsed > 0,
    // Legacy single-vote fields
    userVote: primaryVote,
    userVoteSubmissionId: primaryVote?.submissionId || null,
  };
}

async function adjustSubmissionVoteCount(supabaseAdmin, submissionId, delta) {
  if (!delta) return;

  const { data: submission, error } = await supabaseAdmin
    .from('drop_submissions')
    .select('vote_count')
    .eq('id', submissionId)
    .single();

  if (error || !submission) {
    throw new Error('Submission not found while updating vote count');
  }

  const nextCount = Math.max(0, (submission.vote_count || 0) + delta);
  await supabaseAdmin
    .from('drop_submissions')
    .update({ vote_count: nextCount })
    .eq('id', submissionId);
}

/**
 * Set how many points a voter allocates to one submission (0 removes that allocation).
 * Total allocated points cannot exceed maxVoteWeight.
 */
export async function applyDropVoteAllocation({
  supabaseAdmin,
  dropId,
  voterFid,
  submissionId,
  targetPoints,
  maxVoteWeight,
}) {
  let points = Math.max(0, Math.floor(Number(targetPoints) || 0));
  if (maxVoteWeight === 1 && points > 1) points = 1;

  const { data: userVotes, error: loadErr } = await supabaseAdmin
    .from('drop_votes')
    .select('id, submission_id, vote_weight')
    .eq('drop_id', dropId)
    .eq('voter_fid', voterFid);

  if (loadErr) throw loadErr;

  const existingOnSubmission = (userVotes || []).find((v) => v.submission_id === submissionId);
  const currentOnSubmission = existingOnSubmission?.vote_weight || 0;
  const otherTotal = (userVotes || [])
    .filter((v) => v.submission_id !== submissionId)
    .reduce((sum, v) => sum + (v.vote_weight || 0), 0);

  if (points + otherTotal > maxVoteWeight) {
    const err = new Error(
      `You only have ${Math.max(0, maxVoteWeight - otherTotal)} point${maxVoteWeight - otherTotal === 1 ? '' : 's'} left to allocate.`
    );
    err.statusCode = 400;
    throw err;
  }

  // Standard voters: moving their single point clears any prior pick.
  if (maxVoteWeight === 1 && points === 1 && otherTotal > 0) {
    for (const vote of userVotes || []) {
      if (vote.submission_id === submissionId) continue;
      await adjustSubmissionVoteCount(supabaseAdmin, vote.submission_id, -(vote.vote_weight || 0));
      await supabaseAdmin.from('drop_votes').delete().eq('id', vote.id);
    }
  }

  const delta = points - currentOnSubmission;

  if (points === 0) {
    if (existingOnSubmission) {
      await adjustSubmissionVoteCount(supabaseAdmin, submissionId, -currentOnSubmission);
      await supabaseAdmin.from('drop_votes').delete().eq('id', existingOnSubmission.id);
    }
    return;
  }

  if (existingOnSubmission) {
    const { error: updateErr } = await supabaseAdmin
      .from('drop_votes')
      .update({ vote_weight: points })
      .eq('id', existingOnSubmission.id);
    if (updateErr) throw updateErr;
  } else {
    const { error: insertErr } = await supabaseAdmin.from('drop_votes').insert({
      drop_id: dropId,
      submission_id: submissionId,
      voter_fid: voterFid,
      vote_weight: points,
    });
    if (insertErr) throw insertErr;
  }

  if (delta !== 0) {
    await adjustSubmissionVoteCount(supabaseAdmin, submissionId, delta);
  }
}

/**
 * Active drop: submit + vote open until ends_at, no winner yet.
 * Status draft or voting (legacy admin flows may still use voting).
 */
export async function getActiveDrop(supabaseAdmin) {
  const now = new Date().toISOString();

  const { data: drops, error } = await supabaseAdmin
    .from('weekly_drops')
    .select('*')
    .in('status', ['draft', 'voting'])
    .is('winning_submission_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  for (const drop of drops || []) {
    const endsAt = getDropEndsAt(drop);
    if (endsAt && endsAt <= now) continue;
    if (drop.submissions_open_at && drop.submissions_open_at > now) continue;
    return drop;
  }

  return null;
}

/** @deprecated Use getActiveDrop */
export async function getOpenSubmissionDrop(supabaseAdmin) {
  return getActiveDrop(supabaseAdmin);
}

/** @deprecated Use getActiveDrop */
export async function getActiveVotingDrop(supabaseAdmin) {
  return getActiveDrop(supabaseAdmin);
}

/** Drop with winner chosen but not yet live in shop (legacy: status still voting). */
export async function getWinnerPendingDrop(supabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from('weekly_drops')
    .select('*')
    .eq('status', 'voting')
    .not('winning_submission_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

/** Featured drop for the Limited Drops collection. */
export async function getFeaturedDropForCollection(supabaseAdmin) {
  const activeDrop = await getActiveDrop(supabaseAdmin);
  if (activeDrop) return { drop: activeDrop, phase: 'active' };

  const winnerPendingDrop = await getWinnerPendingDrop(supabaseAdmin);
  if (winnerPendingDrop) return { drop: winnerPendingDrop, phase: 'winner_pending' };

  const { data: liveDrops } = await supabaseAdmin
    .from('weekly_drops')
    .select('*')
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(1);
  if (liveDrops?.[0]) return { drop: liveDrops[0], phase: 'live' };

  const { data: soldOutDrops } = await supabaseAdmin
    .from('weekly_drops')
    .select('*')
    .eq('status', 'sold_out')
    .order('created_at', { ascending: false })
    .limit(1);
  if (soldOutDrops?.[0]) return { drop: soldOutDrops[0], phase: 'sold_out' };

  return null;
}

/** All votable submissions for a drop, sorted by votes then earliest submit. */
export async function loadVotableSubmissions(supabaseAdmin, dropId) {
  const { data, error } = await supabaseAdmin
    .from('drop_submissions')
    .select('id, mockup_id, fid, username, mockup_url, product_type, color_name, vote_count, status, created_at')
    .eq('drop_id', dropId)
    .in('status', ['submitted', 'finalist'])
    .order('vote_count', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return enrichSubmissionsWithProfiles(supabaseAdmin, data || []);
}

export function mapSubmissionForClient(row) {
  return {
    id: row.id,
    mockupId: row.mockup_id,
    fid: row.fid,
    username: row.username,
    pfpUrl: row.pfp_url,
    mockupUrl: row.mockup_url,
    productType: row.product_type,
    colorName: row.color_name,
    voteCount: row.vote_count || 0,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Returns the submission id only when one entry has a strictly higher vote count (> 0). */
export function getSoleLeaderSubmissionId(entries) {
  if (!entries?.length) return null;
  const counts = entries.map(f => f.voteCount ?? f.vote_count ?? 0);
  const max = Math.max(...counts);
  if (max <= 0) return null;
  const leaders = entries.filter(f => (f.voteCount ?? f.vote_count ?? 0) === max);
  return leaders.length === 1 ? leaders[0].id : null;
}

/** Attach profile pfp_url (and username fallback) to submission-like rows. */
export async function enrichSubmissionsWithProfiles(supabaseAdmin, rows) {
  if (!rows?.length) return rows || [];
  const fids = [...new Set(rows.map(r => r.fid).filter(Boolean))];
  if (!fids.length) return rows;

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('fid, username, pfp_url')
    .in('fid', fids);

  const byFid = Object.fromEntries((profiles || []).map(p => [p.fid, p]));

  return rows.map(row => ({
    ...row,
    username: row.username || byFid[row.fid]?.username || null,
    pfp_url: byFid[row.fid]?.pfp_url || null,
  }));
}
