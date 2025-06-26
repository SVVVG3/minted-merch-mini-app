import { NextResponse } from 'next/server';
import { sendWelcomeForNewUser } from '@/lib/neynar';

export async function POST(request) {
  try {
    const { userFid } = await request.json();
    
    console.log('=== CHECKING WELCOME NOTIFICATION FOR NEW USER ===');
    console.log('User FID:', userFid);
    
    if (!userFid) {
      return NextResponse.json(
        { success: false, error: 'User FID is required' },
        { status: 400 }
      );
    }
    
    // Send welcome notification for new user - Neynar handles delivery based on permissions
    const result = await sendWelcomeForNewUser(userFid);
    
    console.log('Welcome notification result:', result);
    
    return NextResponse.json({
      success: true,
      notificationSent: result.success && !result.skipped,
      skipped: result.skipped,
      reason: result.reason,
      error: result.error
    });
    
  } catch (error) {
    console.error('Error in check-welcome-notification:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 