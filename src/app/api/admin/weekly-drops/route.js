import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async () => {
  try {
    const { data: drops, error } = await supabaseAdmin
      .from('weekly_drops')
      .select(`
        *,
        drop_submissions!drop_submissions_drop_id_fkey (
          id, mockup_id, fid, username, mockup_url, design_url,
          product_type, color_name, technique, status, vote_count, created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ drops: drops || [] });
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
      adminNotes,
    } = body;

    if (!weekLabel?.trim()) {
      return NextResponse.json({ error: 'weekLabel is required' }, { status: 400 });
    }

    const { data: drop, error } = await supabaseAdmin
      .from('weekly_drops')
      .insert({
        week_label: weekLabel.trim(),
        status: 'draft',
        submissions_open_at: submissionsOpenAt || null,
        submissions_close_at: submissionsCloseAt || null,
        voting_starts_at: votingStartsAt || null,
        voting_ends_at: votingEndsAt || null,
        drop_starts_at: dropStartsAt || null,
        drop_ends_at: dropEndsAt || null,
        max_units: maxUnits,
        creator_payout_per_unit: creatorPayoutPerUnit,
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
