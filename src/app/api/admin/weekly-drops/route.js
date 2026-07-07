import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';
import { enrichSubmissionsWithProfiles } from '@/lib/dropHelpers';

export const GET = withAdminAuth(async () => {
  try {
    const { data: drops, error } = await supabaseAdmin
      .from('weekly_drops')
      .select(`
        *,
        drop_submissions!drop_submissions_drop_id_fkey (
          id, mockup_id, fid, username, mockup_url, design_url,
          product_type, color_name, technique, status, vote_count, created_at
        ),
        design_request:design_order_requests!weekly_drops_design_request_id_fkey (
          id, printful_order_id, printful_order_status
        )
      `)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const enrichedDrops = await Promise.all(
      (drops || []).map(async (drop) => ({
        ...drop,
        drop_submissions: await enrichSubmissionsWithProfiles(
          supabaseAdmin,
          drop.drop_submissions || []
        ),
      }))
    );

    return NextResponse.json({ drops: enrichedDrops });
  } catch (err) {
    console.error('[admin/weekly-drops] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminAuth(async (request) => {
  try {
    const body = await request.json();
    const {
      weekLabel,
      submissionsOpenAt,
      submissionsCloseAt,
      votingStartsAt,
      votingEndsAt,
      dropStartsAt,
      dropEndsAt,
      maxUnits = 37,
      creatorPayoutPerUnit = 5_000_000,
      shopifyProductId,
      adminNotes,
    } = body;

    if (!weekLabel?.trim()) {
      return NextResponse.json({ error: 'weekLabel is required' }, { status: 400 });
    }

    if (!votingEndsAt) {
      return NextResponse.json({ error: 'votingEndsAt (drop end time) is required' }, { status: 400 });
    }

    const endsDate = new Date(votingEndsAt);
    if (Number.isNaN(endsDate.getTime())) {
      return NextResponse.json({ error: 'Invalid votingEndsAt' }, { status: 400 });
    }
    if (endsDate.getMinutes() !== 0 || endsDate.getSeconds() !== 0 || endsDate.getMilliseconds() !== 0) {
      return NextResponse.json({ error: 'Drop must end on the hour (:00)' }, { status: 400 });
    }

    const { data: drop, error } = await supabaseAdmin
      .from('weekly_drops')
      .insert({
        week_label: weekLabel.trim(),
        status: 'draft',
        submissions_open_at: submissionsOpenAt || null,
        submissions_close_at: submissionsCloseAt || null,
        voting_starts_at: votingStartsAt || new Date().toISOString(),
        voting_ends_at: votingEndsAt,
        drop_starts_at: dropStartsAt || null,
        drop_ends_at: dropEndsAt || null,
        max_units: maxUnits,
        creator_payout_per_unit: creatorPayoutPerUnit,
        shopify_product_id: shopifyProductId || null,
        admin_notes: adminNotes || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, drop });
  } catch (err) {
    console.error('[admin/weekly-drops] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
