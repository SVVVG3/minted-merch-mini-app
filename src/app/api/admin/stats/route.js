import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/adminAuth';
import { formatPSTTime, getCurrent8AMPST } from '@/lib/timezone';
import { getGlobalTotalStaked, getStakingStats, getGlobalTotalClaimed, getUnclaimedRewards } from '@/lib/stakingBalanceAPI';

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

    // Get daily spin claims today (replaces old check-ins)
    // Get today's date in UTC for spin_date comparison
    const todayDate = new Date().toISOString().split('T')[0];
    
    // Count actual claims today (where user submitted a transaction)
    const { count: claimsToday, error: claimsError } = await supabaseAdmin
      .from('spin_winnings')
      .select('id', { count: 'exact', head: true })
      .eq('spin_date', todayDate)
      .not('claim_tx_hash', 'is', null);

    if (claimsError) {
      console.error('Error fetching claims today:', claimsError);
    }

    // Count unique users who spun today
    const { data: uniqueSpinnersToday, error: uniqueSpinnersError } = await supabaseAdmin
      .from('spin_winnings')
      .select('user_fid')
      .eq('spin_date', todayDate);

    const uniqueUsersToday = uniqueSpinnersError ? 0 : new Set(uniqueSpinnersToday?.map(s => s.user_fid) || []).size;

    if (uniqueSpinnersError) {
      console.error('Error fetching unique spinners today:', uniqueSpinnersError);
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
    // Total staked from RPC (real-time), wallet count from PAGINATED subgraph (live data)
    // This gives accurate count of ALL stakers, not limited to 1000 or only users who opened the app
    const { totalStaked, uniqueStakers: walletsStaked } = await getStakingStats();
    console.log(`📊 Staking stats: ${walletsStaked || 0} wallets with ${totalStaked.toLocaleString()} tokens staked (live from subgraph)`);

    // Get total rewards claimed from LIVE subgraph (paginated to get ALL claims)
    const totalRewardsClaimed = await getGlobalTotalClaimed();
    console.log(`📊 Live rewards claimed from subgraph: ${totalRewardsClaimed.toLocaleString()} tokens`);
    
    // Get unclaimed rewards remaining in the rewards contract
    const unclaimedRewards = await getUnclaimedRewards();
    console.log(`📊 Unclaimed rewards in contract: ${unclaimedRewards.toLocaleString()} tokens`);

    // Get pending bounty submissions count
    const { count: pendingSubmissions, error: submissionsError } = await supabaseAdmin
      .from('bounty_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (submissionsError) {
      console.error('Error fetching pending submissions:', submissionsError);
    }

    console.log(`📊 Pending bounty submissions: ${pendingSubmissions || 0}`);

    // Get completed bounty submissions count (approved) and total tokens paid
    const { count: completedBounties, error: completedError } = await supabaseAdmin
      .from('bounty_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');

    if (completedError) {
      console.error('Error fetching completed bounties:', completedError);
    }

    // Get total tokens paid out for completed bounties
    const { data: payoutsData, error: payoutsError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select('amount_tokens')
      .in('status', ['claimable', 'processing', 'completed']); // All valid payouts

    let totalTokensPaid = 0;
    if (payoutsError) {
      console.error('Error fetching bounty payouts:', payoutsError);
    } else if (payoutsData) {
      totalTokensPaid = payoutsData.reduce((sum, payout) => sum + (parseInt(payout.amount_tokens) || 0), 0);
    }

    console.log(`📊 Completed bounties: ${completedBounties || 0}, Total tokens paid: ${totalTokensPaid}`);

    const stats = {
      totalUsers: totalUsers || 0,
      usersOnLeaderboard: usersOnLeaderboard || 0,
      activeStreaks: activeStreaks || 0,
      claimsToday: claimsToday || 0,
      uniqueUsersToday: uniqueUsersToday || 0,
      usersWithNotifications: usersWithNotifications || 0,
      discountsUsed: discountsUsed || 0,
      totalPoints: totalPoints,
      totalOrders: totalOrders || 0,
      totalRevenue: totalRevenue,
      merchMoguls: merchMoguls || 0,
      holdersOneMillion: holdersOneMillion || 0,
      walletsStaked: walletsStaked || 0,
      totalStaked: totalStaked,
      totalRewardsClaimed: totalRewardsClaimed || 0,
      unclaimedRewards: unclaimedRewards || 0,
      pendingSubmissions: pendingSubmissions || 0,
      completedBounties: completedBounties || 0,
      totalTokensPaid: totalTokensPaid || 0,
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