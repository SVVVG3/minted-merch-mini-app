import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    console.log('📊 Admin fetching dashboard stats');

    // Get total users in leaderboard
    const { count: totalUsers, error: usersError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('user_fid', { count: 'exact', head: true });

    if (usersError) {
      console.error('Error fetching total users:', usersError);
    }

    // Get users with active streaks (streak > 0)
    const { count: activeStreaks, error: streaksError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('user_fid', { count: 'exact', head: true })
      .gt('checkin_streak', 0);

    if (streaksError) {
      console.error('Error fetching active streaks:', streaksError);
    }

    // Get total points awarded across all users
    const { data: pointsData, error: pointsError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('total_points');

    let totalPoints = 0;
    if (!pointsError && pointsData) {
      totalPoints = pointsData.reduce((sum, user) => sum + (user.total_points || 0), 0);
    }

    // Get total orders across all users
    const { data: ordersData, error: ordersError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('total_orders');

    let totalOrders = 0;
    if (!ordersError && ordersData) {
      totalOrders = ordersData.reduce((sum, user) => sum + (user.total_orders || 0), 0);
    }

    // Get top streaks
    const { data: topStreaks, error: topStreaksError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('username, checkin_streak')
      .order('checkin_streak', { ascending: false })
      .limit(5);

    // Get top spenders
    const { data: topSpenders, error: topSpendersError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('username, total_spent')
      .order('total_spent', { ascending: false })
      .gt('total_spent', 0)
      .limit(5);

    const stats = {
      totalUsers: totalUsers || 0,
      activeStreaks: activeStreaks || 0,
      totalPoints: totalPoints,
      totalOrders: totalOrders,
      topStreaks: topStreaks || [],
      topSpenders: topSpenders || []
    };

    console.log('✅ Successfully fetched dashboard stats:', stats);

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error in admin stats API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 