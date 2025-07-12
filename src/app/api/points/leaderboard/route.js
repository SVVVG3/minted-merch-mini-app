// API endpoint for leaderboard data
import { getLeaderboard, getUserLeaderboardPosition } from '../../../../lib/points.js';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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
    if (limit < 1 || limit > 100) {
      return Response.json({
        success: false,
        error: 'Limit must be between 1 and 100'
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
        userPosition = await getUserLeaderboardPosition(fid);
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