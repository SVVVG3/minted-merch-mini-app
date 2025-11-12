// Admin API - Bounty Submissions Management
// GET: List all submissions with filters

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/admin/bounty-submissions - List all submissions
export const GET = withAdminAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, approved, rejected
    const bountyId = searchParams.get('bountyId');
    const ambassadorId = searchParams.get('ambassadorId');

    console.log('📋 Admin fetching bounty submissions...', { status, bountyId, ambassadorId });

    let query = supabaseAdmin
      .from('bounty_submissions')
      .select(`
        *,
        bounties (
          id,
          title,
          description,
          reward_tokens,
          category
        ),
        ambassadors!bounty_submissions_ambassador_id_fkey (
          id,
          fid,
          total_earned_tokens,
          profiles (
            username,
            display_name,
            pfp_url
          )
        )
      `)
      .order('submitted_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (bountyId) {
      query = query.eq('bounty_id', bountyId);
    }
    if (ambassadorId) {
      query = query.eq('ambassador_id', ambassadorId);
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error('❌ Error fetching submissions:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch submissions'
      }, { status: 500 });
    }

    console.log(`✅ Fetched ${submissions.length} submissions`);

    return NextResponse.json({
      success: true,
      submissions
    });

  } catch (error) {
    console.error('❌ Error in GET /api/admin/bounty-submissions:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

