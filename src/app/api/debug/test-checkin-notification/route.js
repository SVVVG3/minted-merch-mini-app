// Debug endpoint for testing check-in notifications
// Allows testing notification system with individual users

import { testCheckInReminder, createCheckInReminderMessage, getUsersNeedingCheckInReminders } from '../../../../lib/notifications.js';
import { formatPSTTime, getCurrentCheckInDay } from '../../../../lib/timezone.js';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    const body = await request.json();
    const { userFid, force } = body;

    console.log('🧪 Testing check-in notification for FID:', userFid);

    // Validate userFid
    if (!userFid) {
      return Response.json({
        success: false,
        error: 'userFid is required'
      }, { status: 400 });
    }

    const fid = parseInt(userFid);
    if (isNaN(fid) || fid <= 0) {
      return Response.json({
        success: false,
        error: 'Invalid userFid'
      }, { status: 400 });
    }

    // Test sending notification
    const result = await testCheckInReminder(fid);

    if (result.success) {
      return Response.json({
        success: true,
        message: 'Check-in notification sent successfully',
        userFid: fid,
        notification: result.message,
        timestamp: formatPSTTime()
      }, { status: 200 });
    } else {
      return Response.json({
        success: false,
        error: result.error,
        userFid: fid,
        message: 'Failed to send check-in notification'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in test check-in notification API:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      message: 'Internal server error'
    }, { status: 500 });
  }
});

export const GET = withAdminAuth(async (request, context) => {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const userFid = url.searchParams.get('userFid');

    if (action === 'message' && userFid) {
      // Preview message for specific user
      const fid = parseInt(userFid);
      if (isNaN(fid) || fid <= 0) {
        return Response.json({
          success: false,
          error: 'Invalid userFid'
        }, { status: 400 });
      }

      const message = await createCheckInReminderMessage(fid);
      
      return Response.json({
        success: true,
        userFid: fid,
        message: message,
        currentTime: formatPSTTime(),
        checkInDay: getCurrentCheckInDay()
      }, { status: 200 });
    }

    if (action === 'users') {
      // List users who need reminders
      const users = await getUsersNeedingCheckInReminders();
      
      return Response.json({
        success: true,
        usersNeedingReminders: users,
        count: users.length,
        currentTime: formatPSTTime(),
        checkInDay: getCurrentCheckInDay()
      }, { status: 200 });
    }

    // Default: return API info
    return Response.json({
      success: true,
      message: 'Check-in notification test API',
      usage: {
        'POST': 'Test send notification to specific user (requires userFid in body)',
        'GET?action=message&userFid=X': 'Preview message for user X',
        'GET?action=users': 'List users who need reminders'
      },
      currentTime: formatPSTTime(),
      checkInDay: getCurrentCheckInDay()
    }, { status: 200 });

  } catch (error) {
    console.error('Error in test check-in notification API GET:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});