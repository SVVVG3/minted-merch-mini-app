import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';
import { getCurrent8AMPST } from '@/lib/timezone';

/**
 * GET /api/admin/dailyspin-stats
 * 
 * Returns daily spin statistics for admin dashboard:
 * - Total spins (all time)
 * - Total spins today
 * - Claims by token
 * - Spin log by user and day
 */
export const GET = withAdminAuth(async (request) => {
  try {
    // Get today's date (8 AM PST boundary)
    const todayStart = getCurrent8AMPST();
    const todayDate = todayStart.toISOString().split('T')[0];

    // Total spins all time (including misses)
    const { count: totalSpinsAllTime, error: totalError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('Error fetching total spins:', totalError);
    }

    // Total spins today
    const { count: totalSpinsToday, error: todayError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('spin_date', todayDate);

    if (todayError) {
      console.error('Error fetching today spins:', todayError);
    }

    // Total wins (excluding MISS - amount > 0)
    const { count: totalWins, error: winsError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .gt('amount', '0');

    if (winsError) {
      console.error('Error fetching total wins:', winsError);
    }

    // Total misses (amount = 0)
    const { count: totalMisses, error: missesError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('amount', '0');

    if (missesError) {
      console.error('Error fetching total misses:', missesError);
    }

    // Claims by token (grouped)
    const { data: claimsByToken, error: claimsError } = await supabaseAdmin
      .from('spin_winnings')
      .select(`
        token_id,
        amount,
        claimed,
        spin_tokens (
          symbol,
          name,
          decimals,
          segment_color
        )
      `)
      .gt('amount', '0'); // Exclude MISS

    if (claimsError) {
      console.error('Error fetching claims by token:', claimsError);
    }

    // Aggregate claims by token
    const tokenStats = {};
    for (const claim of claimsByToken || []) {
      const symbol = claim.spin_tokens?.symbol || 'Unknown';
      if (!tokenStats[symbol]) {
        tokenStats[symbol] = {
          symbol,
          name: claim.spin_tokens?.name || symbol,
          color: claim.spin_tokens?.segment_color || '#6b7280',
          decimals: claim.spin_tokens?.decimals || 18,
          totalSpins: 0,
          totalClaimed: 0,
          totalUnclaimed: 0,
          totalAmountWei: BigInt(0),
          claimedAmountWei: BigInt(0),
          unclaimedAmountWei: BigInt(0)
        };
      }
      tokenStats[symbol].totalSpins += 1;
      tokenStats[symbol].totalAmountWei += BigInt(claim.amount);
      if (claim.claimed) {
        tokenStats[symbol].totalClaimed += 1;
        tokenStats[symbol].claimedAmountWei += BigInt(claim.amount);
      } else {
        tokenStats[symbol].totalUnclaimed += 1;
        tokenStats[symbol].unclaimedAmountWei += BigInt(claim.amount);
      }
    }

    // Convert BigInt to display amounts
    const tokenStatsArray = Object.values(tokenStats).map(stat => ({
      symbol: stat.symbol,
      name: stat.name,
      color: stat.color,
      decimals: stat.decimals,
      totalSpins: stat.totalSpins,
      totalClaimed: stat.totalClaimed,
      totalUnclaimed: stat.totalUnclaimed,
      totalAmount: (Number(stat.totalAmountWei) / Math.pow(10, stat.decimals)).toFixed(2),
      claimedAmount: (Number(stat.claimedAmountWei) / Math.pow(10, stat.decimals)).toFixed(2),
      unclaimedAmount: (Number(stat.unclaimedAmountWei) / Math.pow(10, stat.decimals)).toFixed(2),
    }));

    // Spin log by user and day (last 7 days, aggregated)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoDate = sevenDaysAgo.toISOString().split('T')[0];

    const { data: recentSpins, error: recentError } = await supabaseAdmin
      .from('spin_winnings')
      .select(`
        user_fid,
        spin_date,
        amount,
        claimed,
        spin_tokens (
          symbol
        )
      `)
      .gte('spin_date', sevenDaysAgoDate)
      .order('spin_date', { ascending: false })
      .order('user_fid', { ascending: true });

    if (recentError) {
      console.error('Error fetching recent spins:', recentError);
    }

    // Aggregate by user and day
    const userDayStats = {};
    for (const spin of recentSpins || []) {
      const key = `${spin.user_fid}-${spin.spin_date}`;
      if (!userDayStats[key]) {
        userDayStats[key] = {
          userFid: spin.user_fid,
          spinDate: spin.spin_date,
          totalSpins: 0,
          wins: 0,
          misses: 0,
          tokensWon: {},
          claimed: 0
        };
      }
      userDayStats[key].totalSpins += 1;
      if (spin.amount !== '0' && spin.amount !== 0) {
        userDayStats[key].wins += 1;
        const symbol = spin.spin_tokens?.symbol || 'Unknown';
        userDayStats[key].tokensWon[symbol] = (userDayStats[key].tokensWon[symbol] || 0) + 1;
        if (spin.claimed) {
          userDayStats[key].claimed += 1;
        }
      } else {
        userDayStats[key].misses += 1;
      }
    }

    // Convert to array and sort by date desc, then fid
    const spinLog = Object.values(userDayStats)
      .map(stat => ({
        ...stat,
        tokensWonSummary: Object.entries(stat.tokensWon)
          .map(([symbol, count]) => `${count}x ${symbol}`)
          .join(', ') || 'None'
      }))
      .sort((a, b) => {
        const dateCompare = b.spinDate.localeCompare(a.spinDate);
        if (dateCompare !== 0) return dateCompare;
        return a.userFid - b.userFid;
      });

    // Unique users who have spun
    const uniqueSpinners = new Set(recentSpins?.map(s => s.user_fid) || []);

    return NextResponse.json({
      success: true,
      stats: {
        totalSpinsAllTime: totalSpinsAllTime || 0,
        totalSpinsToday: totalSpinsToday || 0,
        totalWins: totalWins || 0,
        totalMisses: totalMisses || 0,
        winRate: totalSpinsAllTime > 0 ? ((totalWins / totalSpinsAllTime) * 100).toFixed(1) : '0',
        uniqueSpinnersLast7Days: uniqueSpinners.size,
        todayDate
      },
      tokenStats: tokenStatsArray,
      spinLog
    });

  } catch (error) {
    console.error('Error in /api/admin/dailyspin-stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});
