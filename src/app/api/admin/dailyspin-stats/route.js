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
    
    // Get yesterday's date
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayDate = yesterdayStart.toISOString().split('T')[0];

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

    // Unique users who spun today
    const { data: todaySpinners, error: todaySpinnersError } = await supabaseAdmin
      .from('spin_winnings')
      .select('user_fid')
      .eq('spin_date', todayDate);

    if (todaySpinnersError) {
      console.error('Error fetching today spinners:', todaySpinnersError);
    }
    const uniqueUsersToday = new Set(todaySpinners?.map(s => s.user_fid) || []).size;

    // Wins today
    const { count: winsToday, error: winsTodayError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('spin_date', todayDate)
      .gt('amount', '0');

    if (winsTodayError) {
      console.error('Error fetching wins today:', winsTodayError);
    }

    // Misses today
    const { count: missesToday, error: missesTodayError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('spin_date', todayDate)
      .eq('amount', '0');

    if (missesTodayError) {
      console.error('Error fetching misses today:', missesTodayError);
    }

    // ===== YESTERDAY'S STATS =====
    // Total spins yesterday
    const { count: totalSpinsYesterday, error: yesterdayError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('spin_date', yesterdayDate);

    if (yesterdayError) {
      console.error('Error fetching yesterday spins:', yesterdayError);
    }

    // Unique users who spun yesterday
    const { data: yesterdaySpinners, error: yesterdaySpinnersError } = await supabaseAdmin
      .from('spin_winnings')
      .select('user_fid')
      .eq('spin_date', yesterdayDate);

    if (yesterdaySpinnersError) {
      console.error('Error fetching yesterday spinners:', yesterdaySpinnersError);
    }
    const uniqueUsersYesterday = new Set(yesterdaySpinners?.map(s => s.user_fid) || []).size;

    // Wins yesterday
    const { count: winsYesterday, error: winsYesterdayError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('spin_date', yesterdayDate)
      .gt('amount', '0');

    if (winsYesterdayError) {
      console.error('Error fetching wins yesterday:', winsYesterdayError);
    }

    // Misses yesterday
    const { count: missesYesterday, error: missesYesterdayError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('spin_date', yesterdayDate)
      .eq('amount', '0');

    if (missesYesterdayError) {
      console.error('Error fetching misses yesterday:', missesYesterdayError);
    }

    // Total wins all time (excluding MISS - amount > 0)
    const { count: totalWinsAllTime, error: winsError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .gt('amount', '0');

    if (winsError) {
      console.error('Error fetching total wins:', winsError);
    }

    // Total misses all time (amount = 0)
    const { count: totalMissesAllTime, error: missesError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('amount', '0');

    if (missesError) {
      console.error('Error fetching total misses:', missesError);
    }

    // ===== CLAIM TRANSACTION STATS =====
    // Claims today - only count actual claim transactions (where claim_tx_hash is set)
    // Note: Miss records are pre-marked claimed=true during spin but don't have tx hash until claimed
    const { count: claimsToday, error: claimsTodayError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('spin_date', todayDate)
      .not('claim_tx_hash', 'is', null);

    if (claimsTodayError) {
      console.error('Error fetching claims today:', claimsTodayError);
    }

    // Donations today (mojo boosts) - these will have both donated=true AND claim_tx_hash
    const { count: donationsToday, error: donationsTodayError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('spin_date', todayDate)
      .eq('donated', true)
      .not('claim_tx_hash', 'is', null);

    if (donationsTodayError) {
      console.error('Error fetching donations today:', donationsTodayError);
    }

    // Claims yesterday
    const { count: claimsYesterday, error: claimsYesterdayError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('spin_date', yesterdayDate)
      .not('claim_tx_hash', 'is', null);

    if (claimsYesterdayError) {
      console.error('Error fetching claims yesterday:', claimsYesterdayError);
    }

    // Donations yesterday
    const { count: donationsYesterday, error: donationsYesterdayError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('spin_date', yesterdayDate)
      .eq('donated', true)
      .not('claim_tx_hash', 'is', null);

    if (donationsYesterdayError) {
      console.error('Error fetching donations yesterday:', donationsYesterdayError);
    }

    // Total claims all time (with actual transaction)
    const { count: totalClaimsAllTime, error: claimsAllTimeError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .not('claim_tx_hash', 'is', null);

    if (claimsAllTimeError) {
      console.error('Error fetching total claims:', claimsAllTimeError);
    }

    // Total donations all time (mojo boosts with actual transaction)
    const { count: totalDonationsAllTime, error: donationsAllTimeError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('donated', true)
      .not('claim_tx_hash', 'is', null);

    if (donationsAllTimeError) {
      console.error('Error fetching total donations:', donationsAllTimeError);
    }

    // Claims by token (grouped) - include donated status to properly categorize
    const { data: claimsByToken, error: claimsError } = await supabaseAdmin
      .from('spin_winnings')
      .select(`
        token_id,
        amount,
        claimed,
        donated,
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
    // FIXED: Properly categorize claimed vs donated vs unclaimed
    // - CLAIMED: claimed=true AND donated=false (user actually received tokens)
    // - MOJO BOOSTED: donated=true (low Mojo users who forfeited tokens for a Mojo boost)
    // - UNCLAIMED: claimed=false AND donated=false (still pending)
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
          totalMojoBoosted: 0,
          totalAmountWei: BigInt(0),
          claimedAmountWei: BigInt(0),
          unclaimedAmountWei: BigInt(0),
          mojoBoostedAmountWei: BigInt(0)
        };
      }
      tokenStats[symbol].totalSpins += 1;
      tokenStats[symbol].totalAmountWei += BigInt(claim.amount);
      
      // Only count as CLAIMED if actually claimed AND not donated (forfeited)
      if (claim.claimed && !claim.donated) {
        tokenStats[symbol].totalClaimed += 1;
        tokenStats[symbol].claimedAmountWei += BigInt(claim.amount);
      } else if (claim.donated) {
        // MOJO BOOSTED: user forfeited these tokens for a Mojo boost
        tokenStats[symbol].totalMojoBoosted += 1;
        tokenStats[symbol].mojoBoostedAmountWei += BigInt(claim.amount);
      } else if (!claim.claimed && !claim.donated) {
        // Only count as UNCLAIMED if not yet claimed and not donated
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
      totalMojoBoosted: stat.totalMojoBoosted,
      totalAmount: (Number(stat.totalAmountWei) / Math.pow(10, stat.decimals)).toFixed(4),
      claimedAmount: (Number(stat.claimedAmountWei) / Math.pow(10, stat.decimals)).toFixed(4),
      unclaimedAmount: (Number(stat.unclaimedAmountWei) / Math.pow(10, stat.decimals)).toFixed(4),
      mojoBoostedAmount: (Number(stat.mojoBoostedAmountWei) / Math.pow(10, stat.decimals)).toFixed(4),
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
        donated,
        created_at,
        spin_tokens (
          symbol
        )
      `)
      .gte('spin_date', sevenDaysAgoDate)
      .order('created_at', { ascending: false });

    if (recentError) {
      console.error('Error fetching recent spins:', recentError);
    }

    // Get unique FIDs to fetch profile data
    const uniqueFids = [...new Set(recentSpins?.map(s => s.user_fid) || [])];
    
    // Fetch profile data for all unique users
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, pfp_url')
      .in('fid', uniqueFids);
    
    // Create a map for quick profile lookup
    const profileMap = {};
    for (const profile of profiles || []) {
      profileMap[profile.fid] = {
        username: profile.username,
        pfpUrl: profile.pfp_url
      };
    }

    // Aggregate by user and day
    const userDayStats = {};
    for (const spin of recentSpins || []) {
      const key = `${spin.user_fid}-${spin.spin_date}`;
      if (!userDayStats[key]) {
        const profile = profileMap[spin.user_fid] || {};
        userDayStats[key] = {
          userFid: spin.user_fid,
          username: profile.username || null,
          pfpUrl: profile.pfpUrl || null,
          spinDate: spin.spin_date,
          latestSpinTime: spin.created_at, // Track latest spin time for sorting
          totalSpins: 0,
          wins: 0,
          misses: 0,
          tokensWon: {},
          claimed: 0,
          donated: 0
        };
      }
      // Update latest spin time if this spin is more recent
      if (spin.created_at > userDayStats[key].latestSpinTime) {
        userDayStats[key].latestSpinTime = spin.created_at;
      }
      userDayStats[key].totalSpins += 1;
      
      // Track donated for ALL spins (mojo boosts can be from wins OR misses)
      if (spin.donated) {
        userDayStats[key].donated += 1;
      }
      
      if (spin.amount !== '0' && spin.amount !== 0) {
        userDayStats[key].wins += 1;
        const symbol = spin.spin_tokens?.symbol || 'Unknown';
        userDayStats[key].tokensWon[symbol] = (userDayStats[key].tokensWon[symbol] || 0) + 1;
        // Only count claimed for WINS (this is the "X/Y" display where Y = wins)
        if (spin.claimed) {
          userDayStats[key].claimed += 1;
        }
      } else {
        userDayStats[key].misses += 1;
      }
    }

    // Convert to array and sort by latest spin time (most recent first)
    const spinLog = Object.values(userDayStats)
      .map(stat => ({
        ...stat,
        tokensWonSummary: Object.entries(stat.tokensWon)
          .map(([symbol, count]) => `${count}x ${symbol}`)
          .join(', ') || 'None'
      }))
      .sort((a, b) => {
        // Sort by latest spin time (most recent first)
        return new Date(b.latestSpinTime) - new Date(a.latestSpinTime);
      });

    // Unique users who have spun
    const uniqueSpinners = new Set(recentSpins?.map(s => s.user_fid) || []);

    // Calculate token claims (claims minus mojo boosts)
    const tokenClaimsToday = (claimsToday || 0) - (donationsToday || 0);
    const tokenClaimsYesterday = (claimsYesterday || 0) - (donationsYesterday || 0);
    const tokenClaimsAllTime = (totalClaimsAllTime || 0) - (totalDonationsAllTime || 0);

    return NextResponse.json({
      success: true,
      stats: {
        // Today stats
        todayDate,
        totalSpinsToday: totalSpinsToday || 0,
        uniqueUsersToday: uniqueUsersToday || 0,
        winsToday: winsToday || 0,
        missesToday: missesToday || 0,
        winRateToday: totalSpinsToday > 0 ? ((winsToday / totalSpinsToday) * 100).toFixed(1) : '0',
        claimsToday: claimsToday || 0,
        tokenClaimsToday,
        mojoBoostsToday: donationsToday || 0,
        // Yesterday stats
        yesterdayDate,
        totalSpinsYesterday: totalSpinsYesterday || 0,
        uniqueUsersYesterday: uniqueUsersYesterday || 0,
        winsYesterday: winsYesterday || 0,
        missesYesterday: missesYesterday || 0,
        winRateYesterday: totalSpinsYesterday > 0 ? ((winsYesterday / totalSpinsYesterday) * 100).toFixed(1) : '0',
        claimsYesterday: claimsYesterday || 0,
        tokenClaimsYesterday,
        mojoBoostsYesterday: donationsYesterday || 0,
        // All time stats
        totalSpinsAllTime: totalSpinsAllTime || 0,
        totalWinsAllTime: totalWinsAllTime || 0,
        totalMissesAllTime: totalMissesAllTime || 0,
        winRateAllTime: totalSpinsAllTime > 0 ? ((totalWinsAllTime / totalSpinsAllTime) * 100).toFixed(1) : '0',
        totalClaimsAllTime: totalClaimsAllTime || 0,
        tokenClaimsAllTime,
        mojoBoostsAllTime: totalDonationsAllTime || 0,
        uniqueSpinnersLast7Days: uniqueSpinners.size
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
