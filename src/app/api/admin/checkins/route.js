import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserLeaderboardData } from '@/lib/points.js';

// Use service role client to bypass RLS for admin endpoints
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request) {
  try {
    console.log('Fetching all check-ins for admin dashboard...');

    // Fetch all daily check-ins from point_transactions table with profile info
    const { data: checkins, error } = await supabaseAdmin
      .from('point_transactions')
      .select(`
        id,
        user_fid,
        points_earned,
        transaction_type,
        created_at,
        profiles!inner (
          username,
          display_name,
          pfp_url
        )
      `)
      .eq('transaction_type', 'daily_checkin')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching check-ins:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch check-ins' 
      }, { status: 500 });
    }

    // Transform data to flatten the profile info and add leaderboard data
    const transformedCheckins = await Promise.all(
      checkins.map(async (checkin) => {
        // Get user's total points and streak from leaderboard
        const leaderboardData = await getUserLeaderboardData(checkin.user_fid);
        
        return {
          id: checkin.id,
          user_fid: checkin.user_fid,
          username: checkin.profiles?.username || 'N/A',
          display_name: checkin.profiles?.display_name || 'N/A',
          pfp_url: checkin.profiles?.pfp_url || null,
          points_earned: checkin.points_earned,
          total_points: leaderboardData?.total_points || 0,
          checkin_streak: leaderboardData?.checkin_streak || 0,
          transaction_type: checkin.transaction_type,
          created_at: checkin.created_at
        };
      })
    );

    console.log(`Fetched ${transformedCheckins.length} check-ins successfully`);

    return NextResponse.json({
      success: true,
      data: transformedCheckins || []
    });

  } catch (error) {
    console.error('Error in checkins API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 