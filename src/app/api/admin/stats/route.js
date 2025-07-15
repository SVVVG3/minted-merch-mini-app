import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    console.log('📊 Admin fetching dashboard stats');

    // Get total users from profiles table
    const { count: totalUsers, error: totalUsersError } = await supabaseAdmin
      .from('profiles')
      .select('fid', { count: 'exact', head: true });

    if (totalUsersError) {
      console.error('Error fetching total users:', totalUsersError);
    }

    // Get users on leaderboard (previously called totalUsers)
    const { count: usersOnLeaderboard, error: usersError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('user_fid', { count: 'exact', head: true });

    if (usersError) {
      console.error('Error fetching users on leaderboard:', usersError);
    }

    // Get users with active streaks (streak > 0)
    const { count: activeStreaks, error: streaksError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('user_fid', { count: 'exact', head: true })
      .gt('checkin_streak', 0);

    if (streaksError) {
      console.error('Error fetching active streaks:', streaksError);
    }

    // Get check-ins today
    const { count: checkInsToday, error: checkInsError } = await supabaseAdmin
      .from('point_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', new Date().toISOString().split('T')[0]);

    if (checkInsError) {
      console.error('Error fetching check-ins today:', checkInsError);
    }

    // Get last raffle information
    const { data: lastRaffleData, error: lastRaffleError } = await supabaseAdmin
      .from('raffle_winners')
      .select(`
        raffle_timestamp,
        raffle_criteria,
        total_winners,
        total_eligible_users,
        raffle_winner_entries!fk_raffle_winner_entries_raffle_id(
          user_fid,
          username,
          winner_position
        )
      `)
      .order('raffle_timestamp', { ascending: false })
      .limit(1);

    let lastRaffle = null;
    if (!lastRaffleError && lastRaffleData && lastRaffleData.length > 0) {
      const raffle = lastRaffleData[0];
      lastRaffle = {
        date: raffle.raffle_timestamp,
        criteria: raffle.raffle_criteria,
        totalWinners: raffle.total_winners,
        totalEligible: raffle.total_eligible_users,
        winners: raffle.raffle_winner_entries ? raffle.raffle_winner_entries.map(winner => ({
          fid: winner.user_fid,
          username: winner.username,
          position: winner.winner_position
        })) : []
      };
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
      usersOnLeaderboard: usersOnLeaderboard || 0,
      activeStreaks: activeStreaks || 0,
      checkInsToday: checkInsToday || 0,
      totalPoints: totalPoints,
      totalOrders: totalOrders,
      lastRaffle: lastRaffle,
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