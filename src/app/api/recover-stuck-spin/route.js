// User endpoint to recover from stuck spins
// When user's transaction succeeded on-chain but backend didn't award points
import { performDailyCheckin } from '@/lib/points.js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { userFid, txHash } = await request.json();

    if (!userFid) {
      return NextResponse.json({ 
        success: false, 
        error: 'userFid is required' 
      }, { status: 400 });
    }

    console.log('🔄 User attempting to recover stuck spin - FID:', userFid, 'txHash:', txHash || 'none provided');

    // Use skipBlockchainCheck = true to allow completion even if contract thinks it's done
    const result = await performDailyCheckin(userFid, txHash || null, true);

    if (!result.success) {
      // If it's "already checked in" error, that means points were already awarded
      if (result.alreadyCheckedIn) {
        return NextResponse.json({ 
          success: false, 
          error: 'Spin already completed and points awarded',
          alreadyCheckedIn: true
        }, { status: 409 });
      }

      console.error('❌ Failed to recover stuck spin:', result.error);
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }

    console.log('✅ Successfully recovered stuck spin for FID:', userFid);
    return NextResponse.json({
      success: true,
      message: 'Spin recovered successfully! Points have been awarded.',
      data: {
        pointsEarned: result.pointsEarned,
        basePoints: result.basePoints,
        streakBonus: result.streakBonus,
        newStreak: result.newStreak,
        totalPoints: result.totalPoints
      }
    });

  } catch (error) {
    console.error('Error in recover-stuck-spin:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

