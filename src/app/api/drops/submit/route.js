import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getOpenSubmissionDrop } from '@/lib/dropHelpers';

// POST /api/drops/submit — submit a mockup to the current weekly drop (1 per FID per week).
export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fid = auth.fid;

  try {
    const drop = await getOpenSubmissionDrop(supabaseAdmin);
    if (!drop) {
      return NextResponse.json({ error: 'Submissions are not open for any drop right now.' }, { status: 403 });
    }

    const { mockupId } = await request.json();
    if (!mockupId) {
      return NextResponse.json({ error: 'mockupId is required' }, { status: 400 });
    }

    const { data: mockup, error: mockupErr } = await supabaseAdmin
      .from('design_studio_mockups')
      .select('*')
      .eq('id', mockupId)
      .single();

    if (mockupErr || !mockup) {
      return NextResponse.json({ error: 'Mockup not found.' }, { status: 404 });
    }

    if (String(mockup.fid) !== String(fid)) {
      return NextResponse.json({ error: 'You can only submit your own designs.' }, { status: 403 });
    }

    const { data: existing } = await supabaseAdmin
      .from('drop_submissions')
      .select('id, status, mockup_id')
      .eq('drop_id', drop.id)
      .eq('fid', fid)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: existing.mockup_id === mockupId
          ? 'You already submitted this design for this week\'s drop.'
          : 'You already submitted a design for this week\'s drop (1 per week).',
      }, { status: 409 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('fid', fid)
      .maybeSingle();

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('drop_submissions')
      .insert({
        drop_id: drop.id,
        mockup_id: mockupId,
        fid,
        username: profile?.username || auth.username || null,
        product_type: mockup.product_type,
        mockup_url: mockup.mockup_url,
        design_url: mockup.design_url,
        color_name: mockup.color_name,
        technique: mockup.technique,
        status: 'submitted',
      })
      .select('id, drop_id, status')
      .single();

    if (insertErr) {
      console.error('[drops/submit] insert error:', insertErr);
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'You already submitted a design for this week\'s drop.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      submission: inserted,
      drop: { id: drop.id, weekLabel: drop.week_label },
    });
  } catch (err) {
    console.error('[drops/submit] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
