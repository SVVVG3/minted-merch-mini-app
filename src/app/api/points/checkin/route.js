// API endpoint for daily check-ins
import { performDailyCheckin, canCheckInToday, getUserLeaderboardData } from '../../../../lib/points.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userFid } = body;

    // Validate required fields
    if (!userFid) {
      return Response.json({
        success: false,
        error: 'userFid is required'
      }, { status: 400 });
    }

    // Validate userFid is a number
    const fid = parseInt(userFid);
    if (isNaN(fid) || fid <= 0) {
      return Response.json({
        success: false,
        error: 'Invalid userFid'
      }, { status: 400 });
    }

    // Perform check-in
    const result = await performDailyCheckin(fid);

    if (!result.success) {
      const statusCode = result.alreadyCheckedIn ? 409 : 500;
      return Response.json(result, { status: statusCode });
    }

    return Response.json({
      success: true,
      data: {
        pointsEarned: result.pointsEarned,
        basePoints: result.basePoints,
        streakBonus: result.streakBonus,
        newStreak: result.newStreak,
        totalPoints: result.totalPoints,
        streakBroken: result.streakBroken
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in check-in API:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const userFid = url.searchParams.get('userFid');

    if (!userFid) {
      return Response.json({
        success: false,
        error: 'userFid is required'
      }, { status: 400 });
    }

    const fid = parseInt(userFid);
    if (isNaN(fid) || fid <= 0) {
      return Response.json({
        success: false,
        error: 'Invalid userFid'
      }, { status: 400 });
    }

    // Check if user can check in today
    const canCheckin = await canCheckInToday(fid);
    const userData = await getUserLeaderboardData(fid);

    return Response.json({
      success: true,
      data: {
        canCheckInToday: canCheckin,
        totalPoints: userData?.total_points || 0,
        checkinStreak: userData?.checkin_streak || 0,
        lastCheckinDate: userData?.last_checkin_date || null
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in check-in status API:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 