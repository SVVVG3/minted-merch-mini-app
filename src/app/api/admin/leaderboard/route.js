import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 10000;
    const sortBy = searchParams.get('sortBy') || 'total_points';
    
    console.log(`📊 Admin fetching leaderboard data - limit: ${limit}, sortBy: ${sortBy}`);

    // Supabase enforces 1000 row limit regardless of .limit() - use real pagination
    let allData = [];
    let currentPage = 0;
    const pageSize = 1000;
    let hasMoreData = true;

    // Build base query - use profiles table for holdings, user_leaderboard for everything else
    let baseQuery;
    let isHoldingsQuery = false;
    
    if (sortBy === 'token_balance' || sortBy === 'holdings') {
      // For holdings, query profiles table to get ALL token holders (not just active users)
      isHoldingsQuery = true;
      baseQuery = supabaseAdmin
        .from('profiles')
        .select(`
          fid,
          username,
          display_name,
          pfp_url,
          token_balance,
          token_balance_updated_at,
          user_leaderboard!fid (
            user_fid,
            total_points,
            checkin_streak,
            last_checkin_date,
            total_orders,
            total_spent,
            points_from_purchases,
            points_from_checkins,
            created_at
          )
        `)
        .gt('token_balance', 0); // Only show users with tokens
    } else {
      // For other sorts, use user_leaderboard table
      baseQuery = supabaseAdmin
        .from('user_leaderboard')
        .select(`
          *,
          profiles!user_fid (
            username,
            display_name,
            pfp_url,
            token_balance
          )
        `);
    }

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
      case 'token_balance':
      case 'holdings':
        baseQuery = baseQuery.order('token_balance', { ascending: false });
        break;
      default:
        if (isHoldingsQuery) {
          baseQuery = baseQuery.order('token_balance', { ascending: false });
        } else {
          baseQuery = baseQuery.order('total_points', { ascending: false });
        }
    }

    // Fetch all pages
    while (hasMoreData) {
      const startRange = currentPage * pageSize;
      const endRange = startRange + pageSize - 1;
      
      console.log(`📊 Fetching page ${currentPage + 1}: rows ${startRange} to ${endRange}`);
      
      const { data: pageData, error } = await baseQuery.range(startRange, endRange);

      if (error) {
        console.error('Error fetching admin leaderboard page:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch leaderboard data' },
          { status: 500 }
        );
      }

      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData);
        console.log(`📊 Page ${currentPage + 1}: fetched ${pageData.length} entries, total: ${allData.length}`);
        
        // If we got less than pageSize, we've reached the end
        hasMoreData = pageData.length === pageSize;
        currentPage++;
      } else {
        hasMoreData = false;
      }
    }

    const leaderboardData = allData;
    console.log(`📊 ✅ Successfully fetched ALL ${leaderboardData.length} leaderboard entries using pagination`);

    // Import multiplier functions
    const { applyTokenMultiplier } = await import('@/lib/points');
    
    // Transform the data to flatten profile information, add token holdings, and apply multipliers
    const transformedData = leaderboardData.map((entry, index) => {
      let profile, leaderboardInfo, tokenBalance, basePoints, userFid;
      
      if (isHoldingsQuery) {
        // Data from profiles table
        profile = entry;
        leaderboardInfo = entry.user_leaderboard?.[0] || {};
        tokenBalance = entry.token_balance || 0;
        basePoints = leaderboardInfo.total_points || 0;
        userFid = entry.fid;
      } else {
        // Data from user_leaderboard table
        profile = entry.profiles || {};
        leaderboardInfo = entry;
        tokenBalance = profile.token_balance || 0;
        basePoints = entry.total_points || 0;
        userFid = entry.user_fid;
      }
      
      // Apply token multiplier to total points
      const multiplierResult = applyTokenMultiplier(basePoints, tokenBalance);
      
      // Debug first few entries
      if (index < 5) {
        console.log(`🔍 Entry ${index}: FID ${userFid}, isHoldingsQuery: ${isHoldingsQuery}, tokenBalance:`, tokenBalance, 'multiplier:', multiplierResult.multiplier);
      }
      
      return {
        // Normalize the data structure
        user_fid: userFid,
        fid: userFid, // For compatibility
        username: profile.username || leaderboardInfo.username,
        display_name: profile.display_name || leaderboardInfo.display_name,
        pfp_url: profile.pfp_url,
        token_balance: tokenBalance,
        token_balance_updated_at: profile.token_balance_updated_at,
        // Leaderboard stats (may be 0 for users who haven't engaged)
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