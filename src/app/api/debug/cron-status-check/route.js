import { NextResponse } from 'next/server';
import { formatPSTTime, isNotificationTime } from '../../../../lib/timezone.js';
import { getUsersNeedingCheckInReminders } from '../../../../lib/notifications.js';
import { supabase } from '../../../../lib/supabase.js';

export async function GET(request) {
  try {
    console.log('🔍 Checking cron job status...');
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    
    const currentTime = formatPSTTime();
    const currentHour = new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"});
    
    // Check notification-status sync stats
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('fid', { count: 'exact', head: true });

    const { count: enabledUsers } = await supabase
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .eq('has_notifications', true);

    // Check when notification status was last updated
    const { data: recentSync, error } = await supabase
      .from('profiles')
      .select('notification_status_updated_at')
      .not('notification_status_updated_at', 'is', null)
      .order('notification_status_updated_at', { ascending: false })
      .limit(1);

    const lastSyncTime = recentSync?.[0]?.notification_status_updated_at;
    
    // Check users needing check-in reminders
    const usersNeedingReminders = await getUsersNeedingCheckInReminders();
    
    if (action === 'test-notification-sync') {
      console.log('🧪 Testing notification status sync...');
      
      const testResponse = await fetch(`${new URL(request.url).origin}/api/auto-sync/notification-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchSize: 10,
          maxUsers: 20,
          dryRun: true
        })
      });
      
      const testResult = await testResponse.json();
      
      return NextResponse.json({
        success: true,
        currentTime,
        test: 'notification-sync',
        result: testResult
      });
    }
    
    if (action === 'test-daily-checkin') {
      console.log('🧪 Testing daily check-in...');
      
      const testResponse = await fetch(`${new URL(request.url).origin}/api/notifications/daily-checkin`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Force-Run': 'true' // Force run regardless of time
        }
      });
      
      const testResult = await testResponse.json();
      
      return NextResponse.json({
        success: true,
        currentTime,
        test: 'daily-checkin',
        result: testResult
      });
    }
    
    // Default status check
    return NextResponse.json({
      success: true,
      currentTime,
      cronJobs: {
        notificationStatus: {
          schedule: '0 14 * * * (6:00 AM PST)',
          purpose: 'Sync notification status with Neynar',
          lastRun: lastSyncTime,
          timeSinceLastRun: lastSyncTime ? 
            Math.round((new Date() - new Date(lastSyncTime)) / (1000 * 60 * 60)) + ' hours ago' : 
            'Never or very old'
        },
        dailyCheckin: {
          schedule: '0 15 * * * (7:00 AM PST)',
          purpose: 'Send daily check-in notifications',
          currentlyBlocked: !isNotificationTime(),
          blockReason: 'Code expects 8:00 AM PST but cron runs at 7:00 AM PST',
          usersNeedingReminders: usersNeedingReminders.length
        },
        weeklyFullSync: {
          schedule: '0 13 * * 0 (5:00 AM PST on Sundays)',
          purpose: 'Comprehensive weekly sync'
        }
      },
      userStats: {
        totalUsers,
        enabledUsers,
        usersNeedingReminders: usersNeedingReminders.length,
        enabledPercentage: totalUsers > 0 ? Math.round((enabledUsers / totalUsers) * 100) : 0
      },
      issues: {
        timeConflict: 'Daily check-in runs at 7 AM but code expects 8 AM',
        possibleSolutions: [
          'Change cron to 0 16 * * * (8:00 AM PST)',
          'Change code to allow 7:00 AM PST notifications'
        ]
      },
      testEndpoints: {
        'test-notification-sync': 'Test the notification status sync',
        'test-daily-checkin': 'Test daily check-in notifications'
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking cron status:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      currentTime: formatPSTTime()
    }, { status: 500 });
  }
} 