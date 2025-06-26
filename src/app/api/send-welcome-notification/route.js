import { NextResponse } from 'next/server';
import { sendWelcomeNotification } from '@/lib/neynar';

export async function POST(request) {
  try {
    const { userFid } = await request.json();
    
    console.log('=== SENDING WELCOME NOTIFICATION ===');
    console.log('User FID:', userFid);
    
    if (!userFid) {
      return NextResponse.json(
        { success: false, error: 'User FID is required' },
        { status: 400 }
      );
    }
    
    // Send welcome notification - this is for users who explicitly add the Mini App
    const result = await sendWelcomeNotification(userFid);
    
    console.log('Welcome notification result:', result);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Welcome notification sent successfully',
        data: result.data
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in send-welcome-notification:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 