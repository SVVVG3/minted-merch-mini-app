// API endpoint for daily check-ins
// SECURITY: This endpoint must NEVER allow skipBlockchainCheck from client
import { performDailyCheckin, canCheckInToday, getUserLeaderboardData, getUserLeaderboardPosition, getTodaysCheckInResult } from '../../../../lib/points.js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('🔍 DEBUG: Raw request body received:', JSON.stringify(body));
    
    // SECURITY FIX: Never trust client-provided skipBlockchainCheck
    // 🔒 DEFENSE #2: Extract user data from frontend (real Farcaster data)
    const { userFid, timezone, txHash, userData } = body;
    
    // Log ONLY malicious attempts to bypass security (skipBlockchainCheck: true)
    if (body.skipBlockchainCheck === true) {
      console.warn('🚨 SECURITY ALERT: Client attempted to bypass blockchain checks!', {
        userFid,
        clientValue: body.skipBlockchainCheck,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        timestamp: new Date().toISOString()
      });
      
      // Log to security_events table for investigation
      try {
        const { supabaseAdmin } = await import('@/lib/supabase.js');
        await supabaseAdmin
          .from('security_events')
          .insert({
            event_type: 'bypass_attempt',
            user_fid: userFid || null,
            metadata: {
              endpoint: '/api/points/checkin',
              attemptedBypass: 'skipBlockchainCheck',
              ip: request.headers.get('x-forwarded-for') || 'unknown'
            },
            severity: 'high'
          });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
    }
    // Silently ignore false values (legitimate frontend behavior)
    
    console.log('🔍 DEBUG: Parsed values:', {
      userFid,
      userFidType: typeof userFid,
      userFidValue: JSON.stringify(userFid),
      timezone,
      txHash: txHash ? txHash.substring(0, 10) + '...' : 'none',
      skipBlockchainCheck: 'NEVER (server-enforced)'
    });

    // Validate required parameters
    if (!userFid) {
      console.error('❌ DEBUG: userFid validation failed!', {
        userFid,
        isFalsy: !userFid,
        isNull: userFid === null,
        isUndefined: userFid === undefined,
        isEmpty: userFid === '',
        isZero: userFid === 0
      });
      return NextResponse.json({ 
        success: false, 
        error: 'User FID is required',
        debug: {
          receivedUserFid: userFid,
          type: typeof userFid
        }
      }, { status: 400 });
    }

    // SECURITY FIX: Transaction hash is now REQUIRED for check-ins
    if (!txHash) {
      console.error('❌ SECURITY: Check-in attempt without transaction hash!', {
        userFid,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Transaction hash is required for check-ins'
      }, { status: 400 });
    }

    console.log(`🎯 Daily check-in attempt for FID: ${userFid}, timezone: ${timezone || 'not provided'}, txHash: ${txHash.substring(0, 10)}...`);

    // SECURITY: ALWAYS enforce blockchain checks (skipBlockchainCheck = false)
    // Only admin endpoints and recover-stuck-spin (with its own security) can skip
    // 🔒 DEFENSE #2: Pass userData from frontend for fallback profile creation
    const result = await performDailyCheckin(userFid, txHash, false, userData);

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
      console.log(`🔍 User ${fid} already checked in, fetching today's result...`);
      todaysResult = await getTodaysCheckInResult(fid);
      console.log(`🔍 Today's result for user ${fid}:`, todaysResult);
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