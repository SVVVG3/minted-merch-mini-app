import { NextResponse } from 'next/server';
import { sendDailyCheckInReminders, getUsersNeedingCheckInReminders } from '../../../../lib/notifications.js';
import { formatPSTTime, isNotificationTime } from '../../../../lib/timezone.js';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    console.log('🧪 Testing daily check-in notification system...');
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    
    const currentTime = formatPSTTime();
    const isNotificationTimeNow = isNotificationTime();
    
    if (action === 'status') {
      // Get users who need reminders
      const usersNeedingReminders = await getUsersNeedingCheckInReminders();
      
      return NextResponse.json({
        success: true,
        currentTime,
        isNotificationTime: isNotificationTimeNow,
        usersNeedingReminders: usersNeedingReminders.length,
        userFids: usersNeedingReminders,
        message: `Current time: ${currentTime}. Notification time: ${isNotificationTimeNow ? 'YES' : 'NO'}`
      });
    }
    
    if (action === 'send') {
      console.log('🚀 Manually triggering daily check-in notifications...');
      
      // Force run the notifications
      const result = await sendDailyCheckInReminders();
      
      return NextResponse.json({
        success: true,
        currentTime,
        isNotificationTime: isNotificationTimeNow,
        forced: true,
        result,
        message: 'Daily check-in notifications sent (forced)'
      });
    }
    
    return NextResponse.json({
      success: true,
      currentTime,
      isNotificationTime: isNotificationTimeNow,
      actions: {
        'status': 'Check current status and eligible users',
        'send': 'Force send notifications now'
      },
      message: 'Daily check-in notification test endpoint'
    });
    
  } catch (error) {
    console.error('❌ Error in daily check-in test:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      currentTime: formatPSTTime()
    }, { status: 500 });
  }
});

export const POST = withAdminAuth(async (request, context) => {
  try {
    console.log('🚀 Force sending daily check-in notifications via POST...');
    
    // Force run the notifications by bypassing time check
    const result = await sendDailyCheckInReminders();
    
    return NextResponse.json({
      success: true,
      currentTime: formatPSTTime(),
      forced: true,
      result,
      message: 'Daily check-in notifications sent (forced via POST)'
    });
    
  } catch (error) {
    console.error('❌ Error in forced daily check-in:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      currentTime: formatPSTTime()
    }, { status: 500 });
  }
});