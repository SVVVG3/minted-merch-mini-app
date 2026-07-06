import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';
import { createPrintfulDraftForDropWinner } from '@/lib/dropPrintful';

const VALID_SUBMISSION_STATUSES = ['submitted', 'finalist', 'winner', 'rejected'];

export const PATCH = withAdminAuth(async (request) => {
  try {
    const { id, status, dropId } = await request.json();

    if (!id || !VALID_SUBMISSION_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Enforce max 3 finalists per drop
    if (status === 'finalist' && dropId) {
      const { count } = await supabaseAdmin
        .from('drop_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('drop_id', dropId)
        .eq('status', 'finalist')
        .neq('id', id);

      if (count >= 3) {
        return NextResponse.json({ error: 'Maximum 3 finalists allowed per drop' }, { status: 400 });
      }
    }

    if (status === 'winner' && dropId) {
      const now = new Date().toISOString();

      // Reject every other submission (including prior winners and finalists)
      await supabaseAdmin
        .from('drop_submissions')
        .update({ status: 'rejected' })
        .eq('drop_id', dropId)
        .neq('id', id)
        .in('status', ['submitted', 'finalist', 'winner']);

      // Close voting — winner picked; admin still clicks Go Live for Shopify
      await supabaseAdmin
        .from('weekly_drops')
        .update({
          winning_submission_id: id,
          voting_ends_at: now,
          updated_at: now,
        })
        .eq('id', dropId);
    }

    const { data: submission, error } = await supabaseAdmin
      .from('drop_submissions')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let printful = null;
    if (status === 'winner' && dropId) {
      printful = await createPrintfulDraftForDropWinner(id, dropId);
      if (!printful.success) {
        console.error('[admin/drop-submissions] Printful draft failed:', printful.error);
      }
    }

    return NextResponse.json({ success: true, submission, printful });
  } catch (err) {
    console.error('[admin/drop-submissions] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
