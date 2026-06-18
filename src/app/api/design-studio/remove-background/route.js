/**
 * POST /api/design-studio/remove-background
 * Removes the background from an already-uploaded design image using the
 * Photoroom v2 API, then stores the result back to R2 and returns the URL.
 *
 * EXCLUSIVE TO MERCH MOGULS (50M+ $mintedmerch staked).
 *
 * Body JSON: { designUrl: string }
 */

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { uploadBufferToR2 } from '@/lib/r2Storage';

const MERCH_MOGUL_THRESHOLD = 50_000_000;
const PHOTOROOM_API_KEY     = process.env.PHOTOROOM_API_KEY;
const PHOTOROOM_URL         = 'https://image-api.photoroom.com/v2/edit';

export async function POST(request) {
  // 1. Authenticate
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth  = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify Merch Mogul status
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from('profiles')
    .select('staked_balance')
    .eq('fid', auth.fid)
    .single();

  const stakedBalance = Number(profile?.staked_balance || 0);
  if (stakedBalance < MERCH_MOGUL_THRESHOLD) {
    return NextResponse.json({
      error: 'Background removal is exclusive to Merch Moguls (50M+ $mintedmerch staked).',
      required: MERCH_MOGUL_THRESHOLD,
      current: stakedBalance,
    }, { status: 403 });
  }

  // 3. Validate input
  const body = await request.json();
  const { designUrl } = body;
  if (!designUrl) {
    return NextResponse.json({ error: 'designUrl is required' }, { status: 400 });
  }

  if (!PHOTOROOM_API_KEY) {
    console.error('❌ PHOTOROOM_API_KEY not configured');
    return NextResponse.json({ error: 'Background removal is not configured.' }, { status: 503 });
  }

  // 4. Call Photoroom API
  // Use GET endpoint with imageUrl — keeps background transparent, preserves original dimensions
  const photoroomParams = new URLSearchParams({
    imageUrl:         designUrl,
    removeBackground: 'true',
    outputSize:       'originalImage',
  });

  console.log(`🖼️ Photoroom bg-remove for FID ${auth.fid}: ${designUrl.slice(0, 60)}...`);

  let photoroomRes;
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 30_000); // 30s timeout
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

  // 5. Upload result PNG to R2
  const imageBuffer = Buffer.from(await photoroomRes.arrayBuffer());
  const key         = `user-designs/${auth.fid}-bg-removed-${Date.now()}.png`;

  let publicUrl;
  try {
    publicUrl = await uploadBufferToR2(imageBuffer, key, 'image/png');
  } catch (err) {
    console.error('❌ R2 upload error after bg removal:', err.message);
    return NextResponse.json({ error: 'Failed to save processed image. Please try again.' }, { status: 500 });
  }

  console.log(`✅ Background removed + uploaded for FID ${auth.fid}: ${key}`);
  return NextResponse.json({ success: true, url: publicUrl });
}
