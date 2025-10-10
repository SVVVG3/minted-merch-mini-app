import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { numWinners, filters } = await request.json();
    
    // Get eligible users based on filters
    // For token balance filtering, we need to query ALL users with tokens, not just leaderboard users
    let query;
    if (filters.minTokenBalance > 0) {
      // Query profiles table to get ALL token holders
      query = supabaseAdmin
        .from('profiles')
        .select(`
          fid as user_fid,
          username,
          token_balance,
          user_leaderboard!fid (
            total_points,
            checkin_streak,
            points_from_purchases,
            total_orders
          )
        `)
        .gt('token_balance', 0) // Only users with tokens
        .order('token_balance', { ascending: false });
    } else {
      // For non-token filters, use leaderboard table with pagination to get ALL users
      query = supabaseAdmin
        .from('user_leaderboard')
        .select(`
          user_fid, 
          username, 
          total_points, 
          checkin_streak, 
          points_from_purchases, 
          total_orders,
          profiles!inner(token_balance)
        `)
        .order('total_points', { ascending: false });
    }

    // Apply filters (only for non-token queries since token queries use profiles table)
    if (filters.minTokenBalance === 0) {
      if (filters.minPoints > 0) {
        query = query.gte('total_points', filters.minPoints);
      }
      
      if (filters.minStreak > 0) {
        query = query.gte('checkin_streak', filters.minStreak);
      }
      
      if (filters.minPurchasePoints > 0) {
        query = query.gte('points_from_purchases', filters.minPurchasePoints);
      }
    }

    // Execute query with pagination to get ALL users (Supabase has 1000 row limit)
    let eligibleUsers = [];
    let currentPage = 0;
    const pageSize = 1000;
    let hasMoreData = true;
    
    console.log(`📊 Fetching all eligible users with pagination...`);
    
    while (hasMoreData) {
      const { data: pageData, error } = await query
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
      
      if (error) {
        console.error('Error fetching eligible users:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch eligible users' });
      }
      
      if (pageData && pageData.length > 0) {
        eligibleUsers = eligibleUsers.concat(pageData);
        console.log(`📄 Fetched page ${currentPage + 1}: ${pageData.length} users (total: ${eligibleUsers.length})`);
        currentPage++;
        hasMoreData = pageData.length === pageSize;
      } else {
        hasMoreData = false;
      }
    }
    
    console.log(`📊 Total eligible users fetched: ${eligibleUsers.length}`);

    let filteredUsers = eligibleUsers || [];

    // Apply token balance filter (client-side since it's from joined table)
    if (filters.minTokenBalance > 0) {
      console.log(`🔍 Filtering by token balance >= ${filters.minTokenBalance}`);
      console.log(`📊 Before token filter: ${filteredUsers.length} users`);
      
      filteredUsers = filteredUsers.filter(user => {
        // Handle different data structures from profiles vs user_leaderboard queries
        const tokenBalance = user.token_balance || user.profiles?.token_balance || 0;
        // Token balance is now stored as actual token values (not wei)
        const tokenAmount = typeof tokenBalance === 'string' ? 
          parseFloat(tokenBalance) : 
          tokenBalance;
        const meetsCriteria = tokenAmount >= filters.minTokenBalance;
        
        if (!meetsCriteria) {
          console.log(`❌ User ${user.user_fid} (${user.username}) has ${tokenAmount} tokens (needs ${filters.minTokenBalance})`);
        }
        
        return meetsCriteria;
      });
      
      console.log(`📊 After token filter: ${filteredUsers.length} users`);
    }

    // Apply other filters (client-side for profiles query or when token balance filter is used)
    if (filters.minTokenBalance > 0 || filters.minPoints > 0 || filters.minStreak > 0 || filters.minPurchasePoints > 0) {
      filteredUsers = filteredUsers.filter(user => {
        // Handle different data structures from profiles vs user_leaderboard queries
        const leaderboardData = user.user_leaderboard?.[0] || user;
        const totalPoints = leaderboardData.total_points || 0;
        const streak = leaderboardData.checkin_streak || 0;
        const purchasePoints = leaderboardData.points_from_purchases || 0;
        
        const meetsPoints = filters.minPoints === 0 || totalPoints >= filters.minPoints;
        const meetsStreak = filters.minStreak === 0 || streak >= filters.minStreak;
        const meetsPurchasePoints = filters.minPurchasePoints === 0 || purchasePoints >= filters.minPurchasePoints;
        
        return meetsPoints && meetsStreak && meetsPurchasePoints;
      });
    }

    // Exclude previous winners if filter is enabled
    console.log(`🚫 Exclude previous winners: ${filters.excludePreviousWinners}`);
    if (filters.excludePreviousWinners) {
      console.log(`📊 Before excluding previous winners: ${filteredUsers.length} users`);
      
      // Get all previous winners
      const { data: previousWinners, error: winnersError } = await supabaseAdmin
        .from('raffle_winner_entries')
        .select('user_fid');

      if (winnersError) {
        console.error('Error fetching previous winners:', winnersError);
        return NextResponse.json({ success: false, error: 'Failed to fetch previous winners' });
      }

      console.log(`🏆 Found ${previousWinners.length} previous winners`);

      // Create a set of previous winner FIDs for fast lookup
      const previousWinnerFids = new Set(previousWinners.map(w => w.user_fid));
      
      // Filter out users who have previously won
      filteredUsers = filteredUsers.filter(user => !previousWinnerFids.has(user.user_fid));
      
      console.log(`📊 After excluding previous winners: ${filteredUsers.length} users`);
    } else {
      console.log(`✅ Not excluding previous winners - keeping all ${filteredUsers.length} users`);
    }

    if (!filteredUsers || filteredUsers.length === 0) {
      const message = filters.excludePreviousWinners 
        ? 'No eligible users found (all eligible users have already won previous raffles)'
        : 'No eligible users found';
      return NextResponse.json({ success: false, error: message });
    }

    // Randomly select winners
    const shuffled = [...filteredUsers].sort(() => 0.5 - Math.random());
    const winners = shuffled.slice(0, Math.min(numWinners, filteredUsers.length));

    // Generate raffle ID and save to database
    const raffleId = generateRandomId();
    const raffleTimestamp = new Date().toISOString();
    
    // Generate criteria description
    const criteriaDescription = generateCriteriaDescription(filters, filteredUsers.length);

    // Save raffle metadata
    const { data: raffleData, error: raffleError } = await supabaseAdmin
      .from('raffle_winners')
      .insert({
        raffle_id: raffleId,
        raffle_timestamp: raffleTimestamp,
        raffle_criteria: criteriaDescription,
        total_eligible_users: filteredUsers.length,
        total_winners: winners.length,
        filters_applied: filters,
        created_by_admin: 'admin_dashboard'
      })
      .select()
      .single();

    if (raffleError) {
      console.error('Error saving raffle metadata:', raffleError);
      return NextResponse.json({ success: false, error: 'Failed to save raffle metadata' });
    }

    // Save winner entries
    const winnerEntries = winners.map((winner, index) => ({
      raffle_id: raffleId,
      user_fid: winner.user_fid,
      username: winner.username,
      total_points: winner.total_points,
      checkin_streak: winner.checkin_streak,
      points_from_purchases: winner.points_from_purchases,
      total_orders: winner.total_orders,
      winner_position: index + 1
    }));

    const { error: entriesError } = await supabaseAdmin
      .from('raffle_winner_entries')
      .insert(winnerEntries);

    if (entriesError) {
      console.error('Error saving winner entries:', entriesError);
      return NextResponse.json({ success: false, error: 'Failed to save winner entries' });
    }

    return NextResponse.json({
      success: true,
      data: {
        winners,
        eligibleCount: filteredUsers.length,
        raffleId,
        timestamp: raffleTimestamp,
        criteriaDescription
      }
    });

  } catch (error) {
    console.error('Raffle API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;

    // Get raffle history with winner counts
    const { data: raffles, error } = await supabaseAdmin
      .from('raffle_winners')
      .select(`
        *,
        raffle_winner_entries!fk_raffle_winner_entries_raffle_id (
          id,
          user_fid,
          username,
          total_points,
          checkin_streak,
          points_from_purchases,
          total_orders,
          winner_position
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching raffle history:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch raffle history' });
    }

    // Transform data for frontend
    const raffleHistory = raffles.map(raffle => ({
      id: raffle.id,
      raffleId: raffle.raffle_id,
      timestamp: raffle.raffle_timestamp,
      criteriaDescription: raffle.raffle_criteria,
      totalEligibleUsers: raffle.total_eligible_users,
      totalWinners: raffle.total_winners,
      filtersApplied: raffle.filters_applied,
      createdByAdmin: raffle.created_by_admin,
      createdAt: raffle.created_at,
      winners: raffle.raffle_winner_entries.map(entry => ({
        user_fid: entry.user_fid,
        username: entry.username,
        total_points: entry.total_points,
        checkin_streak: entry.checkin_streak,
        points_from_purchases: entry.points_from_purchases,
        total_orders: entry.total_orders,
        winner_position: entry.winner_position
      })).sort((a, b) => a.winner_position - b.winner_position)
    }));

    return NextResponse.json({
      success: true,
      data: {
        raffles: raffleHistory,
        count: raffles.length,
        hasMore: raffles.length === limit
      }
    });

  } catch (error) {
    console.error('Get raffle history error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' });
  }
}

function generateCriteriaDescription(filters, eligibleCount, originalCount = null) {
  const criteria = [];
  
  if (filters.minPoints > 0) {
    criteria.push(`${filters.minPoints}+ points`);
  }
  
  if (filters.minStreak > 0) {
    criteria.push(`${filters.minStreak}+ day streak`);
  }
  
  if (filters.minPurchasePoints > 0) {
    criteria.push(`${filters.minPurchasePoints}+ purchase points`);
  }
  
  let description;
  if (criteria.length === 0) {
    description = `Selected from ${eligibleCount} community members`;
  } else {
    description = `Selected from ${eligibleCount} members with ${criteria.join(', ')}`;
  }
  
  // Add exclusion info if previous winners were excluded
  if (filters.excludePreviousWinners && originalCount && originalCount > eligibleCount) {
    const excludedCount = originalCount - eligibleCount;
    description += ` (excluding ${excludedCount} previous winner${excludedCount > 1 ? 's' : ''})`;
  }
  
  return description;
}

// Helper function to generate random ID
function generateRandomId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
} 