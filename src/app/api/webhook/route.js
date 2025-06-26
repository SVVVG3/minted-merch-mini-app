import { NextResponse } from 'next/server';
import { createOrUpdateUserProfile, getUserProfile } from '@/lib/supabase';
import { sendWelcomeNotification } from '@/lib/neynar';

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
        const profileResult = await createOrUpdateUserProfile({
          fid: userFid,
          username: `user_${userFid}`, // Fallback username
          display_name: null,
          bio: null,
          pfp_url: null
        });

        if (!profileResult.success) {
          console.error('Failed to create/update profile:', profileResult.error);
          return NextResponse.json({ success: false, error: 'Failed to create profile' });
        }

        console.log('✅ Profile created/updated:', profileResult.profile);

        // If notification details are provided, this means they added with notifications enabled
        if (notificationDetails && notificationDetails.token) {
          console.log('🔔 User added Mini App with notifications enabled!');
          console.log('Notification token provided by Farcaster:', notificationDetails.token);
          
          // Send welcome notification immediately since they just enabled notifications
          try {
            console.log('Sending welcome notification for new Mini App add with notifications...');
            const welcomeResult = await sendWelcomeNotification(userFid);
            console.log('Welcome notification result:', welcomeResult);
            
            return NextResponse.json({ 
              success: true, 
              message: 'Mini App added with notifications enabled',
              profileCreated: true,
              notificationsEnabled: true,
              welcomeNotificationSent: welcomeResult.success
            });
          } catch (welcomeError) {
            console.error('Failed to send welcome notification:', welcomeError);
            return NextResponse.json({ 
              success: true, 
              message: 'Mini App added with notifications enabled, but welcome notification failed',
              profileCreated: true,
              notificationsEnabled: true,
              welcomeNotificationError: welcomeError.message
            });
          }
        } else {
          console.log('📱 User added Mini App without notifications');
          return NextResponse.json({ 
            success: true, 
            message: 'Mini App added successfully (no notifications)',
            profileCreated: true,
            notificationsEnabled: false
          });
        }

      case 'notifications_enabled':
        console.log('🔔 User enabled notifications for existing Mini App');
        
        if (!notificationDetails || !notificationDetails.token) {
          console.error('No notification details provided');
          return NextResponse.json({ success: false, error: 'No notification token provided' });
        }

        console.log('Notification token provided by Farcaster:', notificationDetails.token);
        
        // Send welcome notification since they just enabled notifications
        try {
          console.log('Sending welcome notification for newly enabled notifications...');
          const welcomeResult = await sendWelcomeNotification(userFid);
          console.log('Welcome notification result:', welcomeResult);
          
          return NextResponse.json({ 
            success: true, 
            message: 'Notifications enabled successfully',
            welcomeNotificationSent: welcomeResult.success
          });
        } catch (welcomeError) {
          console.error('Failed to send welcome notification:', welcomeError);
          return NextResponse.json({ 
            success: true, 
            message: 'Notifications enabled, but welcome notification failed',
            welcomeNotificationError: welcomeError.message
          });
        }

      case 'notifications_disabled':
        console.log('🔕 User disabled notifications');
        
        // No action needed - Neynar manages the token status
        console.log('✅ Notification disable event received (Neynar manages token status)');
        return NextResponse.json({ 
          success: true, 
          message: 'Notifications disabled successfully' 
        });

      case 'frame_removed':
        console.log('📱❌ User removed Mini App');
        
        // No action needed - Neynar manages the token status
        console.log('✅ Mini App removal event received (Neynar manages token status)');
        return NextResponse.json({ 
          success: true, 
          message: 'Mini App removed successfully' 
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
    const profileResult = await createOrUpdateUserProfile({
      fid: userFid,
      username: `user_${userFid}`,
      display_name: null,
      bio: null,
      pfp_url: null
    });

    if (profileResult.success) {
      console.log('✅ Profile created/updated for frame interaction');
      return NextResponse.json({ 
        success: true, 
        message: 'Frame interaction processed',
        profileCreated: true
      });
    } else {
      console.error('Failed to create/update profile:', profileResult.error);
      return NextResponse.json({ success: false, error: 'Failed to process interaction' });
    }
  } catch (error) {
    console.error('Error handling frame interaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process interaction' },
      { status: 500 }
    );
  }
}

// GET endpoint for webhook verification
export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'Minted Merch webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
} 