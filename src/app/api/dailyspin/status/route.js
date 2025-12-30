import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { getCurrent8AMPST } from '@/lib/timezone';

/**
 * Get daily spin allocation based on Mojo score
 * - Mojo >= 0.50: 3 spins
 * - Mojo 0.30-0.49: 2 spins
 * - Mojo < 0.30: 1 spin
 */
function getSpinAllocation(mojoScore) {
  const score = parseFloat(mojoScore) || 0;
  
  if (score >= 0.50) return 3;
  if (score >= 0.30) return 2;
  return 1;
}

/**
 * GET /api/dailyspin/status
 * 
 * Returns user's daily spin status:
 * - Spins used today
 * - Spins remaining (based on Mojo score)
 * - Unclaimed winnings
 * - Mojo score and tier
 * 
 * Requires authentication.
 */
export async function GET(request) {
  try {
    // Authenticate user
    const fid = await getAuthenticatedFid(request);
    if (!fid) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`🎰 Fetching daily spin status for FID ${fid}`);

    // Get today's date (8 AM PST boundary)
    const todayStart = getCurrent8AMPST();
    const todayDate = todayStart.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Fetch user's Mojo score and Neynar score from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mojo_score, neynar_score')
      .eq('fid', fid)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile:', profileError);
    }

    const mojoScore = profile?.mojo_score || 0;
    const neynarScore = profile?.neynar_score || 0;
    const dailyAllocation = getSpinAllocation(mojoScore);

    // Count spins used today (need this first for backfill logic)
    const { count: spinsUsedToday, error: countError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('user_fid', fid)
      .eq('spin_date', todayDate);

    if (countError) {
      console.error('Error counting spins:', countError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch spin count' },
        { status: 500 }
      );
    }

    const usedSpins = spinsUsedToday || 0;
    const remainingSpins = Math.max(0, dailyAllocation - usedSpins);

    // Fetch user's streak from user_leaderboard (continues from old check-in system)
    const { data: leaderboardEntry, error: streakError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('checkin_streak, last_checkin_date, total_points')
      .eq('user_fid', fid)
      .single();

    if (streakError && streakError.code !== 'PGRST116') {
      console.error('Error fetching streak:', streakError);
    }

    let currentStreak = leaderboardEntry?.checkin_streak || 0;
    let lastCheckinDate = leaderboardEntry?.last_checkin_date;

    // Backfill: If user spun today but streak hasn't been updated yet, update it now
    // This handles users who spun before streak tracking was added
    if (usedSpins > 0 && lastCheckinDate !== todayDate) {
      console.log(`🔄 Backfilling streak for FID ${fid} (spun today but streak not recorded)`);
      
      // Calculate yesterday's date
      const today = new Date(todayDate + 'T00:00:00Z');
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      let newStreak;
      if (lastCheckinDate === yesterdayDate) {
        // Continue streak from yesterday
        newStreak = currentStreak + 1;
      } else {
        // Streak broken, start fresh
        newStreak = 1;
      }

      // Update the leaderboard
      const { error: upsertError } = await supabaseAdmin
        .from('user_leaderboard')
        .upsert({
          user_fid: fid,
          checkin_streak: newStreak,
          last_checkin_date: todayDate,
          total_points: leaderboardEntry?.total_points || 0
        }, {
          onConflict: 'user_fid'
        });

      if (!upsertError) {
        currentStreak = newStreak;
        lastCheckinDate = todayDate;
        console.log(`✅ Backfilled streak for FID ${fid}: now ${newStreak}`);
      } else {
        console.error('Error backfilling streak:', upsertError);
      }
    }

    // Fetch unclaimed winnings with token details (exclude MISS entries)
    const { data: unclaimedWinnings, error: winningsError } = await supabaseAdmin
      .from('spin_winnings')
      .select(`
        id,
        amount,
        usd_value,
        token_price,
        spin_date,
        created_at,
        spin_tokens (
          id,
          symbol,
          name,
          contract_address,
          decimals,
          segment_color
        )
      `)
      .eq('user_fid', fid)
      .eq('claimed', false)
      .gt('amount', '0')  // Exclude MISS entries (amount = 0)
      .order('created_at', { ascending: false });

    if (winningsError) {
      console.error('Error fetching unclaimed winnings:', winningsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch winnings' },
        { status: 500 }
      );
    }

    // Group winnings by token for claim summary
    const winningsByToken = {};
    for (const winning of unclaimedWinnings || []) {
      const tokenId = winning.spin_tokens.id;
      if (!winningsByToken[tokenId]) {
        winningsByToken[tokenId] = {
          token: winning.spin_tokens,
          totalAmount: BigInt(0),
          totalUsdValue: 0,
          count: 0,
          winningIds: []
        };
      }
      winningsByToken[tokenId].totalAmount += BigInt(winning.amount);
      winningsByToken[tokenId].totalUsdValue += parseFloat(winning.usd_value) || 0;
      winningsByToken[tokenId].count += 1;
      winningsByToken[tokenId].winningIds.push(winning.id);
    }

    // Convert to array and format for response
    const claimSummary = Object.values(winningsByToken).map(group => ({
      tokenId: group.token.id,
      symbol: group.token.symbol,
      name: group.token.name,
      contractAddress: group.token.contract_address,
      decimals: group.token.decimals,
      color: group.token.segment_color,
      totalAmount: group.totalAmount.toString(),
      totalUsdValue: group.totalUsdValue.toFixed(4),
      spinCount: group.count,
      winningIds: group.winningIds
    }));

    // Fetch TODAY's claimed winnings (for display and sharing after claiming)
    const { data: claimedToday, error: claimedError } = await supabaseAdmin
      .from('spin_winnings')
      .select(`
        id,
        amount,
        usd_value,
        spin_tokens (
          id,
          symbol,
          name,
          decimals,
          segment_color
        )
      `)
      .eq('user_fid', fid)
      .eq('spin_date', todayDate)
      .eq('claimed', true)
      .gt('amount', '0');  // Exclude MISS entries

    if (claimedError) {
      console.error('Error fetching claimed winnings:', claimedError);
    }

    // Format claimed winnings for display
    const claimedWinningsList = (claimedToday || []).map(w => ({
      symbol: w.spin_tokens.symbol,
      displayAmount: (parseFloat(w.amount) / Math.pow(10, w.spin_tokens.decimals)).toFixed(4),
      color: w.spin_tokens.segment_color
    }));

    // Get mojo tier for display
    let mojoTier = 'Bronze';
    if (mojoScore >= 0.50) mojoTier = 'Gold';
    else if (mojoScore >= 0.30) mojoTier = 'Silver';

    console.log(`✅ Daily spin status for FID ${fid}:`, {
      mojoScore,
      mojoTier,
      dailyAllocation,
      usedSpins,
      remainingSpins,
      unclaimedCount: unclaimedWinnings?.length || 0,
      uniqueTokens: claimSummary.length
    });

    return NextResponse.json({
      success: true,
      status: {
        fid,
        mojoScore: parseFloat(mojoScore).toFixed(2),
        mojoTier,
        neynarScore: parseFloat(neynarScore).toFixed(2),
        canClaim: mojoScore >= 0.2, // Require 0.2+ Mojo score to claim
        dailyAllocation,
        spinsUsedToday: usedSpins,
        spinsRemaining: remainingSpins,
        canSpin: remainingSpins > 0,
        todayDate,
        // Streak data (continues from old check-in system)
        streak: currentStreak,
        lastSpinDate: lastCheckinDate
      },
      unclaimed: {
        total: unclaimedWinnings?.length || 0,
        byToken: claimSummary,
        hasUnclaimed: claimSummary.length > 0
      },
      claimedToday: claimedWinningsList
    });

  } catch (error) {
    console.error('Error in /api/dailyspin/status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

