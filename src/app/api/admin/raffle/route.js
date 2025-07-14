import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { numWinners, filters } = await request.json();
    
    // Get eligible users based on filters
    let query = supabaseAdmin
      .from('user_leaderboard')
      .select('user_fid, username, total_points, checkin_streak, points_from_purchases, total_orders')
      .order('total_points', { ascending: false });

    // Apply filters
    if (filters.minPoints > 0) {
      query = query.gte('total_points', filters.minPoints);
    }
    
    if (filters.minStreak > 0) {
      query = query.gte('checkin_streak', filters.minStreak);
    }
    
    if (filters.minPurchasePoints > 0) {
      query = query.gte('points_from_purchases', filters.minPurchasePoints);
    }

    const { data: eligibleUsers, error } = await query;

    if (error) {
      console.error('Error fetching eligible users:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch eligible users' });
    }

    if (!eligibleUsers || eligibleUsers.length === 0) {
      return NextResponse.json({ success: false, error: 'No eligible users found' });
    }

    // Randomly select winners
    const shuffled = [...eligibleUsers].sort(() => 0.5 - Math.random());
    const winners = shuffled.slice(0, Math.min(numWinners, eligibleUsers.length));

    // Generate raffle ID and save to database
    const raffleId = generateRandomId();
    const raffleTimestamp = new Date().toISOString();
    
    // Generate criteria description
    const criteriaDescription = generateCriteriaDescription(filters, eligibleUsers.length);

    // Save raffle metadata
    const { data: raffleData, error: raffleError } = await supabaseAdmin
      .from('raffle_winners')
      .insert({
        raffle_id: raffleId,
        raffle_timestamp: raffleTimestamp,
        raffle_criteria: criteriaDescription,
        total_eligible_users: eligibleUsers.length,
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
        eligibleCount: eligibleUsers.length,
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

function generateCriteriaDescription(filters, eligibleCount) {
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
  
  if (criteria.length === 0) {
    return `Selected from ${eligibleCount} community members`;
  }
  
  return `Selected from ${eligibleCount} members with ${criteria.join(', ')}`;
}

// Helper function to generate random ID
function generateRandomId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
} 