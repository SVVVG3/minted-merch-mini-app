// API endpoint for sending afternoon check-in reminders
// This endpoint should be called by a cron job every day at 2 PM PST

import { sendAfternoonCheckInReminders, shouldSendAfternoonNotifications } from '../../../../lib/notifications.js';
import { formatPSTTime } from '../../../../lib/timezone.js';

// Force dynamic rendering to prevent caching issues with cron jobs
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    console.log('☀️ Afternoon check-in reminder API called');
    console.log('📅 Current PST time:', formatPSTTime());
    
    // Check for CRON_SECRET authorization (required by Vercel cron jobs)
    const authHeader = request.headers.get('authorization');
    const forceRun = request.headers.get('X-Force-Run') === 'true';
    
    // Skip auth check for manual testing only
    if (!forceRun) {
      if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.log('❌ Unauthorized cron job request - missing or invalid CRON_SECRET');
        console.log('Auth header:', authHeader);
        console.log('Expected:', `Bearer ${process.env.CRON_SECRET ? '[SET]' : '[NOT SET]'}`);
        return Response.json({
          success: false,
          error: 'Unauthorized - Invalid CRON_SECRET'
        }, { status: 401 });
      }
      console.log('✅ CRON_SECRET authorization verified');
    } else {
      console.log('✅ Manual execution with X-Force-Run header');
    }
    
    // Log cron job execution for debugging
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/api/debug/cron-health-check?job=afternoon-checkin`, {
        method: 'POST'
      });
    } catch (logError) {
      console.log('Failed to log cron execution:', logError.message);
    }
    
    if (!forceRun && !shouldSendAfternoonNotifications()) {
      const currentTime = formatPSTTime();
      console.log('⏰ Not notification time, skipping. Current time:', currentTime);
      
      return Response.json({
        success: true,
        message: 'Not notification time (2 PM PST)',
        currentTime: currentTime,
        skipped: true
      }, { status: 200 });
    }

    // Send afternoon check-in reminders
    const result = await sendAfternoonCheckInReminders();

    if (result.success) {
      console.log('✅ Afternoon check-in reminders completed successfully');
      
      return Response.json({
        success: true,
        message: 'Afternoon check-in reminders sent successfully',
        stats: {
          totalUsers: result.totalUsers,
          successCount: result.successCount,
          failureCount: result.failureCount
        },
        timestamp: formatPSTTime()
      }, { status: 200 });
    } else {
      console.error('❌ Afternoon check-in reminders failed:', result.error);
      
      return Response.json({
        success: false,
        error: result.error,
        message: 'Failed to send afternoon check-in reminders'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in afternoon check-in reminder API:', error);
    
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

    // Check for CRON_SECRET authorization (Vercel cron jobs use GET requests)
    const authHeader = request.headers.get('authorization');
    const forceRun = request.headers.get('X-Force-Run') === 'true';
    const githubActions = request.headers.get('X-GitHub-Actions') === 'true';
    
    // Allow Vercel cron requests (they use native headers)
    const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron') || 
                        request.headers.get('x-vercel-cron') === '1';
    
    // If this is a cron job request (has auth header or Vercel headers), execute notifications
    if ((authHeader || isVercelCron) && !forceRun && !githubActions) {
      if (authHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.log('❌ Unauthorized cron job GET request - invalid CRON_SECRET');
        return Response.json({
          success: false,
          error: 'Unauthorized - Invalid CRON_SECRET'
        }, { status: 401 });
      }
      
      if (authHeader) {
        console.log('✅ CRON_SECRET authorization verified for GET request');
      } else if (isVercelCron) {
        console.log('✅ Vercel cron job detected via native headers for GET request');
      }
      console.log('☀️ Afternoon check-in reminder API called via GET (Vercel cron job)');
      console.log('📅 Current PST time:', formatPSTTime());
      
      // Log cron job execution for debugging
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/api/debug/cron-health-check?job=afternoon-checkin`, {
          method: 'POST'
        });
      } catch (logError) {
        console.log('Failed to log cron execution:', logError.message);
      }
      
      if (!shouldSendAfternoonNotifications()) {
        const currentTime = formatPSTTime();
        console.log('⏰ Not notification time, skipping. Current time:', currentTime);
        
        return Response.json({
          success: true,
          message: 'Not notification time (2 PM PST)',
          currentTime: currentTime,
          skipped: true
        }, { status: 200 });
      }

      // Send afternoon check-in reminders
      const result = await sendAfternoonCheckInReminders();

      if (result.success) {
        console.log('✅ Afternoon check-in reminders completed successfully via GET');
        
        return Response.json({
          success: true,
          message: 'Afternoon check-in reminders sent successfully',
          stats: {
            totalUsers: result.totalUsers,
            successCount: result.successCount,
            failureCount: result.failureCount
          },
          timestamp: formatPSTTime()
        }, { status: 200 });
      } else {
        console.error('❌ Afternoon check-in reminders failed:', result.error);
        
        return Response.json({
          success: false,
          error: result.error,
          message: 'Failed to send afternoon check-in reminders'
        }, { status: 500 });
      }
    }

    // Handle status requests
    if (action === 'status') {
      // Return current status and next notification time
      const currentTime = formatPSTTime();
      const isNotificationTime = shouldSendAfternoonNotifications();
      
      return Response.json({
        success: true,
        currentTime: currentTime,
        isNotificationTime: isNotificationTime,
        message: isNotificationTime ? 'It is notification time (2 PM PST)' : 'Waiting for 2 PM PST'
      }, { status: 200 });
    }

    // Default: return API info
    return Response.json({
      success: true,
      message: 'Afternoon check-in reminder API',
      usage: {
        POST: 'Send afternoon check-in reminders',
        'GET?action=status': 'Check current notification status',
        'GET (with CRON_SECRET)': 'Execute notifications via Vercel cron job'
      },
      currentTime: formatPSTTime()
    }, { status: 200 });

  } catch (error) {
    console.error('Error in afternoon check-in reminder API GET:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

