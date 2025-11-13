import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/adminAuth';
import { formatPSTTime, getCurrent8AMPST } from '@/lib/timezone';

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

export const GET = withAdminAuth(async (request) => {
  try {
    console.log('📊 Admin fetching dashboard stats');

    // Get Merch Moguls count (users with 50M+ $MINTEDMERCH tokens)
    const { count: merchMoguls, error: merchMogulsError } = await supabaseAdmin
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .gte('token_balance', '50000000'); // 50M tokens (stored as token values, not wei)

    if (merchMogulsError) {
      console.error('Error fetching Merch Moguls count:', merchMogulsError);
    }

    // Get holders of 1M+ $MINTEDMERCH tokens
    const { count: holdersOneMillion, error: holdersOnMillionError } = await supabaseAdmin
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .gte('token_balance', '1000000'); // 1M tokens (stored as token values, not wei)

    if (holdersOnMillionError) {
      console.error('Error fetching 1M+ holders count:', holdersOnMillionError);
    }

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

    // Get check-ins today using proper 8 AM PST reset logic
    // Uses the timezone utilities which properly handle DST transitions
    const todayPSTStart = getCurrent8AMPST();
    
    console.log('🕐 Check-ins today calculation (8 AM Pacific reset):');
    console.log('  Current Pacific time:', formatPSTTime());
    console.log('  Today Pacific start (8 AM):', todayPSTStart.toISOString());
    console.log('  Using America/Los_Angeles timezone (automatic DST handling)');

    // Count only COMPLETED check-ins (not pending transactions)
    const { count: checkInsToday, error: checkInsError } = await supabaseAdmin
      .from('point_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('transaction_type', 'daily_checkin')
      .gt('points_earned', 0) // Only count completed check-ins with points
      .gte('created_at', todayPSTStart.toISOString());

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
    // Use pagination to ensure we get ALL users, not just the first 1000
    let totalPoints = 0;
    let allPointsData = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    console.log('📊 Fetching total points from all users with pagination...');

    while (hasMore) {
      const { data: pointsData, error: pointsError } = await supabaseAdmin
        .from('user_leaderboard')
        .select('total_points')
        .range(offset, offset + batchSize - 1);

      if (pointsError) {
        console.error('Error fetching points data batch:', pointsError);
        break;
      }

      if (!pointsData || pointsData.length === 0) {
        hasMore = false;
        break;
      }

      allPointsData.push(...pointsData);
      offset += batchSize;

      console.log(`📊 Fetched batch: ${pointsData.length} users (total so far: ${allPointsData.length})`);

      // If we got less than the batch size, we've reached the end
      if (pointsData.length < batchSize) {
        hasMore = false;
      }
    }

    // Calculate total points from all users
    totalPoints = allPointsData.reduce((sum, user) => sum + (user.total_points || 0), 0);
    
    console.log(`📊 Total points calculation: ${allPointsData.length} users, ${totalPoints.toLocaleString()} total points`);

    // Get total orders across all users
    const { count: totalOrders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true });

    if (ordersError) {
      console.error('Error fetching total orders:', ordersError);
    }

    // Get users with notifications enabled on EITHER Farcaster OR Base
    const { count: usersWithNotifications, error: notificationsError } = await supabaseAdmin
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .or('has_notifications.eq.true,has_base_notifications.eq.true');

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

    // Get total revenue from orders (amounts are already in dollars, not cents)
    const { data: revenueData, error: revenueError } = await supabaseAdmin
      .from('orders')
      .select('amount_total')
      .not('amount_total', 'is', null);

    let totalRevenue = 0;
    if (!revenueError && revenueData) {
      totalRevenue = revenueData.reduce((sum, order) => sum + (parseFloat(order.amount_total) || 0), 0);
      // Amounts are already in dollars, no conversion needed
    }

    if (revenueError) {
      console.error('Error fetching total revenue:', revenueError);
    }

    // Get staking statistics
    // Count users with staked tokens (staked_balance > 0)
    const { count: walletsStaked, error: walletsStakedError } = await supabaseAdmin
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .gt('staked_balance', 0);

    if (walletsStakedError) {
      console.error('Error fetching wallets staked count:', walletsStakedError);
    }

    // Get total amount of $MINTEDMERCH staked
    const { data: stakedData, error: stakedError } = await supabaseAdmin
      .from('profiles')
      .select('staked_balance')
      .gt('staked_balance', 0);

    let totalStaked = 0;
    if (!stakedError && stakedData) {
      totalStaked = stakedData.reduce((sum, profile) => {
        const balance = parseFloat(profile.staked_balance) || 0;
        return sum + balance;
      }, 0);
    }

    if (stakedError) {
      console.error('Error fetching total staked:', stakedError);
    }

    console.log(`📊 Staking stats: ${walletsStaked || 0} wallets with ${totalStaked.toLocaleString()} tokens staked`);

    // Get pending bounty submissions count
    const { count: pendingSubmissions, error: submissionsError } = await supabaseAdmin
      .from('bounty_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (submissionsError) {
      console.error('Error fetching pending submissions:', submissionsError);
    }

    console.log(`📊 Pending bounty submissions: ${pendingSubmissions || 0}`);

    const stats = {
      totalUsers: totalUsers || 0,
      usersOnLeaderboard: usersOnLeaderboard || 0,
      activeStreaks: activeStreaks || 0,
      checkInsToday: checkInsToday || 0,
      usersWithNotifications: usersWithNotifications || 0,
      discountsUsed: discountsUsed || 0,
      totalPoints: totalPoints,
      totalOrders: totalOrders || 0,
      totalRevenue: totalRevenue,
      merchMoguls: merchMoguls || 0,
      holdersOneMillion: holdersOneMillion || 0,
      walletsStaked: walletsStaked || 0,
      totalStaked: totalStaked,
      pendingSubmissions: pendingSubmissions || 0,
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
}); 