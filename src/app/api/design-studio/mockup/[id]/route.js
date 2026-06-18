/**
 * Public endpoint — no auth required.
 * Returns a single mockup from design_studio_mockups plus the creator's
 * public profile so the /design/[mockupId] page can render without auth.
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // Fetch mockup
  const { data: mockup, error } = await supabase
    .from('design_studio_mockups')
    .select('id, fid, product_type, color_name, mockup_url, design_url, placement, technique, design_scale, printful_variant_ids, position_data, created_at')
    .eq('id', id)
    .single();

  if (error || !mockup) {
    return NextResponse.json({ error: 'Mockup not found' }, { status: 404 });
  }

  // Fetch creator profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('fid, username, display_name, pfp_url, staked_balance')
    .eq('fid', mockup.fid)
    .single();

  const isMerchMogul = profile?.staked_balance != null && Number(profile.staked_balance) >= 50_000_000;

  return NextResponse.json({
    mockup,
    creator: profile
      ? {
          fid: profile.fid,
          username: profile.username,
          displayName: profile.display_name,
          pfpUrl: profile.pfp_url,
          isMerchMogul,
        }
      : null,
  });
}
