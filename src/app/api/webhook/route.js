import { NextResponse } from 'next/server';
import { createOrUpdateProfile, enableNotifications, disableNotifications } from '@/lib/supabase';
import { sendWelcomeForNewUser } from '@/lib/neynar';

export async function POST(request) {
  try {
    console.log('=== WEBHOOK RECEIVED ===');
    
    const body = await request.json();
    console.log('Webhook payload:', JSON.stringify(body, null, 2));

    // Extract user info from the webhook
    const userFid = body.untrustedData?.fid;
    
    if (!userFid) {
      console.log('No user FID found in webhook payload');
      return NextResponse.json({ success: false, error: 'No user FID provided' });
    }

    console.log('Processing webhook for user FID:', userFid);

    // Handle different webhook events
    if (body.event) {
      return await handleFarcasterEvent(body, userFid);
    }

    // Handle legacy frame interactions (if any)
    return await handleFrameInteraction(body, userFid);

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleFarcasterEvent(body, userFid) {
  const { event, notificationDetails } = body;
  
  console.log('=== HANDLING FARCASTER EVENT ===');
  console.log('Event type:', event);
  console.log('User FID:', userFid);
  console.log('Notification details:', notificationDetails);

  try {
    switch (event) {
      case 'frame_added':
        console.log('📱 User added Mini App');
        
        // Create/update user profile (we may not have full user data from webhook)
        const profileResult = await createOrUpdateProfile(userFid, {
          username: `user_${userFid}`, // Fallback username
          displayName: null,
          bio: null,
          pfpUrl: null
        });

        if (!profileResult.success) {
          console.error('Failed to create/update profile:', profileResult.error);
          return NextResponse.json({ success: false, error: 'Failed to create profile' });
        }

        console.log('✅ Profile created/updated:', profileResult.profile);

        // If notification details are provided, enable notifications
        if (notificationDetails && notificationDetails.token) {
          console.log('🔔 Enabling notifications with token from webhook');
          
          const notificationResult = await enableNotifications(
            userFid,
            notificationDetails.token,
            notificationDetails.url
          );

          if (notificationResult.success) {
            console.log('✅ Notifications enabled successfully');
            
            // Send welcome notification
            try {
              const welcomeResult = await sendWelcomeForNewUser(userFid);
              console.log('Welcome notification result:', welcomeResult);
            } catch (welcomeError) {
              console.error('Failed to send welcome notification:', welcomeError);
            }
          } else {
            console.error('Failed to enable notifications:', notificationResult.error);
          }
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Mini App added successfully',
          profileCreated: true,
          notificationsEnabled: !!notificationDetails?.token
        });

      case 'notifications_enabled':
        console.log('🔔 User enabled notifications');
        
        if (!notificationDetails || !notificationDetails.token) {
          console.error('No notification details provided');
          return NextResponse.json({ success: false, error: 'No notification token provided' });
        }

        const enableResult = await enableNotifications(
          userFid,
          notificationDetails.token,
          notificationDetails.url
        );

        if (enableResult.success) {
          console.log('✅ Notifications enabled successfully');
          
          // Send welcome notification for newly enabled notifications
          try {
            const welcomeResult = await sendWelcomeForNewUser(userFid);
            console.log('Welcome notification result:', welcomeResult);
          } catch (welcomeError) {
            console.error('Failed to send welcome notification:', welcomeError);
          }
          
          return NextResponse.json({ 
            success: true, 
            message: 'Notifications enabled successfully',
            welcomeNotificationSent: true
          });
        } else {
          console.error('Failed to enable notifications:', enableResult.error);
          return NextResponse.json({ success: false, error: 'Failed to enable notifications' });
        }

      case 'notifications_disabled':
        console.log('🔕 User disabled notifications');
        
        const disableResult = await disableNotifications(userFid);
        
        if (disableResult.success) {
          console.log('✅ Notifications disabled successfully');
          return NextResponse.json({ 
            success: true, 
            message: 'Notifications disabled successfully' 
          });
        } else {
          console.error('Failed to disable notifications:', disableResult.error);
          return NextResponse.json({ success: false, error: 'Failed to disable notifications' });
        }

      case 'frame_removed':
        console.log('📱❌ User removed Mini App');
        
        // Disable notifications when Mini App is removed
        const removeResult = await disableNotifications(userFid);
        
        if (removeResult.success) {
          console.log('✅ Notifications disabled due to Mini App removal');
        } else {
          console.error('Failed to disable notifications on removal:', removeResult.error);
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Mini App removed, notifications disabled' 
        });

      default:
        console.log('⚠️ Unknown event type:', event);
        return NextResponse.json({ 
          success: true, 
          message: 'Event received but not handled',
          event: event
        });
    }
  } catch (error) {
    console.error('Error handling Farcaster event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process event' },
      { status: 500 }
    );
  }
}

async function handleFrameInteraction(body, userFid) {
  console.log('=== HANDLING LEGACY FRAME INTERACTION ===');
  console.log('User FID:', userFid);
  
  // For legacy frame interactions, just create/update profile
  try {
    const profileResult = await createOrUpdateProfile(userFid, {
      username: `user_${userFid}`,
      displayName: null,
      bio: null,
      pfpUrl: null
    });

    if (profileResult.success) {
      console.log('✅ Profile created/updated for frame interaction');
      return NextResponse.json({ 
        success: true, 
        message: 'Frame interaction processed' 
      });
    } else {
      console.error('Failed to create/update profile:', profileResult.error);
      return NextResponse.json({ success: false, error: 'Failed to process interaction' });
    }
  } catch (error) {
    console.error('Error handling frame interaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process frame interaction' },
      { status: 500 }
    );
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({ 
    message: 'Minted Merch Farcaster webhook endpoint',
    status: 'active',
    timestamp: new Date().toISOString(),
    expectedEvents: ['frame_added', 'frame_removed', 'notifications_enabled', 'notifications_disabled'],
    features: ['supabase_integration', 'notification_token_storage', 'user_profile_management']
  });
} 