import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/design-studio/order-mockup?orderNumber=1650&productType=tshirt
 *
 * Returns the custom mockup URL for a given Shopify order / product type.
 *
 * Strategy (most-reliable first):
 *  1. Look up design_order_requests by fid + shopify_order_number.
 *     shopify_order_number is written by createPrintfulTemplate (fire-and-forget),
 *     so it may not be available yet for brand-new orders.
 *  2. Fall back to design_studio_mockups by fid + product_type (most recent).
 *     This table is always written at mockup-generation time, so it's reliable
 *     even when Printful template creation hasn't finished.
 */
export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber'); // e.g. "#1650" or "1650"
  const productType = searchParams.get('productType'); // e.g. "tshirt" | "hoodie" | "hat"

  if (!orderNumber && !productType) {
    return NextResponse.json({ error: 'orderNumber or productType is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ mockupUrl: null });

    // ── Strategy 1: design_order_requests by order number ──────────────────
    if (orderNumber) {
      const num = orderNumber.replace(/^#/, '');
      const { data, error } = await supabase
        .from('design_order_requests')
        .select('mockup_url')
        .eq('fid', auth.fid)
        .or(`shopify_order_number.eq.#${num},shopify_order_number.eq.${num}`)
        .not('mockup_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.mockup_url) {
        console.log(`🎨 order-mockup [strategy 1] — order #${num}, FID ${auth.fid}: found`);
        return NextResponse.json({ mockupUrl: data.mockup_url });
      }

      console.log(`🔍 order-mockup [strategy 1] — order #${num}, FID ${auth.fid}: not found, trying strategy 2`);
    }

    // ── Strategy 2: design_studio_mockups by product type ──────────────────
    if (productType) {
      const { data: mockupData, error: mockupError } = await supabase
        .from('design_studio_mockups')
        .select('mockup_url')
        .eq('fid', auth.fid)
        .eq('product_type', productType)
        .not('mockup_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mockupError && mockupData?.mockup_url) {
        console.log(`🎨 order-mockup [strategy 2] — productType ${productType}, FID ${auth.fid}: found`);
        return NextResponse.json({ mockupUrl: mockupData.mockup_url });
      }

      console.log(`⚠️ order-mockup [strategy 2] — productType ${productType}, FID ${auth.fid}: not found`);
    }

    return NextResponse.json({ mockupUrl: null });
  } catch (err) {
    console.error('order-mockup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
