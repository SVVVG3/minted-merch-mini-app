import { NextResponse } from 'next/server';
import { sendEveningCheckInReminders, shouldSendEveningNotifications } from '../../../../lib/notifications.js';
import { formatPSTTime, isEveningNotificationTime } from '../../../../lib/timezone.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const testFid = url.searchParams.get('testFid');

    console.log('🧪 Testing evening check-in reminder system...');
    console.log('📅 Current PST time:', formatPSTTime());

    if (action === 'status') {
      // Check timing status
      const currentTime = formatPSTTime();
      const isEveningTime = isEveningNotificationTime();
      const shouldSendEvening = shouldSendEveningNotifications();
      
      return NextResponse.json({
        success: true,
        currentTime: currentTime,
        isEveningNotificationTime: isEveningTime,
        shouldSendEveningNotifications: shouldSendEvening,
        message: isEveningTime ? 'It is evening notification time (8 PM PST)' : 'Not evening notification time',
        testEndpoints: {
          'GET /api/debug/test-evening-checkin': 'Test evening notification system',
          'GET /api/debug/test-evening-checkin?action=status': 'Check evening notification timing',
          'GET /api/debug/test-evening-checkin?action=force': 'Force send evening reminders (bypass time check)',
          'GET /api/debug/test-evening-checkin?action=single&testFid=123': 'Test single user evening reminder'
        }
      });
    }

    if (action === 'single' && testFid) {
      // Test single user reminder
      const { sendEveningCheckInReminder } = await import('../../../../lib/notifications.js');
      
      console.log(`🎯 Testing evening reminder for single user FID: ${testFid}`);
      
      const result = await sendEveningCheckInReminder(parseInt(testFid));
      
      return NextResponse.json({
        success: true,
        message: `Evening reminder test for FID ${testFid} completed`,
        result: result,
        timestamp: formatPSTTime()
      });
    }

    if (action === 'force') {
      // Force send evening reminders (bypass time check)
      console.log('🔄 Force sending evening check-in reminders...');
      
      const result = await sendEveningCheckInReminders();
      
      return NextResponse.json({
        success: true,
        message: 'Evening check-in reminders sent (forced)',
        stats: {
          totalUsers: result.totalUsers,
          successCount: result.successCount,
          failureCount: result.failureCount
        },
        timestamp: formatPSTTime()
      });
    }

    // Default: return system info
    return NextResponse.json({
      success: true,
      message: 'Evening check-in reminder debug endpoint',
      currentTime: formatPSTTime(),
      isEveningNotificationTime: isEveningNotificationTime(),
      shouldSendEveningNotifications: shouldSendEveningNotifications(),
      info: {
        purpose: 'Second daily reminder sent 12 hours after morning reminder (8 PM PST)',
        morningReminder: '8 AM PST',
        eveningReminder: '8 PM PST',
        messagingTone: 'More urgent - "last chance" messaging'
      },
      testOptions: {
        'action=status': 'Check timing status',
        'action=force': 'Force send evening reminders',
        'action=single&testFid=123': 'Test single user reminder'
      }
    });

  } catch (error) {
    console.error('❌ Error in evening check-in reminder debug endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 