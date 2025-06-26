import { NextResponse } from 'next/server';
import { getOrCreateProfile, storeNotificationToken } from '@/lib/supabase';
import { sendWelcomeNotification } from '@/lib/neynar';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userFid, userData, notificationToken } = body;

    console.log('=== USER REGISTRATION ===');
    console.log('User FID:', userFid);
    console.log('User Data:', userData);
    console.log('Notification Token:', notificationToken ? 'Provided' : 'Not provided');

    if (!userFid) {
      return NextResponse.json(
        { success: false, error: 'User FID is required' },
        { status: 400 }
      );
    }

    // Create or update user profile
    const profileResult = await getOrCreateProfile(userFid, {
      username: userData?.username || `user_${userFid}`,
      display_name: userData?.displayName || userData?.display_name || null,
      bio: userData?.bio || null,
      pfp_url: userData?.pfpUrl || userData?.pfp_url || null
    });

    if (!profileResult.success) {
      console.error('Failed to create/update profile:', profileResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

    console.log('Profile result:', profileResult.isNew ? 'Created new profile' : 'Updated existing profile');

    let notificationResult = null;
    let welcomeResult = null;

    // If notification token is provided, store it and send welcome notification
    if (notificationToken) {
      console.log('Storing notification token and sending welcome notification...');
      
      notificationResult = await storeNotificationToken(userFid, {
        token: notificationToken.token || `manual_token_${Date.now()}`,
        url: notificationToken.url || 'https://api.farcaster.xyz/v1/frame-notifications'
      });

      if (notificationResult.success) {
        console.log('✅ Notification token stored successfully');
        
        // Send welcome notification
        welcomeResult = await sendWelcomeNotification(userFid);
        if (welcomeResult.success) {
          console.log('✅ Welcome notification sent successfully!');
        } else {
          console.log('❌ Failed to send welcome notification:', welcomeResult.error);
        }
      } else {
        console.error('❌ Failed to store notification token:', notificationResult.error);
      }
    } else {
      console.log('No notification token provided - user has not enabled notifications');
    }

    return NextResponse.json({
      success: true,
      profile: {
        isNew: profileResult.isNew,
        id: profileResult.profile?.id,
        fid: userFid
      },
      notifications: {
        tokenStored: notificationResult?.success || false,
        welcomeSent: welcomeResult?.success || false,
        error: notificationResult?.error || welcomeResult?.error || null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== USER REGISTRATION ERROR ===');
    console.error('Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to register user',
        details: error.message,
        timestamp: new Date().toISOString()
      },
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