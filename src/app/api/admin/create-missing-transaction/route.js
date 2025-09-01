import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { fid, txHash, dayStart } = await request.json();

    if (!fid || !txHash) {
      return NextResponse.json({ success: false, error: 'Missing fid or txHash' }, { status: 400 });
    }

    console.log('🔧 Creating missing transaction entry for FID:', fid);

    // First, get user's current status
    const { data: userData, error: userError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('*')
      .eq('user_fid', fid)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    console.log('👤 Current user status:', {
      fid: userData.user_fid,
      total_points: userData.total_points,
      current_streak: userData.current_streak,
      last_checkin_date: userData.last_checkin_date
    });

    // Calculate points (base 10 + streak bonus)
    const basePoints = 10;
    const streakBonus = Math.min(userData.current_streak, 10); // Max 10 bonus
    const totalPoints = basePoints + streakBonus;
    const newTotalPoints = userData.total_points + totalPoints;

    // Create the missing transaction entry
    const transactionData = {
      user_fid: fid,
      transaction_type: 'daily_checkin',
      points_earned: totalPoints,
      points_before: userData.total_points,
      points_after: newTotalPoints,
      description: `On-chain daily check-in (streak: ${userData.current_streak + 1}) - MANUAL RECOVERY`,
      reference_id: `manual_recovery_${Date.now()}`,
      spin_tx_hash: txHash,
      spin_confirmed_at: new Date().toISOString(),
      wallet_address: null, // We don't have this info
      spin_nonce: null, // We don't have this info
      metadata: {
        manual_recovery: true,
        original_tx_hash: txHash,
        recovery_timestamp: new Date().toISOString(),
        recovery_reason: 'Missing transaction entry for successful on-chain spin'
      },
      created_at: dayStart ? new Date(dayStart).toISOString() : new Date().toISOString()
    };

    const { data: transactionResult, error: transactionError } = await supabaseAdmin
      .from('point_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return NextResponse.json({ success: false, error: 'Failed to create transaction' }, { status: 500 });
    }

    // Update user's leaderboard entry
    const newStreak = userData.current_streak + 1;
    const today = dayStart ? new Date(dayStart).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('user_leaderboard')
      .update({
        total_points: newTotalPoints,
        current_streak: newStreak,
        last_checkin_date: today,
        updated_at: new Date().toISOString()
      })
      .eq('user_fid', fid)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user leaderboard:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update leaderboard' }, { status: 500 });
    }

    console.log('✅ Successfully created missing transaction and updated leaderboard');

    return NextResponse.json({
      success: true,
      message: 'Missing transaction created successfully',
      transaction: transactionResult,
      updatedUser: updatedUser
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ success: false, error: 'Missing fid parameter' }, { status: 400 });
  }

  try {
    // Get user's current status
    const { data: userData, error: userError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('*')
      .eq('user_fid', fid)
      .single();

    if (userError) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Get recent transactions
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      userData,
      recentTransactions: transactions || []
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
