/**
 * One-time script to check how many staker FIDs have active Neynar notification tokens.
 *
 * Run with: node scripts/check-notification-tokens.mjs
 *
 * Requires NEYNAR_API_KEY, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY
 * to be set in your .env.local file.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually (no dotenv dependency needed in Node 20+)
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch {
    console.error('Could not read .env.local — make sure env vars are set');
  }
}

loadEnv();

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEYNAR_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: NEYNAR_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ── Step 1: Fetch all active notification tokens from Neynar ──────────────────

async function fetchAllActiveTokenFids() {
  console.log('\n📡 Fetching all notification tokens from Neynar...');
  const activeFids = new Set();
  let cursor = null;
  let page = 0;
  let totalTokens = 0;

  do {
    page++;
    const params = new URLSearchParams({ limit: '150' });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/frame/notification_tokens?${params}`,
      { headers: { 'x-api-key': NEYNAR_API_KEY } }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Neynar API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const tokens = data.notification_tokens || [];
    totalTokens += tokens.length;

    for (const token of tokens) {
      if (token.status === 'enabled' && token.fid) {
        activeFids.add(token.fid);
      }
    }

    cursor = data.next?.cursor || null;
    process.stdout.write(`  Page ${page}: ${tokens.length} tokens fetched, ${activeFids.size} unique active FIDs so far...\r`);
  } while (cursor);

  console.log(`\n✅ Done. ${totalTokens} total tokens, ${activeFids.size} unique FIDs with active tokens.`);
  return activeFids;
}

// ── Step 2: Fetch staker FIDs from Supabase ───────────────────────────────────

async function fetchStakerFids() {
  console.log('\n📊 Fetching staker FIDs from Supabase...');
  let allFids = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=fid&has_notifications=eq.true&staked_balance=gt.0&order=fid.asc&limit=${batchSize}&offset=${from}`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase error ${res.status}: ${err}`);
    }

    const rows = await res.json();
    allFids = allFids.concat(rows.map(r => r.fid));
    if (rows.length < batchSize) break;
    from += batchSize;
  }

  console.log(`✅ Found ${allFids.length} staker FIDs with has_notifications=true in DB.`);
  return allFids;
}

// ── Step 3: Compare and report ────────────────────────────────────────────────

async function main() {
  console.log('=== Neynar Notification Token Audit ===');

  const [activeTokenFids, stakerFids] = await Promise.all([
    fetchAllActiveTokenFids(),
    fetchStakerFids(),
  ]);

  const stakerSet = new Set(stakerFids);

  const activeStakers    = stakerFids.filter(fid => activeTokenFids.has(fid));
  const staleStakers     = stakerFids.filter(fid => !activeTokenFids.has(fid));
  const nonStakerActives = [...activeTokenFids].filter(fid => !stakerSet.has(fid));

  console.log('\n=== Results ===');
  console.log(`Total staker FIDs in your DB (has_notifications=true, staked_balance>0): ${stakerFids.length}`);
  console.log(`  ✅ Active in Neynar (will receive notification):  ${activeStakers.length}`);
  console.log(`  ❌ Stale in your DB (token revoked/disabled):     ${staleStakers.length}`);
  console.log(`  💸 Credits wasted per run on stale FIDs:          ${staleStakers.length * 100} credits`);
  console.log(`  💰 Monthly savings if cleaned up (daily sends):   ${staleStakers.length * 100 * 30} credits`);
  console.log('');
  console.log(`Total active Neynar token FIDs for your app: ${activeTokenFids.size}`);
  console.log(`  Non-stakers with active tokens (not in current send list): ${nonStakerActives.length}`);

  if (staleStakers.length > 0) {
    console.log('\n💡 Recommendation: Run the following SQL in Supabase to fix stale entries:');
    // Print in chunks to avoid huge output
    const chunks = [];
    for (let i = 0; i < staleStakers.length; i += 100) {
      chunks.push(staleStakers.slice(i, i + 100).join(', '));
    }
    console.log(`\nUPDATE profiles SET has_notifications = false WHERE fid IN (\n  ${staleStakers.join(', ')}\n);`);
  } else {
    console.log('\n✅ No stale entries found — your DB is already in sync with Neynar.');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
