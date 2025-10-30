// EMERGENCY ADMIN ENDPOINT - Force complete a stuck spin
// Use this when a user's transaction succeeded on-chain but backend didn't record points
import { verifyAdminToken } from '@/lib/adminAuth';
import { performDailyCheckin } from '@/lib/points.js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  // Verify admin authentication
  const authResult = await verifyAdminToken(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ 
      success: false, 
      error: 'Unauthorized' 
    }, { status: 401 });
  }

  try {
    const { userFid, txHash } = await request.json();

    if (!userFid) {
      return NextResponse.json({ 
        success: false, 
        error: 'userFid is required' 
      }, { status: 400 });
    }

    console.log('🚨 ADMIN: Force completing stuck spin for FID:', userFid, 'txHash:', txHash || 'none provided');

    // Force the check-in with skipBlockchainCheck = true
    // This will complete the spin even if contract thinks it's already done
    const result = await performDailyCheckin(userFid, txHash || null, true);

    if (!result.success) {
      console.error('❌ Failed to force complete spin:', result.error);
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }

    console.log('✅ ADMIN: Successfully force completed spin for FID:', userFid);
    return NextResponse.json({
      success: true,
      message: 'Spin force completed successfully',
      data: {
        pointsEarned: result.pointsEarned,
        totalPoints: result.totalPoints,
        newStreak: result.newStreak
      }
    });

  } catch (error) {
    console.error('Error in force-complete-spin:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

