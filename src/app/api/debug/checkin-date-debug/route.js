import { NextResponse } from 'next/server';
import { getCurrentCheckInDay } from '../../../../lib/timezone.js';
import { getUsersNeedingCheckInReminders } from '../../../../lib/notifications.js';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const url = new URL(request.url);
    const testFid = url.searchParams.get('testFid') || 466111;

    console.log('🔍 Debugging check-in date logic...');
    
    // Get current check-in day
    const currentCheckInDay = getCurrentCheckInDay();
    console.log('Current check-in day:', currentCheckInDay);
    
    // Get users needing reminders
    const usersNeedingReminders = await getUsersNeedingCheckInReminders();
    console.log('Users needing reminders:', usersNeedingReminders);
    
    // Check if test FID is in the list
    const testFidNeedsReminder = usersNeedingReminders.includes(parseInt(testFid));
    
    // Get user's actual check-in data from database
    const { supabase } = await import('../../../../lib/supabase.js');
    const { data: userData } = await supabase
      .from('user_leaderboard')
      .select('user_fid, last_checkin_date, checkin_streak')
      .eq('user_fid', testFid)
      .single();
    
    return NextResponse.json({
      success: true,
      debug: {
        testFid: parseInt(testFid),
        currentCheckInDay: currentCheckInDay,
        userLastCheckinDate: userData?.last_checkin_date,
        userCheckinStreak: userData?.checkin_streak,
        datesMatch: userData?.last_checkin_date === currentCheckInDay,
        testFidNeedsReminder: testFidNeedsReminder,
        shouldNotNeedReminder: userData?.last_checkin_date === currentCheckInDay,
        bugFound: testFidNeedsReminder && userData?.last_checkin_date === currentCheckInDay
      },
      explanation: {
        bug: testFidNeedsReminder && userData?.last_checkin_date === currentCheckInDay ? 
          'BUG: User already checked in today but is getting evening reminder' : 
          'No bug detected - user correctly filtered',
        logic: 'User should NOT get evening reminder if last_checkin_date === currentCheckInDay'
      }
    });
    
  } catch (error) {
    console.error('❌ Error in check-in date debug:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});