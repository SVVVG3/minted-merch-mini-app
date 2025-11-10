// SECURED User endpoint to recover from stuck spins
// CRITICAL: This endpoint now requires authentication and blockchain verification
// Only allows recovery if transaction exists on-chain but points weren't awarded
import { performDailyCheckin } from '@/lib/points.js';
import { verifySpinTransaction, isTransactionHashUsed } from '@/lib/spinContract.js';
import { verifyFarcasterUser } from '@/lib/auth.js';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase.js';

export async function POST(request) {
  try {
    // SECURITY FIX #1: Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Unauthorized recover-stuck-spin attempt - no auth token');
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authResult = await verifyFarcasterUser(token);
    
    if (!authResult.authenticated) {
      console.log('❌ Unauthorized recover-stuck-spin attempt - invalid token');
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid authentication token' 
      }, { status: 401 });
    }

    const authenticatedFid = authResult.fid;

    // Parse request body
    const { userFid, txHash } = await request.json();

    // SECURITY FIX #2: Verify user is recovering their OWN spin
    if (!userFid || userFid !== authenticatedFid) {
      console.log('❌ FID mismatch in recover-stuck-spin:', { 
        requestedFid: userFid, 
        authenticatedFid 
      });
      return NextResponse.json({ 
        success: false, 
        error: 'You can only recover your own spins' 
      }, { status: 403 });
    }

    // SECURITY FIX #3: Transaction hash is now REQUIRED
    if (!txHash) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transaction hash is required to recover a stuck spin' 
      }, { status: 400 });
    }

    console.log('🔄 User attempting to recover stuck spin - FID:', userFid, 'txHash:', txHash.substring(0, 10) + '...');

    // SECURITY FIX #4: Rate limiting - check if user already tried recently
    const { data: recentAttempts } = await supabaseAdmin
      .from('point_transactions')
      .select('created_at')
      .eq('user_fid', userFid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .order('created_at', { ascending: false });

    if (recentAttempts && recentAttempts.length >= 5) {
      console.log('❌ Rate limit exceeded for recover-stuck-spin:', userFid);
      return NextResponse.json({ 
        success: false, 
        error: 'Too many recovery attempts. Please wait before trying again.' 
      }, { status: 429 });
    }

    // SECURITY FIX #5: Check if this transaction hash was already used
    const alreadyUsed = await isTransactionHashUsed(txHash);
    if (alreadyUsed) {
      console.log('✅ Transaction already processed:', txHash.substring(0, 10) + '...');
      return NextResponse.json({ 
        success: false, 
        error: 'This transaction has already been processed',
        alreadyProcessed: true
      }, { status: 409 });
    }

    // SECURITY FIX #6: Verify transaction on blockchain
    console.log('🔍 Verifying transaction on blockchain...');
    const verificationResult = await verifySpinTransaction(txHash);

    if (!verificationResult.success) {
      console.error('❌ Blockchain verification failed:', verificationResult.error);
      
      // Log suspicious activity
      await supabaseAdmin
        .from('security_events')
        .insert({
          event_type: 'failed_spin_recovery',
          user_fid: userFid,
          metadata: {
            txHash,
            error: verificationResult.error,
            ip: request.headers.get('x-forwarded-for') || 'unknown'
          },
          severity: 'medium'
        });

      return NextResponse.json({ 
        success: false, 
        error: 'Transaction verification failed: ' + verificationResult.error,
        verified: false
      }, { status: 400 });
    }

    console.log('✅ Transaction verified on blockchain');

    // Now award points (skip blockchain check since we just verified it manually)
    const result = await performDailyCheckin(userFid, txHash, true);

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

    // Log successful recovery
    await supabaseAdmin
      .from('security_events')
      .insert({
        event_type: 'successful_spin_recovery',
        user_fid: userFid,
        metadata: {
          txHash,
          pointsEarned: result.pointsEarned
        },
        severity: 'low'
      });

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

