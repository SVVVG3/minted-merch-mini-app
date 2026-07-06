import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getOpenSubmissionDrop } from '@/lib/dropHelpers';

// GET /api/drops/current?mockupId=xxx
// Returns the active drop accepting submissions + optional user submission status.
export async function GET(request) {
  try {
    const drop = await getOpenSubmissionDrop(supabaseAdmin);

    if (!drop) {
      return NextResponse.json({ drop: null, submission: null, canSubmit: false });
    }

    const { searchParams } = new URL(request.url);
    const mockupId = searchParams.get('mockupId');

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const auth = token ? await verifyFarcasterUser(token) : { authenticated: false };

    let submission = null;
    if (auth.authenticated) {
      const { data } = await supabaseAdmin
        .from('drop_submissions')
        .select('id, mockup_id, status, created_at')
        .eq('drop_id', drop.id)
        .eq('fid', auth.fid)
        .maybeSingle();

      submission = data || null;
    }

    return NextResponse.json({
      drop: {
        id: drop.id,
        weekLabel: drop.week_label,
        status: drop.status,
        submissionsCloseAt: drop.submissions_close_at,
        maxUnits: drop.max_units,
        creatorPayoutPerUnit: drop.creator_payout_per_unit,
      },
      submission: submission
        ? {
            id: submission.id,
            mockupId: submission.mockup_id,
            status: submission.status,
            createdAt: submission.created_at,
            isThisMockup: mockupId ? submission.mockup_id === mockupId : undefined,
          }
        : null,
      canSubmit: auth.authenticated && !submission,
    });
  } catch (err) {
    console.error('[drops/current] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
