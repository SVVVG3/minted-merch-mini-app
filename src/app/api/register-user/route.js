import { NextResponse } from 'next/server';
import { createOrUpdateUserProfile } from '@/lib/supabase';
import { sendWelcomeForNewUser } from '@/lib/neynar';

export async function POST(request) {
  try {
    const { userFid, userData } = await request.json();

    if (!userFid || !userData) {
      return NextResponse.json(
        { success: false, error: 'Missing userFid or userData' },
        { status: 400 }
      );
    }

    console.log('Registering user:', userFid, userData);

    // Create or update user profile in Supabase (without notification tokens)
    const profileResult = await createOrUpdateUserProfile({
      fid: userFid,
      username: userData.username,
      display_name: userData.displayName,
      bio: userData.bio,
      pfp_url: userData.pfpUrl
    });

    if (!profileResult.success) {
      console.error('Failed to create user profile:', profileResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to create user profile', details: profileResult.error },
        { status: 500 }
      );
    }

    console.log('User profile created/updated successfully:', profileResult.profile);

    // Try to send welcome notification (if user has notifications enabled in Neynar)
    // This will gracefully fail if user hasn't enabled notifications yet
    const welcomeResult = await sendWelcomeForNewUser(userFid);
    
    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      profile: profileResult.profile,
      welcomeNotification: {
        attempted: true,
        success: welcomeResult.success,
        skipped: welcomeResult.skipped || false,
        reason: welcomeResult.reason || null,
        error: welcomeResult.error || null
      }
    });

  } catch (error) {
    console.error('Error in register-user:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Handle GET requests for testing
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userFid = parseInt(searchParams.get('userFid')) || 466111;
  
  return NextResponse.json({
    message: 'User registration endpoint',
    usage: 'POST with { userFid, userData, notificationToken }',
    testUserFid: userFid,
    timestamp: new Date().toISOString()
  });
} 