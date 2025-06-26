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
    
    // Send welcome notification
    const result = await sendWelcomeNotification(userFid);
    
    console.log('Welcome notification result:', result);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Welcome notification sent successfully',
        result: result.result
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error in welcome notification endpoint:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
} 