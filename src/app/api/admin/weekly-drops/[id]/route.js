import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

const VALID_DROP_STATUSES = ['draft', 'voting', 'live', 'sold_out', 'closed'];

export const PATCH = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;
    const body = await request.json();

    const updates = { updated_at: new Date().toISOString() };

    if (body.status !== undefined) {
      if (!VALID_DROP_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = body.status;
    }

    const dateFields = [
      'submissionsOpenAt', 'submissionsCloseAt',
      'votingStartsAt', 'votingEndsAt',
      'dropStartsAt', 'dropEndsAt',
    ];
    const dbDateFields = {
      submissionsOpenAt: 'submissions_open_at',
      submissionsCloseAt: 'submissions_close_at',
      votingStartsAt: 'voting_starts_at',
      votingEndsAt: 'voting_ends_at',
      dropStartsAt: 'drop_starts_at',
      dropEndsAt: 'drop_ends_at',
    };
    for (const key of dateFields) {
      if (body[key] !== undefined) updates[dbDateFields[key]] = body[key];
    }

    if (body.weekLabel !== undefined) updates.week_label = body.weekLabel;
    if (body.shopifyProductId !== undefined) updates.shopify_product_id = body.shopifyProductId;
    if (body.maxUnits !== undefined) updates.max_units = body.maxUnits;
    if (body.unitsSold !== undefined) updates.units_sold = body.unitsSold;
    if (body.winningSubmissionId !== undefined) updates.winning_submission_id = body.winningSubmissionId;
    if (body.adminNotes !== undefined) updates.admin_notes = body.adminNotes;

    const { data: drop, error } = await supabaseAdmin
      .from('weekly_drops')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, drop });
  } catch (err) {
    console.error('[admin/weekly-drops/[id]] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
