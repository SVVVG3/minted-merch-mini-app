import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

async function userOwnsOrder(supabase, orderNumber, fid) {
  const num = orderNumber.replace(/^#/, '');
  const { data: order } = await supabase
    .from('orders')
    .select('fid')
    .or(`order_id.eq.#${num},order_id.eq.${num}`)
    .maybeSingle();
  return order && String(order.fid) === String(fid);
}

function orderNumberVariants(orderNumber) {
  const num = orderNumber.replace(/^#/, '');
  return [`#${num}`, num];
}

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
 *     Also handles limited-drop listing rows stamped with the buyer's order #.
 *
 *  2. By shopify_order_number — buyer's design_order_requests row, or the
 *     shared drop listing row (winner FID) when that row was stamped at checkout.
 *
 *  3. Timing fallback — finds the most recent design_order_requests row for this
 *     FID + productType that was created in the hour BEFORE the order was placed.
 */
export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderNumber    = searchParams.get('orderNumber');
  const designRequestId = searchParams.get('designRequestId');
  const productType    = searchParams.get('productType');
  const orderCreatedAt = searchParams.get('orderCreatedAt');

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ mockupUrl: null });

    // ── Strategy 1: designRequestId lookup ────────────────────────────────
    if (designRequestId) {
      const { data } = await supabase
        .from('design_order_requests')
        .select('mockup_url, fid, shopify_order_number')
        .eq('id', designRequestId)
        .maybeSingle();

      if (data?.mockup_url) {
        const buyerMatch = String(data.fid) === String(auth.fid);
        let orderMatch = false;
        if (orderNumber && data.shopify_order_number) {
          const nums = orderNumberVariants(orderNumber);
          orderMatch = nums.includes(data.shopify_order_number);
          if (orderMatch) {
            orderMatch = await userOwnsOrder(supabase, orderNumber, auth.fid);
          }
        }

        if (buyerMatch || orderMatch) {
          console.log(`🎨 order-mockup [s1 designRequestId] FID ${auth.fid}: found`);
          return NextResponse.json({ mockupUrl: data.mockup_url });
        }
      }
    }

    // ── Strategy 2: shopify_order_number (buyer row or drop listing row) ────
    if (orderNumber) {
      const ownsOrder = await userOwnsOrder(supabase, orderNumber, auth.fid);
      if (ownsOrder) {
        const nums = orderNumberVariants(orderNumber);

        // Prefer buyer's own row
        const { data: buyerRow } = await supabase
          .from('design_order_requests')
          .select('mockup_url')
          .eq('fid', auth.fid)
          .in('shopify_order_number', nums)
          .not('mockup_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (buyerRow?.mockup_url) {
          console.log(`🎨 order-mockup [s2 buyer] FID ${auth.fid}: found`);
          return NextResponse.json({ mockupUrl: buyerRow.mockup_url });
        }

        // Limited drops: listing row may carry winner FID + buyer's Shopify order #
        const { data: stampedRow } = await supabase
          .from('design_order_requests')
          .select('mockup_url')
          .in('shopify_order_number', nums)
          .not('mockup_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (stampedRow?.mockup_url) {
          console.log(`🎨 order-mockup [s2 stamped listing] FID ${auth.fid}: found`);
          return NextResponse.json({ mockupUrl: stampedRow.mockup_url });
        }
      }
    }

    // ── Strategy 3: timing fallback ─────────────────────────────────────────
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
