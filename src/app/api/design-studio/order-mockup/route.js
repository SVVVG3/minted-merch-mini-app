import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/design-studio/order-mockup?orderNumber=1650
 *
 * Returns the custom mockup URL stored in design_order_requests for a given
 * Shopify order number. Used by the order success / past-orders pages so they
 * can embed the user's custom mockup image in the Farcaster share cast instead
 * of the generic product photo.
 *
 * Handles both "#1650" and "1650" input formats.
 */
export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');
  if (!orderNumber) {
    return NextResponse.json({ error: 'orderNumber is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ mockupUrl: null });

    // Normalise: strip leading '#' for the ILIKE comparison
    const num = orderNumber.replace(/^#/, '');

    // design_order_requests stores shopify_order_number in formats like '#1650' or '1650'
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
    console.log(`🎨 order-mockup lookup — order #${num}, FID ${auth.fid}: ${mockupUrl ? 'found' : 'none'}`);

    return NextResponse.json({ mockupUrl });
  } catch (err) {
    console.error('order-mockup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
