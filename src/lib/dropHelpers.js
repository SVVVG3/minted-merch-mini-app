/** Returns the weekly drop currently accepting submissions, or null. */
export async function getOpenSubmissionDrop(supabaseAdmin) {
  const now = new Date().toISOString();

  const { data: drops, error } = await supabaseAdmin
    .from('weekly_drops')
    .select('*')
    .eq('status', 'draft')
    .order('created_at', { ascending: false });

  if (error) throw error;

  for (const drop of drops || []) {
    if (drop.submissions_open_at && drop.submissions_open_at > now) continue;
    if (drop.submissions_close_at && drop.submissions_close_at < now) continue;
    return drop;
  }

  return null;
}

/** Returns the weekly drop currently in the voting phase, or null. */
export async function getActiveVotingDrop(supabaseAdmin) {
  const now = new Date().toISOString();

  const { data: drops, error } = await supabaseAdmin
    .from('weekly_drops')
    .select('*')
    .eq('status', 'voting')
    .order('created_at', { ascending: false });

  if (error) throw error;

  for (const drop of drops || []) {
    if (drop.voting_starts_at && drop.voting_starts_at > now) continue;
    if (drop.voting_ends_at && drop.voting_ends_at < now) continue;
    return drop;
  }

  return null;
}

export const MERCH_MOGUL_STAKED_THRESHOLD = 50_000_000;
export const WHALE_STAKED_THRESHOLD = 200_000_000;

/** Vote weight from staked balance: 200M+ → 4, 50M+ → 1, else 0 */
export function getDropVoteWeight(stakedBalance) {
  const staked = Number(stakedBalance) || 0;
  if (staked >= WHALE_STAKED_THRESHOLD) return 4;
  if (staked >= MERCH_MOGUL_STAKED_THRESHOLD) return 1;
  return 0;
}

/** Featured drop for the Limited Drops collection (priority: voting → live → submissions → sold_out). */
export async function getFeaturedDropForCollection(supabaseAdmin) {
  const votingDrop = await getActiveVotingDrop(supabaseAdmin);
  if (votingDrop) return { drop: votingDrop, phase: 'voting' };

  const { data: liveDrops } = await supabaseAdmin
    .from('weekly_drops')
    .select('*')
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(1);
  if (liveDrops?.[0]) return { drop: liveDrops[0], phase: 'live' };

  const submissionDrop = await getOpenSubmissionDrop(supabaseAdmin);
  if (submissionDrop) return { drop: submissionDrop, phase: 'submissions' };

  const { data: soldOutDrops } = await supabaseAdmin
    .from('weekly_drops')
    .select('*')
    .eq('status', 'sold_out')
    .order('created_at', { ascending: false })
    .limit(1);
  if (soldOutDrops?.[0]) return { drop: soldOutDrops[0], phase: 'sold_out' };

  return null;
}

/** Returns the submission id only when one finalist has a strictly higher vote count (> 0). */
export function getSoleLeaderSubmissionId(finalists) {
  if (!finalists?.length) return null;
  const counts = finalists.map(f => f.voteCount ?? f.vote_count ?? 0);
  const max = Math.max(...counts);
  if (max <= 0) return null;
  const leaders = finalists.filter(f => (f.voteCount ?? f.vote_count ?? 0) === max);
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
