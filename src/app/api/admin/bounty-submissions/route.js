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
    const ambassadorFid = searchParams.get('ambassadorFid');

    console.log('📋 Admin fetching bounty submissions...', { status, bountyId, ambassadorFid });

    let query = supabaseAdmin
      .from('bounty_submissions')
      .select(`
        *,
        bounties (
          id,
          title,
          description,
          reward_tokens,
          category,
          bounty_type
        )
      `)
      .order('submitted_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (bountyId) {
      query = query.eq('bounty_id', bountyId);
    }
    if (ambassadorFid) {
      query = query.eq('ambassador_fid', ambassadorFid);
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error('❌ Error fetching submissions:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch submissions'
      }, { status: 500 });
    }

    // Fetch profile data for all unique FIDs
    const uniqueFids = [...new Set(submissions.map(s => s.ambassador_fid).filter(Boolean))];
    
    let profilesMap = {};
    if (uniqueFids.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('fid, username, display_name, pfp_url')
        .in('fid', uniqueFids);
      
      if (!profilesError && profiles) {
        profiles.forEach(p => {
          profilesMap[p.fid] = p;
        });
      }
    }

    // Enrich submissions with profile data
    const enrichedSubmissions = submissions.map(submission => ({
      ...submission,
      profile: profilesMap[submission.ambassador_fid] || null
    }));

    console.log(`✅ Fetched ${enrichedSubmissions.length} submissions`);

    return NextResponse.json({
      success: true,
      submissions: enrichedSubmissions
    });

  } catch (error) {
    console.error('❌ Error in GET /api/admin/bounty-submissions:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
