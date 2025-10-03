// API endpoint for daily check-ins
import { performDailyCheckin, canCheckInToday, getUserLeaderboardData, getUserLeaderboardPosition, getTodaysCheckInResult } from '../../../../lib/points.js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { userFid, timezone, txHash, skipBlockchainCheck } = await request.json();

    // Validate required parameters
    if (!userFid) {
      return NextResponse.json({ 
        success: false, 
        error: 'User FID is required' 
      }, { status: 400 });
    }

    console.log(`🎯 Daily check-in attempt for FID: ${userFid}, timezone: ${timezone || 'not provided'}, txHash: ${txHash || 'none'}`);

    // Perform daily check-in (with optional blockchain transaction hash)
    const result = await performDailyCheckin(userFid, txHash, skipBlockchainCheck);

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
    
    // Get user's leaderboard position with multipliers applied
    const userPosition = await getUserLeaderboardPosition(fid);
    
    // Get today's check-in result if user already checked in
    let todaysResult = null;
    if (!canCheckin) {
      todaysResult = await getTodaysCheckInResult(fid);
    }

    return Response.json({
      success: true,
      data: {
        canCheckInToday: canCheckin,
        totalPoints: userPosition.totalPoints || 0, // Now using multiplied points
        basePoints: userPosition.basePoints || 0, // Also include base points
        tokenMultiplier: userPosition.tokenMultiplier || 1,
        tokenTier: userPosition.tokenTier || 'none',
        checkinStreak: userPosition.streak || 0,
        lastCheckinDate: userPosition.lastCheckin || null,
        todaysResult: todaysResult
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