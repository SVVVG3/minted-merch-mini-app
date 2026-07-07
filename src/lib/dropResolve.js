import { supabaseAdmin } from '@/lib/supabase';
import { getDropEndsAt } from '@/lib/dropHelpers';
import { createPrintfulDraftForDropWinner } from '@/lib/dropPrintful';

/**
 * Resolve a single drop: pick highest vote_count (tie → earliest created_at),
 * mark live, create Printful draft. Idempotent if already resolved.
 */
export async function resolveDrop(dropId) {
  const now = new Date().toISOString();

  const { data: drop, error: dropErr } = await supabaseAdmin
    .from('weekly_drops')
    .select('*')
    .eq('id', dropId)
    .single();

  if (dropErr || !drop) {
    return { success: false, error: 'Drop not found' };
  }

  if (drop.winning_submission_id || drop.status === 'live' || drop.status === 'sold_out' || drop.status === 'closed') {
    return { success: true, skipped: true, dropId, reason: 'already_resolved' };
  }

  const endsAt = getDropEndsAt(drop);
  if (endsAt && endsAt > now) {
    return { success: false, error: 'Drop has not ended yet', dropId };
  }

  const { data: submissions, error: subErr } = await supabaseAdmin
    .from('drop_submissions')
    .select('id, vote_count, created_at, status')
    .eq('drop_id', dropId)
    .in('status', ['submitted', 'finalist'])
    .order('vote_count', { ascending: false })
    .order('created_at', { ascending: true });

  if (subErr) {
    return { success: false, error: subErr.message, dropId };
  }

  if (!submissions?.length) {
    await supabaseAdmin
      .from('weekly_drops')
      .update({ status: 'closed', updated_at: now })
      .eq('id', dropId);
    return { success: true, dropId, closed: true, reason: 'no_submissions' };
  }

  const winner = submissions[0];

  await supabaseAdmin
    .from('drop_submissions')
    .update({ status: 'rejected' })
    .eq('drop_id', dropId)
    .neq('id', winner.id)
    .in('status', ['submitted', 'finalist']);

  await supabaseAdmin
    .from('drop_submissions')
    .update({ status: 'winner' })
    .eq('id', winner.id);

  await supabaseAdmin
    .from('weekly_drops')
    .update({
      winning_submission_id: winner.id,
      status: 'live',
      drop_starts_at: now,
      updated_at: now,
    })
    .eq('id', dropId);

  const printful = await createPrintfulDraftForDropWinner(winner.id, dropId);

  return {
    success: true,
    dropId,
    winnerId: winner.id,
    voteCount: winner.vote_count,
    live: true,
    printful,
  };
}

/** Resolve all drops past their ends_at that are still awaiting resolution. */
export async function resolveDueDrops() {
  const now = new Date().toISOString();

  const { data: drops, error } = await supabaseAdmin
    .from('weekly_drops')
    .select('id, voting_ends_at, submissions_close_at, status, winning_submission_id')
    .in('status', ['draft', 'voting'])
    .is('winning_submission_id', null);

  if (error) throw error;

  const results = [];
  for (const drop of drops || []) {
    const endsAt = getDropEndsAt(drop);
    if (!endsAt || endsAt > now) continue;
    results.push(await resolveDrop(drop.id));
  }

  return results;
}
