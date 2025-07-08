// API endpoint for leaderboard data
import { getLeaderboard, getUserLeaderboardPosition } from '../../../../lib/points.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    const timeframe = url.searchParams.get('timeframe') || 'all';
    const userFid = url.searchParams.get('userFid');

    // Validate limit
    if (limit < 1 || limit > 100) {
      return Response.json({
        success: false,
        error: 'Limit must be between 1 and 100'
      }, { status: 400 });
    }

    // Validate timeframe
    const validTimeframes = ['all', 'monthly', 'weekly'];
    if (!validTimeframes.includes(timeframe)) {
      return Response.json({
        success: false,
        error: 'Invalid timeframe. Must be: all, monthly, or weekly'
      }, { status: 400 });
    }

    // Get leaderboard data
    const leaderboard = await getLeaderboard(limit, timeframe);

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
        timeframe: timeframe,
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