import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentCheckInDay, calculateStreakPST } from '@/lib/timezone.js';

// Helper functions for calculating check-in points (same logic as points.js)
function generateRandomCheckinPoints() {
  const random = Math.random();
  
  // Weighted distribution (lower values more likely)
  if (random < 0.4) {
    // 40% chance: 25-50 points
    return Math.floor(Math.random() * 26) + 25; // 25-50
  } else if (random < 0.75) {
    // 35% chance: 51-75 points
    return Math.floor(Math.random() * 25) + 51; // 51-75
  } else {
    // 25% chance: 76-100 points
    return Math.floor(Math.random() * 25) + 76; // 76-100
  }
}

function applyStreakBonus(basePoints, streak) {
  if (streak >= 30) {
    // 30+ days: 3x multiplier
    return Math.floor(basePoints * 3);
  } else if (streak >= 7) {
    // 7+ days: 2x multiplier
    return Math.floor(basePoints * 2);
  } else if (streak >= 3) {
    // 3+ days: 1.5x multiplier
    return Math.floor(basePoints * 1.5);
  } else {
    // 1-2 days: no bonus
    return basePoints;
  }
}

// Helper function to get PST day start (same logic as spin-permit)
function getPSTDayStart() {
  const now = new Date();
  
  // Use month-based DST detection
  const month = now.getMonth(); // 0-11
  const isDST = month >= 2 && month <= 10; // March (2) through November (10)
  
  // Use correct offset: PDT = UTC-7, PST = UTC-8  
  const pacificOffset = isDST ? 7 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  const pacificNow = new Date(now.getTime() - pacificOffset);
  
  // Get today's date in Pacific timezone
  const year = pacificNow.getUTCFullYear();
  const month_utc = pacificNow.getUTCMonth();
  const date = pacificNow.getUTCDate();
  const hour = pacificNow.getUTCHours();
  
  // Create 8 AM Pacific today
  let dayStart = new Date(Date.UTC(year, month_utc, date, 8, 0, 0, 0));
  
  // If it's before 8 AM Pacific, use yesterday's 8 AM Pacific
  if (hour < 8) {
    dayStart = new Date(Date.UTC(year, month_utc, date - 1, 8, 0, 0, 0));
  }
  
  // Convert to UTC and return as Date object
  const utcDayStart = new Date(dayStart.getTime() + pacificOffset);
  return utcDayStart;
}

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();
    const { fid, reason, adminNote } = await request.json();
    
    if (!fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing fid' 
      }, { status: 400 });
    }

    const dayStart = getPSTDayStart();
    const checkInDay = getCurrentCheckInDay(); // Use proper PST check-in day format
    
    console.log('🔧 Admin daily check-in request:', {
      fid,
      reason,
      adminNote,
      dayStart: dayStart.toISOString(),
      checkInDay
    });

    // Check if user already has a transaction today
    const { data: existingTransaction, error: checkError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', dayStart.toISOString())
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Database error checking existing transaction:', checkError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error' 
      }, { status: 500 });
    }

    if (existingTransaction) {
      return NextResponse.json({ 
        success: false, 
        error: 'User already has a transaction today',
        existingTransaction: {
          id: existingTransaction.id,
          created_at: existingTransaction.created_at,
          points_earned: existingTransaction.points_earned
        }
      }, { status: 400 });
    }

    // Get or create user's leaderboard data
    let { data: userData, error: userError } = await supabase
      .from('user_leaderboard')
      .select('*')
      .eq('user_fid', fid)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user leaderboard data:', userError);
      return NextResponse.json({ 
        success: false, 
        error: 'Could not fetch user data' 
      }, { status: 500 });
    }

    // If user doesn't exist in leaderboard, create them
    if (!userData) {
      console.log('🆕 Creating new leaderboard entry for user:', fid);
      
      // Get username from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('fid', fid)
        .single();

      const { data: newUser, error: createError } = await supabase
        .from('user_leaderboard')
        .insert({
          user_fid: fid,
          username: profile?.username || null,
          total_points: 0,
          points_from_checkins: 0,
          points_from_purchases: 0,
          checkin_streak: 0,
          last_checkin_date: null,
          last_purchase_date: null
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user leaderboard:', createError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to create user leaderboard' 
        }, { status: 500 });
      }

      userData = newUser;
    }

    // Calculate new streak using proper PST logic
    const newStreak = calculateStreakPST(userData.last_checkin_date, userData.checkin_streak);
    
    // Generate random points for check-in (same as normal check-ins)
    const basePoints = generateRandomCheckinPoints();
    
    // Apply streak bonus
    const finalPoints = applyStreakBonus(basePoints, newStreak);

    console.log('🎯 Calculated check-in rewards:', {
      basePoints,
      newStreak,
      finalPoints,
      previousPoints: userData.total_points
    });

    // Update user leaderboard
    const { data: updatedData, error: updateError } = await supabase
      .from('user_leaderboard')
      .update({
        total_points: userData.total_points + finalPoints,
        points_from_checkins: (userData.points_from_checkins || 0) + finalPoints,
        last_checkin_date: checkInDay,
        checkin_streak: newStreak
      })
      .eq('user_fid', fid)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating leaderboard:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update leaderboard' 
      }, { status: 500 });
    }

    // Create the transaction record (looks like a real check-in)
    const transactionData = {
      user_fid: fid,
      transaction_type: 'daily_checkin',
      points_earned: finalPoints,
      points_before: userData.total_points,
      points_after: updatedData.total_points,
      description: `Admin daily check-in (streak: ${newStreak}) - ${reason || 'State mismatch fix'}`,
      reference_id: `checkin-${fid}-${checkInDay}`, // Use same format as real check-ins
      metadata: {
        basePoints: basePoints,
        streakBonus: finalPoints - basePoints,
        streak: newStreak,
        checkInDay: checkInDay,
        onChain: false, // Mark as non-blockchain
        adminReset: true,
        reason: reason || 'State mismatch between contract and database',
        adminNote: adminNote || 'Manual check-in by admin',
        resetTimestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString(),
      spin_reserved_at: new Date().toISOString(),
      spin_confirmed_at: new Date().toISOString(),
      spin_tx_hash: `admin-checkin-${Date.now()}`, // Fake tx hash for admin check-ins
      wallet_address: 'admin-checkin'
    };

    const { data: insertedTransaction, error: insertError } = await supabase
      .from('point_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting transaction:', insertError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create transaction' 
      }, { status: 500 });
    }

    console.log('✅ Admin daily check-in completed:', {
      id: insertedTransaction.id,
      fid,
      pointsEarned: finalPoints,
      newStreak,
      newTotalPoints: updatedData.total_points
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Daily check-in completed successfully',
      transaction: {
        id: insertedTransaction.id,
        reference_id: insertedTransaction.reference_id,
        created_at: insertedTransaction.created_at,
        points_earned: finalPoints,
        streak: newStreak
      },
      user: {
        total_points: updatedData.total_points,
        checkin_streak: newStreak,
        points_from_checkins: updatedData.points_from_checkins
      },
      note: `User received ${finalPoints} points (${basePoints} base + ${finalPoints - basePoints} streak bonus) and their streak is now ${newStreak} days.`
    });

  } catch (error) {
    console.error('Admin daily check-in error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
