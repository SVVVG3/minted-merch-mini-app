import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/design-studio/order-mockup?orderNumber=1650
 *
 * Returns the custom mockup URL for a given Shopify order by looking up
 * design_order_requests where shopify_order_number matches the order.
 *
 * shopify_order_number is written by createPrintfulTemplate (fire-and-forget
 * after checkout), so it may be null for brand-new orders — in that case we
 * return { mockupUrl: null } rather than guessing with a loose product-type
 * query that could show the wrong mockup on unrelated past orders.
 */
export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber'); // e.g. "#1650" or "1650"

  if (!orderNumber) {
    return NextResponse.json({ error: 'orderNumber is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ mockupUrl: null });

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

    if (error) throw error;

    const mockupUrl = data?.mockup_url || null;
    console.log(`🎨 order-mockup — order #${num}, FID ${auth.fid}: ${mockupUrl ? 'found' : 'not found'}`);

    return NextResponse.json({ mockupUrl });
  } catch (err) {
    console.error('order-mockup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
