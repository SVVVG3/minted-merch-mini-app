import { NextResponse } from 'next/server';
import { getUsersNeedingCheckInReminders } from '../../../../lib/notifications.js';
import { formatPSTTime, getCurrentCheckInDay, isEveningNotificationTime } from '../../../../lib/timezone.js';
import { supabase } from '../../../../lib/supabase.js';
import { setSystemContext } from '../../../../lib/auth.js';

export async function GET(request) {
  try {
    console.log('🔍 Checking how many users would receive evening notifications...');
    
    // Get current status
    const currentTime = formatPSTTime();
    const currentCheckInDay = getCurrentCheckInDay();
    const isEveningTime = isEveningNotificationTime();
    
    // Get users who would receive notifications
    const userFids = await getUsersNeedingCheckInReminders();
    
    // Get sample user data for analysis
    let sampleUsers = [];
    if (userFids.length > 0) {
      // Get first 5 users for analysis
      const sampleFids = userFids.slice(0, 5);
      
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('user_leaderboard')
        .select('user_fid, last_checkin_date, checkin_streak, total_points')
        .in('user_fid', sampleFids);
      
      if (!leaderboardError && leaderboardData) {
        sampleUsers = leaderboardData.map(user => ({
          fid: user.user_fid,
          lastCheckinDate: user.last_checkin_date,
          streak: user.checkin_streak || 0,
          totalPoints: user.total_points || 0,
          needsReminder: user.last_checkin_date !== currentCheckInDay
        }));
      }
    }
    
    // Get total enabled users for comparison
    // Set system admin context to read all profiles
    await setSystemContext();
    
    const { data: totalUsers, error: totalError } = await supabase
      .from('profiles')
      .select('fid', { count: 'exact' })
      .eq('has_notifications', true);
    
    const totalEnabledUsers = totalUsers ? totalUsers.length : 0;
    
    return NextResponse.json({
      success: true,
      message: 'Evening notification count analysis',
      currentStatus: {
        currentTime: currentTime,
        currentCheckInDay: currentCheckInDay,
        isEveningNotificationTime: isEveningTime,
        serverHour: new Date().getHours(),
        serverMinute: new Date().getMinutes()
      },
      notificationStats: {
        totalUsersWithNotifications: totalEnabledUsers,
        usersNeedingReminders: userFids.length,
        usersAlreadyCheckedIn: totalEnabledUsers - userFids.length,
        percentageNeedingReminders: totalEnabledUsers > 0 ? ((userFids.length / totalEnabledUsers) * 100).toFixed(1) : 0
      },
      sampleUsers: sampleUsers,
      logic: {
        explanation: 'Users need evening reminders if they have notifications enabled AND have NOT checked in today',
        filterCriteria: [
          'has_notifications = true',
          `last_checkin_date != '${currentCheckInDay}'`
        ]
      },
      wouldSendNotifications: isEveningTime,
      warning: 'This endpoint does NOT send notifications - it only shows counts'
    });
    
  } catch (error) {
    console.error('❌ Error in evening notification count endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 