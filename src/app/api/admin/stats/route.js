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

    // Get users with active streaks (streak >= 2, since 1 day isn't really a streak)
    const { count: activeStreaks, error: streaksError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('user_fid', { count: 'exact', head: true })
      .gte('checkin_streak', 2);

    if (streaksError) {
      console.error('Error fetching active streaks:', streaksError);
    }

    // Get check-ins today (California time)
    // Calculate today's date in California time (PST/PDT)
    const now = new Date();
    const californiaOffset = -8; // UTC-8 for PST (will be -7 for PDT, but we'll use -8 to be safe)
    const californiaTime = new Date(now.getTime() + (californiaOffset * 60 * 60 * 1000));
    
    // Get start of today in California time
    const startOfTodayCA = new Date(californiaTime.getFullYear(), californiaTime.getMonth(), californiaTime.getDate());
    
    // Convert back to UTC for database query
    const startOfTodayUTC = new Date(startOfTodayCA.getTime() - (californiaOffset * 60 * 60 * 1000));
    
    console.log('🕐 Check-ins today calculation:');
    console.log('  Current UTC time:', now.toISOString());
    console.log('  California time:', californiaTime.toISOString());
    console.log('  Start of today CA:', startOfTodayCA.toISOString());
    console.log('  Start of today UTC:', startOfTodayUTC.toISOString());

    const { count: checkInsToday, error: checkInsError } = await supabaseAdmin
      .from('point_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', startOfTodayUTC.toISOString());

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
    const { count: totalOrders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true });

    if (ordersError) {
      console.error('Error fetching total orders:', ordersError);
    }

    // Get users with notifications enabled
    const { count: usersWithNotifications, error: notificationsError } = await supabaseAdmin
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .eq('has_notifications', true);

    if (notificationsError) {
      console.error('Error fetching users with notifications:', notificationsError);
    }

    // Get total discounts used
    const { count: discountsUsed, error: discountsUsedError } = await supabaseAdmin
      .from('discount_code_usage')
      .select('id', { count: 'exact', head: true });

    if (discountsUsedError) {
      console.error('Error fetching discounts used:', discountsUsedError);
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
      usersWithNotifications: usersWithNotifications || 0,
      discountsUsed: discountsUsed || 0,
      totalPoints: totalPoints,
      totalOrders: totalOrders || 0,
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