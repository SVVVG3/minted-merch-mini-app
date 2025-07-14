import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Generate human-readable criteria description
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

    // Exclude previous winners if requested
    let excludedWinnersFids = [];
    if (filters.excludePreviousWinners) {
      try {
        const { data: previousWinners, error: winnersError } = await supabaseAdmin
          .from('raffle_winner_entries')
          .select('user_fid')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days
        
        if (!winnersError && previousWinners) {
          excludedWinnersFids = previousWinners.map(w => w.user_fid);
          console.log(`🚫 Excluding ${excludedWinnersFids.length} previous winners from last 30 days`);
        }
      } catch (error) {
        console.error('Error fetching previous winners:', error);
        // Continue without exclusion if there's an error
      }
    }

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

    // Apply previous winners exclusion
    let finalEligibleUsers = eligibleUsers;
    if (excludedWinnersFids.length > 0) {
      finalEligibleUsers = eligibleUsers.filter(user => !excludedWinnersFids.includes(user.user_fid));
      console.log(`📊 Filtered from ${eligibleUsers.length} to ${finalEligibleUsers.length} users after excluding previous winners`);
      
      if (finalEligibleUsers.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No eligible users found after excluding previous winners' },
          { status: 400 }
        );
      }
    }

    // Select random winners
    const shuffled = [...finalEligibleUsers].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, Math.min(numWinners, finalEligibleUsers.length));

    console.log(`🎉 Selected ${winners.length} winners from ${finalEligibleUsers.length} eligible users`);

    // Generate unique raffle ID
    const raffleId = `raffle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Generate criteria description
    const criteriaDescription = generateCriteriaDescription(filters, finalEligibleUsers.length);

    try {
      // Save raffle metadata to database
      const { error: raffleError } = await supabaseAdmin
        .from('raffle_winners')
        .insert({
          raffle_id: raffleId,
          raffle_timestamp: timestamp,
          raffle_criteria: criteriaDescription,
          total_eligible_users: finalEligibleUsers.length,
          total_winners: winners.length,
          filters_applied: filters,
          created_by_admin: 'admin_dashboard'
        });

      if (raffleError) {
        console.error('Error saving raffle metadata:', raffleError);
        // Continue even if raffle metadata save fails
      }

      // Save individual winner entries
      if (winners.length > 0) {
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
          // Continue even if winner entries save fails
        }
      }

    } catch (dbError) {
      console.error('Database error during raffle save:', dbError);
      // Continue to return results even if database save fails
    }

    // Log the raffle event
    const raffleLog = {
      raffleId: raffleId,
      timestamp: timestamp,
      totalEligible: finalEligibleUsers.length,
      winnersSelected: winners.length,
      filters: filters,
      criteriaDescription: criteriaDescription,
      winners: winners.map(w => ({ fid: w.user_fid, username: w.username }))
    };

    console.log('📝 Raffle log:', raffleLog);

    return NextResponse.json({
      success: true,
      data: {
        winners: winners,
        eligibleCount: finalEligibleUsers.length,
        appliedFilters: filters,
        raffleId: raffleId,
        timestamp: timestamp
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