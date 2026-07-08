import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

const VALID_DROP_STATUSES = ['draft', 'voting', 'live', 'sold_out', 'closed'];

const REVERT_STEP = {
  voting: {
    status: 'draft',
    clearFields: { winning_submission_id: null, voting_ends_at: null },
    resetWinnerToFinalist: true,
  },
  live: {
    status: 'voting',
    clearFields: { drop_starts_at: null },
  },
  sold_out: {
    status: 'live',
    clearFields: {},
  },
  closed: {
    status: 'sold_out',
    clearFields: {},
  },
};

export const PATCH = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;
    const body = await request.json();

    const updates = { updated_at: new Date().toISOString() };

    if (body.revertStep === true) {
      const { data: current, error: fetchErr } = await supabaseAdmin
        .from('weekly_drops')
        .select('status')
        .eq('id', id)
        .single();

      if (fetchErr || !current) {
        return NextResponse.json({ error: 'Drop not found' }, { status: 404 });
      }

      const revert = REVERT_STEP[current.status];
      if (!revert) {
        return NextResponse.json({ error: 'This drop cannot be reverted further' }, { status: 400 });
      }

      updates.status = revert.status;
      Object.assign(updates, revert.clearFields);

      if (revert.resetWinnerToFinalist) {
        await supabaseAdmin
          .from('drop_submissions')
          .update({ status: 'finalist' })
          .eq('drop_id', id)
          .eq('status', 'winner');
      }
    } else if (body.status !== undefined) {
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

    if (['sold_out', 'closed'].includes(drop.status)) {
      try {
        const { finalizeDropCreatorPayout } = await import('@/lib/dropCreatorPayouts');
        await finalizeDropCreatorPayout(id);
      } catch (payoutErr) {
        console.error('[admin/weekly-drops] payout finalize failed:', payoutErr);
      }
    }

    return NextResponse.json({ success: true, drop });
  } catch (err) {
    console.error('[admin/weekly-drops/[id]] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const DELETE = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;

    const { data: drop, error: fetchErr } = await supabaseAdmin
      .from('weekly_drops')
      .select('id, week_label, units_sold')
      .eq('id', id)
      .single();

    if (fetchErr || !drop) {
      return NextResponse.json({ error: 'Drop not found' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('weekly_drops')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, deleted: drop });
  } catch (err) {
    console.error('[admin/weekly-drops/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
