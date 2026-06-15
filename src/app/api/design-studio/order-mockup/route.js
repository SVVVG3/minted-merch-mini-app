import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/design-studio/order-mockup
 *   ?orderNumber=1650        — Shopify order number, "#" optional
 *   &designRequestId=uuid    — design_order_requests.id (new orders)
 *   &productType=tshirt      — "tshirt" | "hoodie" | "hat"
 *   &orderCreatedAt=ISO      — orders.created_at timestamp
 *
 * Resolution order (stops at first hit):
 *
 *  1. By designRequestId — direct UUID lookup; exact match for orders placed
 *     after the checkout fix that serialises designRequestId into line_items.
 *
 *  2. By shopify_order_number — set by createPrintfulTemplate (fire-and-forget
 *     after checkout); may be null if Printful template creation failed.
 *
 *  3. Timing fallback — finds the most recent design_order_requests row for this
 *     FID + productType that was created in the hour BEFORE the order was placed.
 *     Handles old orders where neither of the above is set.
 */
export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderNumber    = searchParams.get('orderNumber');    // e.g. "#1650" or "1650"
  const designRequestId = searchParams.get('designRequestId'); // UUID
  const productType    = searchParams.get('productType');    // "tshirt" | "hoodie" | "hat"
  const orderCreatedAt = searchParams.get('orderCreatedAt'); // ISO timestamp

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ mockupUrl: null });

    // ── Strategy 1: exact designRequestId lookup ────────────────────────────
    if (designRequestId) {
      const { data } = await supabase
        .from('design_order_requests')
        .select('mockup_url')
        .eq('id', designRequestId)
        .eq('fid', auth.fid)
        .maybeSingle();
      if (data?.mockup_url) {
        console.log(`🎨 order-mockup [s1 designRequestId] FID ${auth.fid}: found`);
        return NextResponse.json({ mockupUrl: data.mockup_url });
      }
    }

    // ── Strategy 2: shopify_order_number match ──────────────────────────────
    if (orderNumber) {
      const num = orderNumber.replace(/^#/, '');
      const { data } = await supabase
        .from('design_order_requests')
        .select('mockup_url')
        .eq('fid', auth.fid)
        .or(`shopify_order_number.eq.#${num},shopify_order_number.eq.${num}`)
        .not('mockup_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.mockup_url) {
        console.log(`🎨 order-mockup [s2 orderNumber #${num}] FID ${auth.fid}: found`);
        return NextResponse.json({ mockupUrl: data.mockup_url });
      }
    }

    // ── Strategy 3: timing fallback ─────────────────────────────────────────
    // Find the most recent design_order_request for this FID + productType
    // created in the hour BEFORE the order was placed. This handles old orders
    // that predate both of the above mechanisms.
    if (productType && orderCreatedAt) {
      const orderTime = new Date(orderCreatedAt);
      const oneHourBefore = new Date(orderTime.getTime() - 60 * 60 * 1000);
      const { data } = await supabase
        .from('design_order_requests')
        .select('mockup_url')
        .eq('fid', auth.fid)
        .eq('product_type', productType)
        .not('mockup_url', 'is', null)
        .gte('created_at', oneHourBefore.toISOString())
        .lte('created_at', orderTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.mockup_url) {
        console.log(`🎨 order-mockup [s3 timing ${productType}] FID ${auth.fid}: found`);
        return NextResponse.json({ mockupUrl: data.mockup_url });
      }
    }

    console.log(`⚠️ order-mockup — FID ${auth.fid}: no match found`);
    return NextResponse.json({ mockupUrl: null });
  } catch (err) {
    console.error('order-mockup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
