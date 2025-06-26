import { NextResponse } from 'next/server';
import { createOrUpdateProfile, enableNotifications } from '@/lib/supabase';
import { sendWelcomeForNewUser } from '@/lib/neynar';

export async function POST(request) {
  try {
    console.log('=== USER REGISTRATION REQUEST ===');
    
    const { userFid, userData, notificationToken } = await request.json();
    
    console.log('User FID:', userFid);
    console.log('User Data:', userData);
    console.log('Notification Token:', notificationToken ? 'provided' : 'not provided');
    
    if (!userFid) {
      return NextResponse.json(
        { success: false, error: 'User FID is required' },
        { status: 400 }
      );
    }

    // Step 1: Create or update user profile
    console.log('Step 1: Creating/updating user profile...');
    const profileResult = await createOrUpdateProfile(userFid, userData || {});
    
    if (!profileResult.success) {
      console.error('Failed to create/update profile:', profileResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

    console.log('✅ Profile created/updated successfully');
    
    // Step 2: Handle notifications if token provided
    let notificationResult = {
      tokenStored: false,
      welcomeSent: false,
      error: null
    };

    if (notificationToken && notificationToken.token) {
      console.log('Step 2: Enabling notifications...');
      
      const enableResult = await enableNotifications(
        userFid,
        notificationToken.token,
        notificationToken.url || 'https://api.farcaster.xyz/v1/frame-notifications'
      );

      if (enableResult.success) {
        console.log('✅ Notifications enabled successfully');
        notificationResult.tokenStored = true;

        // Step 3: Send welcome notification
        console.log('Step 3: Sending welcome notification...');
        try {
          const welcomeResult = await sendWelcomeForNewUser(userFid);
          console.log('Welcome notification result:', welcomeResult);
          
          if (welcomeResult.success && !welcomeResult.skipped) {
            notificationResult.welcomeSent = true;
            console.log('✅ Welcome notification sent successfully');
          } else if (welcomeResult.skipped) {
            console.log('ℹ️ Welcome notification skipped:', welcomeResult.reason);
          } else {
            console.log('❌ Welcome notification failed:', welcomeResult.error);
            notificationResult.error = welcomeResult.error;
          }
        } catch (welcomeError) {
          console.error('Error sending welcome notification:', welcomeError);
          notificationResult.error = welcomeError.message;
        }
      } else {
        console.error('Failed to enable notifications:', enableResult.error);
        notificationResult.error = enableResult.error;
      }
    } else {
      console.log('No notification token provided - skipping notification setup');
    }

    // Return comprehensive result
    const response = {
      success: true,
      profile: {
        isNew: profileResult.isNew,
        id: profileResult.profile.id,
        fid: profileResult.profile.fid
      },
      notifications: notificationResult,
      timestamp: new Date().toISOString()
    };

    console.log('=== REGISTRATION COMPLETE ===');
    console.log('Response:', response);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in register-user:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
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