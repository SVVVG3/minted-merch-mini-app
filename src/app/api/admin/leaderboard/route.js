import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 10000;
    const sortBy = searchParams.get('sortBy') || 'total_points';
    
    console.log(`📊 Admin fetching leaderboard data - limit: ${limit}, sortBy: ${sortBy}`);

    // Get all leaderboard data with profile information (images, token holdings, etc.)
    // Force high limit to bypass Supabase default 1000 row limit
    let query = supabaseAdmin
      .from('user_leaderboard')
      .select(`
        *,
        profiles!user_fid (
          username,
          display_name,
          pfp_url,
          token_balance
        )
      `)
      .limit(50000); // Force very high limit

    // Sort based on requested field
    switch (sortBy) {
      case 'total_points':
        query = query.order('total_points', { ascending: false });
        break;
      case 'checkin_streak':
        query = query.order('checkin_streak', { ascending: false });
        break;
      case 'points_from_purchases':
        query = query.order('points_from_purchases', { ascending: false });
        break;
      case 'total_orders':
        query = query.order('total_orders', { ascending: false });
        break;
      default:
        query = query.order('total_points', { ascending: false });
    }

    // Execute the query with high limit
    const { data: leaderboardData, error } = await query;

    if (error) {
      console.error('Error fetching admin leaderboard:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch leaderboard data' },
        { status: 500 }
      );
    }

    console.log(`📊 Successfully fetched ${leaderboardData?.length || 0} leaderboard entries`);

    // Transform the data to flatten profile information and add token holdings
    const transformedData = leaderboardData.map((entry, index) => {
      const profile = entry.profiles || {};
      
      // Keep token balance in wei format (as expected by frontend formatTokenBalance function)
      const tokenBalanceWei = profile.token_balance || 0;
      
      // Debug first few entries
      if (index < 5) {
        console.log(`🔍 Entry ${index}: FID ${entry.user_fid}, profile:`, profile, 'tokenBalance:', tokenBalanceWei);
      }
      
      return {
        ...entry,
        // Use profile data if available, fallback to leaderboard data
        username: profile.username || entry.username,
        display_name: profile.display_name || entry.display_name,
        pfp_url: profile.pfp_url,
        token_balance: tokenBalanceWei, // Keep in wei format for frontend formatTokenBalance function
        // Remove the nested profiles object
        profiles: undefined
      };
    });

    console.log(`✅ Successfully fetched ${transformedData.length} leaderboard entries with profile data`);

    return NextResponse.json({
      success: true,
      data: transformedData,
      total: transformedData.length,
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