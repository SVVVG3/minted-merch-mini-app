import { NextResponse } from 'next/server';
import { sendWelcomeNotification } from '@/lib/neynar';

export async function POST(request) {
  try {
    const { userFid } = await request.json();
    
    if (!userFid) {
      return NextResponse.json(
        { success: false, error: 'userFid is required' },
        { status: 400 }
      );
    }

    console.log('Manually sending welcome notification to user FID:', userFid);

    // Send welcome notification
    const welcomeResult = await sendWelcomeNotification(userFid);
    
    if (welcomeResult.success) {
      console.log('✅ Welcome notification sent successfully');
      return NextResponse.json({
        success: true,
        message: 'Welcome notification sent successfully',
        data: welcomeResult.data
      });
    } else {
      console.log('❌ Welcome notification failed:', welcomeResult.error);
      return NextResponse.json({
        success: false,
        error: welcomeResult.error,
        status: welcomeResult.status,
        details: welcomeResult.details
      });
    }

  } catch (error) {
    console.error('Error sending welcome notification:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Welcome notification endpoint is active',
    usage: 'POST with {"userFid": 123456} to send welcome notification'
  });
} 