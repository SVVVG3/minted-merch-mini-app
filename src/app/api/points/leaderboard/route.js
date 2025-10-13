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
    // Increased limit for accurate leaderboard rankings with token multipliers
    if (limit < 1 || limit > 50000) {
      return Response.json({
        success: false,
        error: 'Limit must be between 1 and 50000'
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
        
        // Check if user is in the displayed leaderboard
        const userInLeaderboard = leaderboard.find(user => user.user_fid === fid);
        
        if (userInLeaderboard) {
          // User is in top results - use their rank from the leaderboard
          const position = userInLeaderboard.rank;
          userPosition = {
            ...userData,
            position: position
          };
          console.log(`✅ User found in top ${limit}: position ${position}`);
        } else {
          // User not in top results - need to calculate position
          // For accurate position with multipliers, we need to fetch more users
          // Fetch a larger leaderboard to find their position
          console.log(`📊 User not in top ${limit}, fetching larger leaderboard to find position...`);
          const fullLeaderboard = await getLeaderboard(10000, category);
          const userInFullLeaderboard = fullLeaderboard.find(user => user.user_fid === fid);
          
          if (userInFullLeaderboard) {
            const position = userInFullLeaderboard.rank;
            userPosition = {
              ...userData,
              position: position
            };
            console.log(`✅ User found in extended leaderboard: position ${position}`);
          } else {
            // User not found even in extended leaderboard - return data without position
            userPosition = {
              ...userData,
              position: null
            };
            console.log(`ℹ️ User not found in top 10,000, position unknown`);
          }
        }
        
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