import { NextResponse } from 'next/server';
import { sendWelcomeNotificationWithNeynar, checkUserNotificationStatus } from '@/lib/neynar';
import { hasWelcomeNotificationBeenSent, markWelcomeNotificationSent } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { fid } = await request.json();

    if (!fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'FID is required' 
      }, { status: 400 });
    }

    console.log('=== SENDING WELCOME NOTIFICATION ===');
    console.log('Target FID:', fid);

    // Check if welcome notification has already been sent
    const alreadySent = await hasWelcomeNotificationBeenSent(fid);
    if (alreadySent.success && alreadySent.sent) {
      console.log('Welcome notification already sent to this user');
      return NextResponse.json({
        success: false,
        error: 'Welcome notification already sent',
        sentAt: alreadySent.sentAt
      });
    }

    // Check if user has notifications enabled via Neynar
    const notificationStatus = await checkUserNotificationStatus(fid);
    console.log('User notification status:', notificationStatus);

    if (!notificationStatus.hasNotifications) {
      console.log('User does not have notifications enabled');
      return NextResponse.json({
        success: false,
        error: 'User has not enabled notifications',
        details: notificationStatus
      });
    }

    // Send welcome notification via Neynar managed system
    const result = await sendWelcomeNotificationWithNeynar(fid);
    console.log('Welcome notification result:', result);

    if (result.success) {
      // Mark notification as sent in database
      const markResult = await markWelcomeNotificationSent(fid);
      if (markResult.success) {
        console.log('✅ Welcome notification marked as sent in database');
      } else {
        console.log('⚠️ Failed to mark welcome notification as sent:', markResult.error);
      }

      return NextResponse.json({
        success: true,
        message: 'Welcome notification sent successfully',
        notificationId: result.notificationId,
        delivery: result.delivery
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details
      });
    }

  } catch (error) {
    console.error('❌ Error in send-welcome-notification endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'Send welcome notification endpoint is active',
    timestamp: new Date().toISOString()
  });
} 