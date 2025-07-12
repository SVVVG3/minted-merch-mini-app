// API endpoint for sending daily check-in reminders
// This endpoint should be called by a cron job every day at 8 AM PST

import { sendDailyCheckInReminders, shouldSendDailyNotifications } from '../../../../lib/notifications.js';
import { formatPSTTime } from '../../../../lib/timezone.js';

export async function POST(request) {
  try {
    console.log('🚀 Daily check-in reminder API called');
    console.log('📅 Current PST time:', formatPSTTime());
    
    // Log cron job execution for debugging
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app'}/api/debug/cron-health-check?job=daily-checkin`, {
        method: 'POST'
      });
    } catch (logError) {
      console.log('Failed to log cron execution:', logError.message);
    }

    // Optional: Check if it's actually 8 AM PST (can be disabled for testing)
    const forceRun = request.headers.get('X-Force-Run') === 'true';
    
    if (!forceRun && !shouldSendDailyNotifications()) {
      const currentTime = formatPSTTime();
      console.log('⏰ Not notification time, skipping. Current time:', currentTime);
      
      return Response.json({
        success: true,
        message: 'Not notification time (8 AM PST)',
        currentTime: currentTime,
        skipped: true
      }, { status: 200 });
    }

    // Send daily check-in reminders
    const result = await sendDailyCheckInReminders();

    if (result.success) {
      console.log('✅ Daily check-in reminders completed successfully');
      
      return Response.json({
        success: true,
        message: 'Daily check-in reminders sent successfully',
        stats: {
          totalUsers: result.totalUsers,
          successCount: result.successCount,
          failureCount: result.failureCount
        },
        timestamp: formatPSTTime()
      }, { status: 200 });
    } else {
      console.error('❌ Daily check-in reminders failed:', result.error);
      
      return Response.json({
        success: false,
        error: result.error,
        message: 'Failed to send daily check-in reminders'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in daily check-in reminder API:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'status') {
      // Return current status and next notification time
      const currentTime = formatPSTTime();
      const isNotificationTime = shouldSendDailyNotifications();
      
      return Response.json({
        success: true,
        currentTime: currentTime,
        isNotificationTime: isNotificationTime,
        message: isNotificationTime ? 'It is notification time (8 AM PST)' : 'Waiting for 8 AM PST'
      }, { status: 200 });
    }

    // Default: return API info
    return Response.json({
      success: true,
      message: 'Daily check-in reminder API',
      usage: {
        POST: 'Send daily check-in reminders',
        'GET?action=status': 'Check current notification status'
      },
      currentTime: formatPSTTime()
    }, { status: 200 });

  } catch (error) {
    console.error('Error in daily check-in reminder API GET:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 