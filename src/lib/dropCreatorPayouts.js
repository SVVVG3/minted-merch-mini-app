import { supabaseAdmin } from '@/lib/supabase';
import { getAmbassadorWalletAddress } from '@/lib/ambassadorHelpers';
import {
  generateClaimSignature,
  getDefaultClaimDeadline,
} from '@/lib/claimSignatureService';

export const DROP_CREATOR_PAYOUT_PER_UNIT = 5_000_000;

/**
 * Create or update a claimable payout when a drop ends (sold_out or closed).
 * Idempotent — safe to call multiple times; skips completed payouts.
 */
export async function finalizeDropCreatorPayout(dropId) {
  const { data: drop, error } = await supabaseAdmin
    .from('weekly_drops')
    .select(`
      id,
      week_label,
      status,
      units_sold,
      creator_payout_per_unit,
      winning_submission_id
    `)
    .eq('id', dropId)
    .single();

  if (error || !drop) {
    return { success: false, error: 'Drop not found' };
  }

  if (!['sold_out', 'closed'].includes(drop.status)) {
    return { success: true, skipped: true, reason: 'drop_still_active' };
  }

  const unitsSold = drop.units_sold || 0;
  if (unitsSold <= 0 || !drop.winning_submission_id) {
    return { success: true, skipped: true, reason: 'no_sales_or_winner' };
  }

  const { data: existing } = await supabaseAdmin
    .from('drop_creator_payouts')
    .select('id, status, claim_signature')
    .eq('drop_id', dropId)
    .maybeSingle();

  if (existing?.status === 'completed') {
    return { success: true, payoutId: existing.id, alreadyFinalized: true };
  }

  const { data: winner, error: winnerErr } = await supabaseAdmin
    .from('drop_submissions')
    .select('fid')
    .eq('id', drop.winning_submission_id)
    .single();

  if (winnerErr || !winner?.fid) {
    return { success: false, error: 'Winning submission not found' };
  }

  const perUnit = Number(drop.creator_payout_per_unit || DROP_CREATOR_PAYOUT_PER_UNIT);
  const amountTokens = unitsSold * perUnit;
  const walletAddress = await getAmbassadorWalletAddress(winner.fid);

  let payoutRow;

  if (existing) {
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('drop_creator_payouts')
      .update({
        creator_fid: winner.fid,
        units_sold: unitsSold,
        amount_tokens: amountTokens,
        wallet_address: walletAddress,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (updErr) return { success: false, error: updErr.message };
    payoutRow = updated;
  } else {
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('drop_creator_payouts')
      .insert({
        drop_id: dropId,
        creator_fid: winner.fid,
        units_sold: unitsSold,
        amount_tokens: amountTokens,
        wallet_address: walletAddress,
        status: 'pending',
      })
      .select()
      .single();

    if (insErr) return { success: false, error: insErr.message };
    payoutRow = inserted;
  }

  if (
    walletAddress &&
    payoutRow.status !== 'completed' &&
    payoutRow.status !== 'claimable'
  ) {
    try {
      const deadline = getDefaultClaimDeadline();
      const amountInWei = (BigInt(amountTokens) * BigInt(10 ** 18)).toString();
      const signatureData = await generateClaimSignature({
        wallet: walletAddress,
        amount: amountInWei,
        payoutId: `drop-${payoutRow.id}`,
        deadline,
      });

      const serializableReq = {
        ...signatureData.req,
        expirationTimestamp: signatureData.req.expirationTimestamp.toString(),
        contents: signatureData.req.contents.map((content) => ({
          ...content,
          amount: content.amount.toString(),
        })),
      };

      const claimDataJson = JSON.stringify({
        req: serializableReq,
        signature: signatureData.signature,
      });

      const { data: claimable, error: sigErr } = await supabaseAdmin
        .from('drop_creator_payouts')
        .update({
          claim_signature: claimDataJson,
          claim_deadline: deadline.toISOString(),
          wallet_address: walletAddress,
          status: 'claimable',
        })
        .eq('id', payoutRow.id)
        .select()
        .single();

      if (sigErr) {
        console.error('[dropCreatorPayouts] signature update failed:', sigErr);
      } else {
        payoutRow = claimable;
        console.log(
          `💰 Drop creator payout claimable — drop ${dropId}, FID ${winner.fid}, ${amountTokens.toLocaleString()} $MM (${unitsSold} units)`
        );
      }
    } catch (sigError) {
      console.error('[dropCreatorPayouts] claim signature failed:', sigError);
    }
  } else if (!walletAddress) {
    console.warn(
      `⚠️ Drop payout ${payoutRow.id} pending — no wallet for creator FID ${winner.fid}`
    );
  }

  return {
    success: true,
    payoutId: payoutRow.id,
    status: payoutRow.status,
    amountTokens,
    unitsSold,
  };
}

/** Finalize payouts for all ended drops missing a claimable/completed record. */
export async function finalizeEndedDropPayouts() {
  const { data: drops, error } = await supabaseAdmin
    .from('weekly_drops')
    .select('id')
    .in('status', ['sold_out', 'closed']);

  if (error) throw error;

  const results = [];
  for (const drop of drops || []) {
    try {
      const result = await finalizeDropCreatorPayout(drop.id);
      if (!result.skipped) results.push({ dropId: drop.id, ...result });
    } catch (err) {
      console.error(`[dropCreatorPayouts] finalize failed for ${drop.id}:`, err);
    }
  }
  return results;
}
