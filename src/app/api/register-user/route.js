import { NextResponse } from 'next/server';
import { createOrUpdateUserProfile } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { userFid, userData } = await request.json();

    if (!userFid || !userData) {
      return NextResponse.json(
        { success: false, error: 'Missing userFid or userData' },
        { status: 400 }
      );
    }

    console.log('Registering user profile:', userFid, userData);

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

    // Don't send welcome notification here - it should only be sent 
    // when user adds Mini App with notifications via webhook
    return NextResponse.json({
      success: true,
      message: 'User profile registered successfully',
      profile: profileResult.profile
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