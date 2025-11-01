import { NextResponse } from 'next/server';
import { sendWelcomeNotificationWithNeynar, checkUserNotificationStatus } from '@/lib/neynar';
import { hasWelcomeNotificationBeenSent, markWelcomeNotificationSent } from '@/lib/supabase';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

export async function POST(request) {
  try {
    const { fid } = await request.json();

    if (!fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'FID is required' 
      }, { status: 400 });
    }

    // PHASE 2 SECURITY: Verify user can only send notifications to themselves
    // Prevents notification spam attacks
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Return 401 or 403 error

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

    // Check if user has any notification tokens (for logging purposes)
    const notificationStatus = await checkUserNotificationStatus(fid);
    console.log('User notification status:', notificationStatus);

    // Send welcome notification via Neynar managed system
    // Note: Neynar can send notifications even with "disabled" tokens
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
        delivery: result.delivery,
        tokenStatus: notificationStatus
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details,
        tokenStatus: notificationStatus
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