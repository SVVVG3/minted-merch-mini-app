import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
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

    // Build base query
    let baseQuery = supabaseAdmin
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
      const profile = entry.profiles || {};
      
      // Keep token balance in wei format (as expected by frontend formatTokenBalance function)
      const tokenBalanceWei = profile.token_balance || 0;
      const basePoints = entry.total_points || 0;
      
      // Apply token multiplier to total points
      const multiplierResult = applyTokenMultiplier(basePoints, tokenBalanceWei);
      
      // Debug first few entries
      if (index < 5) {
        console.log(`🔍 Entry ${index}: FID ${entry.user_fid}, profile:`, profile, 'tokenBalance:', tokenBalanceWei, 'multiplier:', multiplierResult.multiplier);
      }
      
      return {
        ...entry,
        // Use profile data if available, fallback to leaderboard data
        username: profile.username || entry.username,
        display_name: profile.display_name || entry.display_name,
        pfp_url: profile.pfp_url,
        token_balance: tokenBalanceWei, // Keep in wei format for frontend formatTokenBalance function
        // Store both original and multiplied points
        base_points: basePoints,
        total_points: multiplierResult.multipliedPoints,
        token_multiplier: multiplierResult.multiplier,
        token_tier: multiplierResult.tier,
        // Remove the nested profiles object
        profiles: undefined
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
        default:
          return (b.total_points || 0) - (a.total_points || 0);
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
} 