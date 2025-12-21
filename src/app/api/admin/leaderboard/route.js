import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 10000;
    const sortBy = searchParams.get('sortBy') || 'total_points';
    
    console.log(`📊 Admin fetching leaderboard data - limit: ${limit}, sortBy: ${sortBy}`);

    const isHoldingsQuery = (sortBy === 'token_balance' || sortBy === 'holdings');
    let leaderboardData = [];

    if (isHoldingsQuery) {
      // For holdings, use the same reliable approach as the mini app:
      // 1. Query profiles directly (no LEFT JOIN pagination issues)
      // 2. Fetch leaderboard data separately for those FIDs
      console.log('📊 Fetching profiles by token holdings (matching mini app approach)');
      
      // Fetch ALL profiles with tokens using pagination (no LEFT JOIN)
      let allProfiles = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMoreData = true;

      while (hasMoreData) {
        const startRange = currentPage * pageSize;
        const endRange = startRange + pageSize - 1;
        
        console.log(`📊 Fetching profiles page ${currentPage + 1}: rows ${startRange} to ${endRange}`);
        
        const { data: pageData, error } = await supabaseAdmin
          .from('profiles')
          .select('fid, username, display_name, pfp_url, token_balance, wallet_balance, staked_balance, token_balance_updated_at, neynar_score')
          .gt('token_balance', 0)
          .order('token_balance', { ascending: false })
          .range(startRange, endRange);

        if (error) {
          console.error('Error fetching profiles page:', error);
          return NextResponse.json(
            { success: false, error: 'Failed to fetch profiles data' },
            { status: 500 }
          );
        }

        if (pageData && pageData.length > 0) {
          allProfiles = allProfiles.concat(pageData);
          console.log(`📊 Profiles page ${currentPage + 1}: fetched ${pageData.length} entries, total: ${allProfiles.length}`);
          hasMoreData = pageData.length === pageSize;
          currentPage++;
        } else {
          hasMoreData = false;
        }
      }

      console.log(`✅ Fetched ${allProfiles.length} total profiles with tokens`);

      // Get all FIDs to fetch leaderboard data
      const fids = allProfiles.map(p => p.fid);
      
      // Fetch leaderboard data for these FIDs (if they have any)
      console.log(`📊 Fetching leaderboard data for ${fids.length} FIDs`);
      const { data: leaderboardEntries, error: leaderboardError } = await supabaseAdmin
        .from('user_leaderboard')
        .select('*')
        .in('user_fid', fids);

      if (leaderboardError) {
        console.warn('⚠️ Error fetching leaderboard data:', leaderboardError);
        // Continue without leaderboard data
      }

      // Create a map of FID -> leaderboard data for quick lookup
      const leaderboardMap = new Map();
      if (leaderboardEntries) {
        leaderboardEntries.forEach(entry => {
          leaderboardMap.set(entry.user_fid, entry);
        });
      }

      // Merge profiles with their leaderboard data
      leaderboardData = allProfiles.map(profile => ({
        fid: profile.fid,
        username: profile.username,
        display_name: profile.display_name,
        pfp_url: profile.pfp_url,
        token_balance: profile.token_balance,
        wallet_balance: profile.wallet_balance,
        staked_balance: profile.staked_balance,
        token_balance_updated_at: profile.token_balance_updated_at,
        neynar_score: profile.neynar_score,
        user_leaderboard: leaderboardMap.get(profile.fid) || null
      }));

      console.log(`✅ Successfully merged ${leaderboardData.length} profiles with leaderboard data`);
      
    } else {
      // For other sorts, use user_leaderboard table with pagination
      let allData = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMoreData = true;

      let baseQuery = supabaseAdmin
        .from('user_leaderboard')
        .select(`
          *,
          profiles!user_fid (
            username,
            display_name,
            pfp_url,
            token_balance,
            wallet_balance,
            staked_balance,
            neynar_score
          )
        `);

      // Add sorting
      switch (sortBy) {
        case 'total_points':
          baseQuery = baseQuery.order('total_points', { ascending: false });
          break;
        case 'checkin_streak':
          baseQuery = baseQuery.order('checkin_streak', { ascending: false });
          break;
        case 'points_from_purchases':
          baseQuery = baseQuery.order('points_from_purchases', { ascending: false });
          break;
        case 'total_orders':
          baseQuery = baseQuery.order('total_orders', { ascending: false });
          break;
        default:
          baseQuery = baseQuery.order('total_points', { ascending: false });
      }

      // Fetch all pages
      while (hasMoreData) {
        const startRange = currentPage * pageSize;
        const endRange = startRange + pageSize - 1;
        
        console.log(`📊 Fetching page ${currentPage + 1}: rows ${startRange} to ${endRange}`);
        
        const { data: pageData, error } = await baseQuery.range(startRange, endRange);

        if (error) {
          console.error('Error fetching leaderboard page:', error);
          return NextResponse.json(
            { success: false, error: 'Failed to fetch leaderboard data' },
            { status: 500 }
          );
        }

        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData);
          console.log(`📊 Page ${currentPage + 1}: fetched ${pageData.length} entries, total: ${allData.length}`);
          hasMoreData = pageData.length === pageSize;
          currentPage++;
        } else {
          hasMoreData = false;
        }
      }

      leaderboardData = allData;
      console.log(`📊 ✅ Successfully fetched ALL ${leaderboardData.length} leaderboard entries using pagination`);
    }

    // Import multiplier functions
    const { applyTokenMultiplier } = await import('@/lib/points');
    
    // NOTE: For leaderboard display, we use cached staked_balance from profiles table
    // This updates via RPC when users open the app. While not real-time, it's sufficient
    // for leaderboard display purposes. The "Wallets Staked" count on the dashboard
    // now uses live paginated subgraph data for accurate totals.
    console.log('📊 Using cached staked_balance from profiles table for leaderboard display');
    
    // Transform the data to flatten profile information, add token holdings, and apply multipliers
    const transformedData = leaderboardData.map((entry, index) => {
      let profile, leaderboardInfo, tokenBalance, basePoints, userFid;
      
      if (isHoldingsQuery) {
        // Data from profiles table with separate leaderboard data
        profile = entry;
        // user_leaderboard is now null or an object (from separate query)
        leaderboardInfo = entry.user_leaderboard || {};
        tokenBalance = entry.token_balance || 0;
        basePoints = leaderboardInfo.total_points || 0;
        userFid = entry.fid;
      } else {
        // Data from user_leaderboard table with profile join
        profile = entry.profiles || {};
        leaderboardInfo = entry;
        tokenBalance = profile.token_balance || 0;
        basePoints = entry.total_points || 0;
        userFid = entry.user_fid;
      }
      
      // Apply token multiplier to total points
      const multiplierResult = applyTokenMultiplier(basePoints, tokenBalance);
      
      // Use cached staked_balance from profiles table (updated via RPC when user opens app)
      const stakedBalance = profile.staked_balance || 0;
      
      return {
        // Normalize the data structure
        user_fid: userFid,
        fid: userFid, // For compatibility
        username: profile.username || leaderboardInfo.username,
        display_name: profile.display_name || leaderboardInfo.display_name,
        pfp_url: profile.pfp_url,
        token_balance: tokenBalance,
        wallet_balance: profile.wallet_balance || 0,
        staked_balance: stakedBalance, // From profiles table (cached via RPC)
        token_balance_updated_at: profile.token_balance_updated_at,
        neynar_score: profile.neynar_score || null,
        // Leaderboard stats (may be 0 for users without leaderboard activity)
        total_points: multiplierResult.multipliedPoints,
        base_points: basePoints,
        checkin_streak: leaderboardInfo.checkin_streak || 0,
        last_checkin_date: leaderboardInfo.last_checkin_date,
        total_orders: leaderboardInfo.total_orders || 0,
        total_spent: leaderboardInfo.total_spent || 0,
        points_from_purchases: leaderboardInfo.points_from_purchases || 0,
        points_from_checkins: leaderboardInfo.points_from_checkins || 0,
        created_at: leaderboardInfo.created_at,
        // Token multiplier info
        token_multiplier: multiplierResult.multiplier,
        token_tier: multiplierResult.tier,
        // Remove nested objects
        profiles: undefined,
        user_leaderboard: undefined
      };
    });

    // Re-sort the data after applying multipliers (since multipliers can change rankings)
    const sortedData = transformedData.sort((a, b) => {
      switch (sortBy) {
        case 'total_points':
          return (b.total_points || 0) - (a.total_points || 0);
        case 'checkin_streak':
          if ((b.checkin_streak || 0) !== (a.checkin_streak || 0)) {
            return (b.checkin_streak || 0) - (a.checkin_streak || 0);
          }
          return (b.total_points || 0) - (a.total_points || 0);
        case 'points_from_purchases':
          return (b.points_from_purchases || 0) - (a.points_from_purchases || 0);
        case 'total_orders':
          return (b.total_orders || 0) - (a.total_orders || 0);
        case 'token_balance':
        case 'holdings':
          return (parseFloat(b.token_balance || 0)) - (parseFloat(a.token_balance || 0));
        case 'staked_balance':
          return (parseFloat(b.staked_balance || 0)) - (parseFloat(a.staked_balance || 0));
        default:
          if (isHoldingsQuery) {
            return (parseFloat(b.token_balance || 0)) - (parseFloat(a.token_balance || 0));
          } else {
            return (b.total_points || 0) - (a.total_points || 0);
          }
      }
    });

    console.log(`✅ Successfully fetched and sorted ${sortedData.length} leaderboard entries with multipliers applied`);

    return NextResponse.json({
      success: true,
      data: sortedData,
      total: sortedData.length,
      sortedBy: sortBy
    });

  } catch (error) {
    console.error('Error in admin leaderboard API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});