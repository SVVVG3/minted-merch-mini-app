import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { numWinners = 1, filters = {} } = await request.json();
    
    console.log('🎲 Running raffle with filters:', filters, 'numWinners:', numWinners);

    // Build query based on filters
    let query = supabaseAdmin
      .from('user_leaderboard')
      .select('*');

    // Apply minimum points filter
    if (filters.minPoints && filters.minPoints > 0) {
      query = query.gte('total_points', filters.minPoints);
    }

    // Apply minimum streak filter
    if (filters.minStreak && filters.minStreak > 0) {
      query = query.gte('checkin_streak', filters.minStreak);
    }

    // Apply minimum purchase points filter
    if (filters.minPurchasePoints && filters.minPurchasePoints > 0) {
      query = query.gte('points_from_purchases', filters.minPurchasePoints);
    }

    // TODO: Add previous winners exclusion logic when we add a winners table
    // For now, we'll just note this in the response

    const { data: eligibleUsers, error } = await query;

    if (error) {
      console.error('Error fetching eligible users:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch eligible users' },
        { status: 500 }
      );
    }

    if (!eligibleUsers || eligibleUsers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No eligible users found with current filters' },
        { status: 400 }
      );
    }

    // Select random winners
    const shuffled = [...eligibleUsers].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, Math.min(numWinners, eligibleUsers.length));

    console.log(`🎉 Selected ${winners.length} winners from ${eligibleUsers.length} eligible users`);

    // Log the raffle event
    const raffleLog = {
      timestamp: new Date().toISOString(),
      totalEligible: eligibleUsers.length,
      winnersSelected: winners.length,
      filters: filters,
      winners: winners.map(w => ({ fid: w.user_fid, username: w.username }))
    };

    console.log('📝 Raffle log:', raffleLog);

    return NextResponse.json({
      success: true,
      data: {
        winners: winners,
        eligibleCount: eligibleUsers.length,
        appliedFilters: filters,
        raffleId: Date.now(), // Simple ID for this raffle
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in admin raffle API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 