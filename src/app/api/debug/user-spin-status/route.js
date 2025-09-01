import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to get PST day start (8 AM PST/PDT)
function getPSTDayStart() {
  const now = new Date();
  
  // Use month-based DST detection (same as dashboard)
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
  
  // Convert to UTC and return as Unix timestamp
  const utcDayStart = new Date(dayStart.getTime() + pacificOffset);
  
  return Math.floor(utcDayStart.getTime() / 1000);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing fid parameter' 
      }, { status: 400 });
    }

    // Get today's PST day start (8 AM PST boundary)
    const dayStart = getPSTDayStart();
    const dayStartDate = new Date(dayStart * 1000);
    
    console.log('🔍 Debug user spin status for FID:', fid);
    console.log('📅 Current day start:', {
      timestamp: dayStart,
      date: dayStartDate.toISOString(),
      pacificTime: dayStartDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    });

    // Get all transactions for this user today
    const { data: todaysTransactions, error: todayError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', dayStartDate.toISOString())
      .order('created_at', { ascending: false });

    if (todayError) {
      console.error('Error fetching today\'s transactions:', todayError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error' 
      }, { status: 500 });
    }

    // Get recent transactions (last 3 days)
    const threeDaysAgo = new Date(dayStart * 1000 - 3 * 24 * 60 * 60 * 1000);
    const { data: recentTransactions, error: recentError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', threeDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Error fetching recent transactions:', recentError);
    }

    // Check user's current status
    const { data: userStatus, error: statusError } = await supabase
      .from('user_leaderboard')
      .select('*')
      .eq('user_fid', fid)
      .single();

    if (statusError && statusError.code !== 'PGRST116') {
      console.error('Error fetching user status:', statusError);
    }

    const response = {
      success: true,
      debug: {
        fid: parseInt(fid),
        currentTime: new Date().toISOString(),
        dayStart: {
          timestamp: dayStart,
          date: dayStartDate.toISOString(),
          pacificTime: dayStartDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
        },
        todaysTransactions: todaysTransactions || [],
        recentTransactions: recentTransactions || [],
        userStatus: userStatus || null,
        analysis: {
          hasSpunToday: todaysTransactions && todaysTransactions.length > 0,
          completedSpinsToday: todaysTransactions ? todaysTransactions.filter(t => t.spin_confirmed_at && t.spin_tx_hash).length : 0,
          pendingSpinsToday: todaysTransactions ? todaysTransactions.filter(t => t.spin_reserved_at && !t.spin_confirmed_at).length : 0,
          canSpin: !todaysTransactions || todaysTransactions.length === 0 || 
                   !todaysTransactions.some(t => t.spin_confirmed_at && t.spin_tx_hash)
        }
      }
    };

    console.log('📊 Debug response:', response);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Debug API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
