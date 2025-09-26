import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 1000;
    const sortBy = searchParams.get('sortBy') || 'total_points';
    
    console.log(`📊 Admin fetching leaderboard data - limit: ${limit}, sortBy: ${sortBy}`);

    // Get all leaderboard data with profile information (images, token holdings, etc.)
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
      .limit(limit);

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

    const { data: leaderboardData, error } = await query;

    if (error) {
      console.error('Error fetching admin leaderboard:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch leaderboard data' },
        { status: 500 }
      );
    }

    // Transform the data to flatten profile information and add token holdings
    const transformedData = leaderboardData.map(entry => {
      const profile = entry.profiles || {};
      
      // Convert token balance from wei to tokens for display
      const tokenBalanceWei = profile.token_balance || 0;
      const tokenBalanceTokens = tokenBalanceWei / Math.pow(10, 18);
      
      // Debug logging for first few entries
      if (entry.user_fid <= 196041) {
        console.log(`🔍 Debug FID ${entry.user_fid}: tokenBalanceWei=${tokenBalanceWei}, tokenBalanceTokens=${tokenBalanceTokens}, profile=`, profile);
      }
      
      return {
        ...entry,
        // Use profile data if available, fallback to leaderboard data
        username: profile.username || entry.username,
        display_name: profile.display_name || entry.display_name,
        pfp_url: profile.pfp_url,
        token_holdings: Math.round(tokenBalanceTokens), // Round to whole numbers for display
        // Keep raw token balance for debugging
        raw_token_balance: tokenBalanceWei,
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