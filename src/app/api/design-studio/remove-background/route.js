/**
 * POST /api/design-studio/remove-background
 * Removes the background from an already-uploaded design image using the
 * Photoroom v2 API, then stores the result back to R2 and returns the URL.
 *
 * FREE for Merch Moguls (50M+ $mintedmerch staked), up to MOGUL_DAILY_LIMIT per UTC day.
 * PAID ($0.25 USDC) for everyone else — requires a verified on-chain transaction.
 *
 * Body JSON:
 *   { designUrl: string, transactionHash?: string }
 *   transactionHash is required for non-Moguls.
 */

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { uploadBufferToR2 } from '@/lib/r2Storage';

const MERCH_MOGUL_THRESHOLD = 50_000_000;
const MOGUL_DAILY_LIMIT     = 3;           // free bg removals per UTC calendar day
const BG_REMOVAL_PRICE_USD  = 0.25;
const PHOTOROOM_API_KEY     = process.env.PHOTOROOM_API_KEY;
const PHOTOROOM_URL         = 'https://image-api.photoroom.com/v2/edit';

export async function POST(request) {
  // 1. Authenticate
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth  = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Check Merch Mogul status
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from('profiles')
    .select('staked_balance')
    .eq('fid', auth.fid)
    .single();

  const stakedBalance = Number(profile?.staked_balance || 0);
  const isMerchMogul  = stakedBalance >= MERCH_MOGUL_THRESHOLD;

  // 3. Validate input
  const body = await request.json();
  const { designUrl, transactionHash } = body;
  if (!designUrl) {
    return NextResponse.json({ error: 'designUrl is required' }, { status: 400 });
  }

  // 4a. Daily-use cap for Merch Moguls (free but rate-limited)
  if (isMerchMogul) {
    // Count free uses today (UTC calendar day). Free uses are stored with
    // transaction_hash = NULL; PostgreSQL allows multiple NULLs in a UNIQUE column.
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    const { count: usedToday, error: countErr } = await supabase
      .from('bg_removal_payments')
      .select('id', { count: 'exact', head: true })
      .eq('fid', auth.fid)
      .is('transaction_hash', null)
      .gte('created_at', todayUtc.toISOString());

    if (countErr) {
      console.error(`❌ Daily-limit check failed for FID ${auth.fid}:`, countErr.message);
      // Fail open — don't block the user if the DB query errors
    } else if (usedToday >= MOGUL_DAILY_LIMIT) {
      const remaining = `resets at midnight UTC`;
      console.warn(`🚫 Mogul FID ${auth.fid} hit daily bg-removal limit (${usedToday}/${MOGUL_DAILY_LIMIT})`);
      return NextResponse.json({
        error: `You've used all ${MOGUL_DAILY_LIMIT} free background removals for today. Your limit ${remaining}.`,
        dailyLimitReached: true,
        limit: MOGUL_DAILY_LIMIT,
        usedToday,
      }, { status: 429 });
    }
  }

  // 4b. Payment gate for non-Moguls
  if (!isMerchMogul) {
    if (!transactionHash) {
      return NextResponse.json({
        error: 'A $0.25 USDC payment is required for non-Merch Moguls.',
        requiresPayment: true,
        amount: BG_REMOVAL_PRICE_USD,
      }, { status: 402 });
    }

    // Replay protection: check if this tx hash was already used
    const { data: existing } = await supabase
      .from('bg_removal_payments')
      .select('id')
      .eq('transaction_hash', transactionHash)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: 'This transaction has already been used for a background removal.',
      }, { status: 409 });
    }

    // Verify the on-chain USDC transfer to the merchant wallet
    try {
      const { verifyTransaction } = await import('@/lib/order');
      await verifyTransaction(transactionHash, BG_REMOVAL_PRICE_USD);
    } catch (verifyErr) {
      console.error(`❌ BG removal payment verification failed for FID ${auth.fid}:`, verifyErr.message);
      return NextResponse.json({
        error: `Payment verification failed: ${verifyErr.message}`,
      }, { status: 402 });
    }

    // Record the payment to prevent replay
    await supabase.from('bg_removal_payments').insert({
      fid:              auth.fid,
      transaction_hash: transactionHash,
    });

    console.log(`💳 BG removal paid ($0.25 USDC) by FID ${auth.fid}, tx: ${transactionHash}`);
  }

  // 5. Check Photoroom API key
  if (!PHOTOROOM_API_KEY) {
    console.error('❌ PHOTOROOM_API_KEY not configured');
    return NextResponse.json({ error: 'Background removal is not configured.' }, { status: 503 });
  }

  // 6. Call Photoroom API
  const photoroomParams = new URLSearchParams({
    imageUrl:         designUrl,
    removeBackground: 'true',
    outputSize:       'originalImage',
  });

  console.log(`🖼️ Photoroom bg-remove for FID ${auth.fid} (${isMerchMogul ? 'free/Mogul' : 'paid'}): ${designUrl.slice(0, 60)}...`);

  let photoroomRes;
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 30_000);
    photoroomRes     = await fetch(`${PHOTOROOM_URL}?${photoroomParams}`, {
      method: 'GET',
      headers: { 'x-api-key': PHOTOROOM_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    console.error('❌ Photoroom fetch error:', err.message);
    return NextResponse.json({ error: 'Background removal service unavailable. Please try again.' }, { status: 503 });
  }

  if (!photoroomRes.ok) {
    let detail = `Photoroom error ${photoroomRes.status}`;
    try {
      const errBody = await photoroomRes.json();
      detail = errBody?.error?.message || errBody?.error?.detail || detail;
    } catch { /* ignore */ }
    console.error(`❌ Photoroom API error for FID ${auth.fid}:`, detail);
    return NextResponse.json({ error: `Background removal failed: ${detail}` }, { status: 502 });
  }

  // 7. Upload result PNG to R2
  const imageBuffer = Buffer.from(await photoroomRes.arrayBuffer());
  const key         = `user-designs/${auth.fid}-bg-removed-${Date.now()}.png`;

  let publicUrl;
  try {
    publicUrl = await uploadBufferToR2(imageBuffer, key, 'image/png');
  } catch (err) {
    console.error('❌ R2 upload error after bg removal:', err.message);
    return NextResponse.json({ error: 'Failed to save processed image. Please try again.' }, { status: 500 });
  }

  // Record free Mogul use (transaction_hash = NULL) so the daily counter is accurate
  if (isMerchMogul) {
    const { error: insertErr } = await supabase
      .from('bg_removal_payments')
      .insert({ fid: auth.fid, transaction_hash: null });
    if (insertErr) {
      // Non-fatal — log but don't fail the request
      console.error(`⚠️ Failed to record Mogul free bg-removal for FID ${auth.fid}:`, insertErr.message);
    }
  }

  console.log(`✅ Background removed + uploaded for FID ${auth.fid}: ${key}`);
  return NextResponse.json({ success: true, url: publicUrl });
}
