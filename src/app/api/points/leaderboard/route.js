// API endpoint for leaderboard data
import { getLeaderboard, getUserLeaderboardPosition } from '../../../../lib/points.js';
import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { setUserContext } from '@/lib/auth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('userFid');
    const limit = parseInt(searchParams.get('limit')) || 10;
    const category = searchParams.get('category') || 'points';

    console.log('Getting leaderboard for userFid:', userFid, 'limit:', limit);

    // 🔒 SECURITY: Set user context for RLS policies
    if (userFid) {
      await setUserContext(userFid);
    }

    // Validate limit
    if (limit < 1 || limit > 2000) {
      return Response.json({
        success: false,
        error: 'Limit must be between 1 and 2000'
      }, { status: 400 });
    }

    // Validate category
    const validCategories = ['points', 'streaks', 'purchases', 'spending'];
    if (!validCategories.includes(category)) {
      return Response.json({
        success: false,
        error: 'Invalid category. Must be: points, streaks, purchases, or spending'
      }, { status: 400 });
    }

    // Get leaderboard data
    const leaderboard = await getLeaderboard(limit, category);

    // Get user position if userFid provided
    let userPosition = null;
    if (userFid) {
      const fid = parseInt(userFid);
      if (!isNaN(fid) && fid > 0) {
        console.log(`🚨 API CALL: Getting user data and position for FID ${fid} in category ${category}`);
        
        // Get user's data (fast - just their row)
        const userData = await getUserLeaderboardPosition(fid, category);
        
        // Calculate their actual position by counting how many users have higher values
        // This is MUCH faster than fetching all users
        let position = null;
        
        try {
          const userValue = category === 'points' 
            ? userData.totalPoints || 0
            : category === 'streaks'
            ? userData.checkin_streak || 0
            : category === 'purchases'
            ? userData.pointsFromPurchases || 0
            : category === 'spending'
            ? userData.totalSpent || 0
            : 0;
          
          // Count how many users have a higher value
          let countQuery = supabaseAdmin
            .from('user_leaderboard')
            .select('user_fid', { count: 'exact', head: true });
          
          // Add the appropriate filter based on category
          if (category === 'points') {
            countQuery = countQuery.gt('total_points', userValue);
          } else if (category === 'streaks') {
            countQuery = countQuery.gt('checkin_streak', userValue);
          } else if (category === 'purchases') {
            countQuery = countQuery
              .gt('total_orders', 0)
              .gt('points_from_purchases', userValue);
          } else if (category === 'spending') {
            countQuery = countQuery.gt('total_spent', userValue);
          }
          
          const { count, error } = await countQuery;
          
          if (!error && count !== null) {
            position = count + 1; // Their position is count of users above them + 1
            console.log(`✅ User position calculated: ${position} (${count} users ranked higher)`);
          } else {
            console.error('Error counting users:', error);
          }
        } catch (error) {
          console.error('Error calculating position:', error);
        }
        
        userPosition = {
          ...userData,
          position: position
        };
        
        console.log(`🚨 API RESULT: User position result:`, userPosition);
      }
    }

    return Response.json({
      success: true,
      data: {
        leaderboard: leaderboard,
        userPosition: userPosition,
        category: category,
        limit: limit
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in leaderboard API:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 