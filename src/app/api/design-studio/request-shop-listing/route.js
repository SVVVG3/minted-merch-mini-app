import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MERCH_MOGUL_THRESHOLD = 50_000_000;

// GET /api/design-studio/request-shop-listing?mockupId=xxx
// Returns the current user's listing request status for this mockup (if any)
export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mockupId = searchParams.get('mockupId');
  if (!mockupId) return NextResponse.json({ request: null });

  const { data } = await supabase
    .from('shop_listing_requests')
    .select('id, status, created_at')
    .eq('mockup_id', mockupId)
    .eq('fid', auth.fid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ request: data || null });
}

export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fid = auth.fid;

  try {
    // Verify requester is a Merch Mogul
    const { data: profile } = await supabase
      .from('profiles')
      .select('staked_balance, username')
      .eq('fid', fid)
      .single();

    const stakedBalance = parseFloat(profile?.staked_balance || 0);
    if (stakedBalance < MERCH_MOGUL_THRESHOLD) {
      return NextResponse.json({ error: 'Only Merch Moguls can request shop listings.' }, { status: 403 });
    }

    const { mockupId } = await request.json();
    if (!mockupId) {
      return NextResponse.json({ error: 'mockupId is required' }, { status: 400 });
    }

    // Load the mockup and verify ownership
    const { data: mockup, error: mockupErr } = await supabase
      .from('design_studio_mockups')
      .select('*')
      .eq('id', mockupId)
      .single();

    if (mockupErr || !mockup) {
      return NextResponse.json({ error: 'Mockup not found.' }, { status: 404 });
    }

    if (String(mockup.fid) !== String(fid)) {
      return NextResponse.json({ error: 'You can only request listing for your own designs.' }, { status: 403 });
    }

    // Check for an existing pending request for this mockup
    const { data: existing } = await supabase
      .from('shop_listing_requests')
      .select('id, status')
      .eq('mockup_id', mockupId)
      .eq('fid', fid)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'You already have a pending or approved listing request for this design.' }, { status: 409 });
    }

    // Insert the listing request
    const { data: inserted, error: insertErr } = await supabase
      .from('shop_listing_requests')
      .insert({
        mockup_id: mockupId,
        fid,
        username: profile?.username || null,
        product_type: mockup.product_type,
        mockup_url: mockup.mockup_url,
        design_url: mockup.design_url,
        color_name: mockup.color_name,
        technique: mockup.technique,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[request-shop-listing] insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to submit request. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: inserted.id });
  } catch (err) {
    console.error('[request-shop-listing] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
