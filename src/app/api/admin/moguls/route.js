// Admin API endpoint to fetch all users staking 50M+ $mintedmerch (Moguls)
// GET /api/admin/moguls
// Returns all 50M+ stakers with ambassador status indicator

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { CUSTOM_BOUNTY_STAKED_THRESHOLD } from '@/lib/mogulHelpers';

// GET /api/admin/moguls - List all 50M+ stakers
export const GET = withAdminAuth(async (request) => {
  try {
    console.log(`🎯 Admin fetching all moguls (50M+ stakers)`);

    // Get all users with 50M+ staked
    const { data: moguls, error: mogulsError } = await supabaseAdmin
      .from('profiles')
      .select(`
        fid,
        username,
        display_name,
        pfp_url,
        staked_balance,
        token_balance,
        wallet_balance,
        created_at
      `)
      .gte('staked_balance', CUSTOM_BOUNTY_STAKED_THRESHOLD)
      .order('staked_balance', { ascending: false });

    if (mogulsError) {
      console.error('❌ Error fetching moguls:', mogulsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch moguls'
      }, { status: 500 });
    }

    // Get all ambassadors to mark which moguls are manually added ambassadors
    const { data: ambassadors, error: ambassadorsError } = await supabaseAdmin
      .from('ambassadors')
      .select('fid, is_active, total_earned_tokens, total_bounties_completed, created_at');

    if (ambassadorsError) {
      console.error('⚠️ Error fetching ambassadors:', ambassadorsError);
    }

    // Create a map of ambassador FIDs for quick lookup
    const ambassadorMap = {};
    (ambassadors || []).forEach(amb => {
      ambassadorMap[amb.fid] = amb;
    });

    // Get bounty submission stats for each mogul
    const mogulFids = moguls.map(m => m.fid);
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from('bounty_submissions')
      .select('ambassador_fid, status')
      .in('ambassador_fid', mogulFids);

    if (submissionsError) {
      console.error('⚠️ Error fetching submissions:', submissionsError);
    }

    // Calculate submission stats per mogul
    const statsMap = {};
    (submissions || []).forEach(sub => {
      if (!statsMap[sub.ambassador_fid]) {
        statsMap[sub.ambassador_fid] = { total: 0, approved: 0, pending: 0, rejected: 0 };
      }
      statsMap[sub.ambassador_fid].total++;
      if (sub.status === 'approved') statsMap[sub.ambassador_fid].approved++;
      if (sub.status === 'pending') statsMap[sub.ambassador_fid].pending++;
      if (sub.status === 'rejected') statsMap[sub.ambassador_fid].rejected++;
    });

    // Enrich moguls with ambassador status and stats
    const enrichedMoguls = moguls.map(mogul => {
      const ambassador = ambassadorMap[mogul.fid];
      const stats = statsMap[mogul.fid] || { total: 0, approved: 0, pending: 0, rejected: 0 };
      
      return {
        fid: mogul.fid,
        username: mogul.username,
        displayName: mogul.display_name,
        pfpUrl: mogul.pfp_url,
        stakedBalance: parseFloat(mogul.staked_balance) || 0,
        tokenBalance: parseFloat(mogul.token_balance) || 0,
        walletBalance: parseFloat(mogul.wallet_balance) || 0,
        joinedAt: mogul.created_at,
        // Ambassador status
        isManualAmbassador: !!ambassador,
        ambassadorActive: ambassador?.is_active || false,
        ambassadorEarnedTokens: ambassador?.total_earned_tokens || 0,
        ambassadorBountiesCompleted: ambassador?.total_bounties_completed || 0,
        ambassadorJoinedAt: ambassador?.created_at || null,
        // Mission stats
        missionsCompleted: stats.approved,
        missionsPending: stats.pending,
        missionsRejected: stats.rejected,
        missionsTotal: stats.total
      };
    });

    console.log(`✅ Found ${enrichedMoguls.length} moguls (50M+ stakers)`);

    return NextResponse.json({
      success: true,
      moguls: enrichedMoguls,
      total: enrichedMoguls.length,
      threshold: CUSTOM_BOUNTY_STAKED_THRESHOLD
    });

  } catch (error) {
    console.error('❌ Error in admin moguls endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});
