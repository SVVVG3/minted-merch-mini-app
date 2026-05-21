import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

/**
 * Fetches all active notification token FIDs from Neynar for this mini app,
 * then updates has_notifications in the profiles table accordingly.
 *
 * Only touches profiles where staked_balance > 0 to keep scope focused
 * and avoid unnecessary DB writes for non-stakers.
 */
async function handler(request) {
  try {
    if (!NEYNAR_API_KEY) {
      return Response.json({ success: false, error: 'NEYNAR_API_KEY not configured' }, { status: 500 });
    }

    // ── Step 1: Fetch all active token FIDs from Neynar ──────────────────────
    const activeNeynarFids = new Set();
    let cursor = null;
    let totalTokensFetched = 0;
    let pages = 0;

    do {
      const params = new URLSearchParams({ limit: '150' });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(
        `https://api.neynar.com/v2/farcaster/frame/notification_tokens?${params}`,
        { headers: { 'x-api-key': NEYNAR_API_KEY } }
      );

      if (!res.ok) {
        const err = await res.text();
        return Response.json({ success: false, error: `Neynar API error ${res.status}: ${err}` }, { status: 502 });
      }

      const data = await res.json();
      const tokens = data.notification_tokens || [];
      totalTokensFetched += tokens.length;
      pages++;

      for (const token of tokens) {
        if (token.status === 'enabled' && token.fid) {
          activeNeynarFids.add(Number(token.fid));
        }
      }

      cursor = data.next?.cursor || null;
    } while (cursor);

    console.log(`📡 Neynar: ${totalTokensFetched} total tokens across ${pages} pages, ${activeNeynarFids.size} unique active FIDs`);

    // ── Step 2: Fetch all staker FIDs from Supabase ──────────────────────────
    let stakerRows = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('fid, has_notifications')
        .gt('staked_balance', 0)
        .order('fid', { ascending: true })
        .range(from, from + batchSize - 1);

      if (error) {
        return Response.json({ success: false, error: `Supabase error: ${error.message}` }, { status: 500 });
      }

      stakerRows = stakerRows.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    console.log(`📊 Supabase: ${stakerRows.length} staker profiles fetched`);

    // ── Step 3: Diff and update ───────────────────────────────────────────────
    const toEnable  = stakerRows.filter(r => !r.has_notifications && activeNeynarFids.has(r.fid)).map(r => r.fid);
    const toDisable = stakerRows.filter(r => r.has_notifications  && !activeNeynarFids.has(r.fid)).map(r => r.fid);
    const alreadyCorrect = stakerRows.length - toEnable.length - toDisable.length;

    console.log(`🔄 Changes needed — enable: ${toEnable.length}, disable: ${toDisable.length}, already correct: ${alreadyCorrect}`);

    // Update in batches of 500
    const CHUNK = 500;

    if (toEnable.length > 0) {
      for (let i = 0; i < toEnable.length; i += CHUNK) {
        const chunk = toEnable.slice(i, i + CHUNK);
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            has_notifications: true,
            notification_status_updated_at: new Date().toISOString(),
            notification_status_source: 'neynar_sync',
          })
          .in('fid', chunk);
        if (error) console.error('Error enabling notifications:', error);
      }
    }

    if (toDisable.length > 0) {
      for (let i = 0; i < toDisable.length; i += CHUNK) {
        const chunk = toDisable.slice(i, i + CHUNK);
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            has_notifications: false,
            notification_status_updated_at: new Date().toISOString(),
            notification_status_source: 'neynar_sync',
          })
          .in('fid', chunk);
        if (error) console.error('Error disabling notifications:', error);
      }
    }

    // Re-count stakers with active notifications after the update
    const { count: activeStakerCount } = await supabaseAdmin
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .gt('staked_balance', 0)
      .eq('has_notifications', true);

    const creditsSavedPerRun = toDisable.length * 100;
    const creditsSavedPerMonth = creditsSavedPerRun * 30;

    console.log(`✅ Sync complete. Active stakers after sync: ${activeStakerCount}`);

    return Response.json({
      success: true,
      neynarActiveTokenFids: activeNeynarFids.size,
      totalStakersChecked: stakerRows.length,
      enabled: toEnable.length,
      disabled: toDisable.length,
      alreadyCorrect,
      activeStakersAfterSync: activeStakerCount,
      creditsSavedPerRun,
      creditsSavedPerMonth,
    });

  } catch (error) {
    console.error('Error in sync-notification-tokens:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const POST = withAdminAuth(handler);
