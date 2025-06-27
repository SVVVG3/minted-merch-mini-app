import { NextResponse } from 'next/server';
import { createOrUpdateUserProfile, getUserProfile, markWelcomeNotificationSent } from '@/lib/supabase';
import { sendWelcomeNotification } from '@/lib/neynar';
import { parseWebhookEvent, verifyAppKeyWithNeynar } from '@farcaster/frame-node';

export async function POST(request) {
  try {
    console.log('=== FARCASTER WEBHOOK RECEIVED ===');
    
    // Get raw body
    const rawBody = await request.text();
    console.log('Raw webhook body received, length:', rawBody.length);

    let eventData;
    
    // First, try to parse as simple JSON (unsigned events)
    try {
      console.log('Attempting to parse as simple JSON webhook event...');
      const simpleEvent = JSON.parse(rawBody);
      console.log('✅ Parsed as simple JSON:', JSON.stringify(simpleEvent, null, 2));
      
      // Check if this looks like a simple Farcaster event
      if (simpleEvent.event && typeof simpleEvent.event === 'string') {
        console.log('✅ Detected simple Farcaster event format');
        eventData = {
          event: simpleEvent.event,
          notificationDetails: simpleEvent.notificationDetails,
          fid: simpleEvent.fid || simpleEvent.untrustedData?.fid
        };
      } else {
        throw new Error('Not a simple Farcaster event format');
      }
    } catch (jsonError) {
      console.log('⚠️ Not simple JSON, attempting signed event parsing...');
      
      // Try to parse as signed Farcaster webhook event
      try {
        console.log('Parsing signed Farcaster webhook event...');
        eventData = await parseWebhookEvent(rawBody, verifyAppKeyWithNeynar);
        console.log('✅ Webhook event parsed and verified successfully');
        console.log('Event data:', JSON.stringify(eventData, null, 2));
      } catch (parseError) {
        console.error('❌ Failed to parse as signed webhook event:', parseError);
        
        // Log the raw body for debugging (first 500 chars)
        console.log('Raw body sample:', rawBody.substring(0, 500));
        
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid webhook format - not simple JSON or signed event',
          details: parseError.message 
        }, { status: 400 });
      }
    }

    // Extract user FID and event type from parsed data
    const userFid = eventData.fid;
    const eventType = eventData.event;
    
    if (!userFid) {
      console.error('No user FID found in webhook event');
      return NextResponse.json({ success: false, error: 'No user FID provided' }, { status: 400 });
    }

    if (!eventType) {
      console.error('No event type found in webhook event');
      return NextResponse.json({ success: false, error: 'No event type provided' }, { status: 400 });
    }

    console.log('🔗 FARCASTER EVENT:', eventType);
    console.log('👤 User FID:', userFid);

    // Handle different Farcaster webhook events
    return await handleFarcasterEvent(eventData);

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

async function handleFarcasterEvent(eventData) {
  const { fid: userFid, event, notificationDetails } = eventData;
  
  console.log('=== HANDLING FARCASTER EVENT ===');
  console.log('Event type:', event);
  console.log('User FID:', userFid);
  console.log('Notification details:', notificationDetails);

  try {
    switch (event) {
      case 'frame_added':
        console.log('📱 User added Mini App to Farcaster');
        
        // Create/update user profile
        const profileResult = await createOrUpdateUserProfile({
          fid: userFid,
          username: `user_${userFid}`, // Fallback username - we may get more data later
          display_name: null,
          bio: null,
          pfp_url: null
        });

        if (!profileResult.success) {
          console.error('❌ Failed to create/update profile:', profileResult.error);
          return NextResponse.json({ 
            success: false, 
            error: 'Failed to create profile',
            details: profileResult.error 
          }, { status: 500 });
        }

        console.log('✅ Profile created/updated for FID:', userFid);

        // Check if notifications are enabled (token provided)
        if (notificationDetails && notificationDetails.token && notificationDetails.url) {
          console.log('🔔 User added Mini App WITH notifications enabled!');
          console.log('Notification URL:', notificationDetails.url);
          console.log('Token received (length):', notificationDetails.token.length);
          
          // Send welcome notification using Farcaster's provided token and URL
          try {
            console.log('Sending welcome notification via Farcaster notification system...');
            const welcomeResult = await sendDirectWelcomeNotification(
              notificationDetails.url,
              notificationDetails.token
            );
            
            console.log('Welcome notification result:', welcomeResult);
            
            // Mark notification as sent if successful
            if (welcomeResult.success) {
              const markResult = await markWelcomeNotificationSent(userFid);
              if (markResult.success) {
                console.log('✅ Welcome notification marked as sent in database');
              } else {
                console.log('⚠️ Failed to mark welcome notification as sent:', markResult.error);
              }
            }
            
            return NextResponse.json({ 
              success: true, 
              message: 'Mini App added with notifications enabled',
              event: 'frame_added',
              userFid,
              profileCreated: true,
              notificationsEnabled: true,
              welcomeNotificationSent: welcomeResult.success
            });
          } catch (welcomeError) {
            console.error('❌ Failed to send welcome notification:', welcomeError);
            return NextResponse.json({ 
              success: true, 
              message: 'Mini App added with notifications enabled, but welcome notification failed',
              event: 'frame_added',
              userFid,
              profileCreated: true,
              notificationsEnabled: true,
              welcomeNotificationError: welcomeError.message
            });
          }
        } else {
          console.log('📱 User added Mini App WITHOUT notifications');
          return NextResponse.json({ 
            success: true, 
            message: 'Mini App added successfully (no notifications)',
            event: 'frame_added',
            userFid,
            profileCreated: true,
            notificationsEnabled: false
          });
        }

      case 'notifications_enabled':
        console.log('🔔 User enabled notifications for existing Mini App');
        
        if (!notificationDetails || !notificationDetails.token || !notificationDetails.url) {
          console.error('❌ No notification details provided for notifications_enabled event');
          return NextResponse.json({ 
            success: false, 
            error: 'No notification token/URL provided' 
          }, { status: 400 });
        }

        console.log('Notification URL:', notificationDetails.url);
        console.log('Token received (length):', notificationDetails.token.length);
        
        // Send welcome notification using Farcaster's provided token and URL
        try {
          console.log('Sending welcome notification via Farcaster notification system...');
          const welcomeResult = await sendDirectWelcomeNotification(
            notificationDetails.url,
            notificationDetails.token
          );
          
          console.log('Welcome notification result:', welcomeResult);
          
          // Mark notification as sent if successful
          if (welcomeResult.success) {
            const markResult = await markWelcomeNotificationSent(userFid);
            if (markResult.success) {
              console.log('✅ Welcome notification marked as sent in database');
            } else {
              console.log('⚠️ Failed to mark welcome notification as sent:', markResult.error);
            }
          }
          
          return NextResponse.json({ 
            success: true, 
            message: 'Notifications enabled successfully',
            event: 'notifications_enabled',
            userFid,
            welcomeNotificationSent: welcomeResult.success
          });
        } catch (welcomeError) {
          console.error('❌ Failed to send welcome notification:', welcomeError);
          return NextResponse.json({ 
            success: true, 
            message: 'Notifications enabled, but welcome notification failed',
            event: 'notifications_enabled',
            userFid,
            welcomeNotificationError: welcomeError.message
          });
        }

      case 'notifications_disabled':
        console.log('🔕 User disabled notifications');
        console.log('✅ Notification disable event received');
        return NextResponse.json({ 
          success: true, 
          message: 'Notifications disabled event received',
          event: 'notifications_disabled',
          userFid
        });

      case 'frame_removed':
        console.log('❌ User removed Mini App');
        console.log('✅ Mini App removal event received');
        return NextResponse.json({ 
          success: true, 
          message: 'Mini App removal event received',
          event: 'frame_removed',
          userFid
        });

      default:
        console.log('❓ Unknown event type:', event);
        return NextResponse.json({ 
          success: true, 
          message: 'Unknown event type received',
          event,
          userFid
        });
    }

  } catch (error) {
    console.error('❌ Error handling Farcaster event:', error);
    return NextResponse.json(
      { success: false, error: 'Error handling event', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to send welcome notification directly using Farcaster token and URL
async function sendDirectWelcomeNotification(notificationUrl, token) {
  try {
    const notification = {
      notificationId: `welcome-${Date.now()}`,
      title: "👋 Welcome to Minted Merch!",
      body: "Discover our exclusive collection of premium merchandise. Start shopping now!",
      targetUrl: "https://mintedmerch.vercel.app",
      tokens: [token]
    };

    console.log('Sending notification to URL:', notificationUrl);
    console.log('Notification payload:', JSON.stringify(notification, null, 2));

    const response = await fetch(notificationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });

    const responseText = await response.text();
    console.log('Notification response status:', response.status);
    console.log('Notification response body:', responseText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.log('Response is not JSON, treating as success');
      result = { success: true, rawResponse: responseText };
    }

    return { success: true, result };
  } catch (error) {
    console.error('❌ Failed to send direct welcome notification:', error);
    return { success: false, error: error.message };
  }
}

// GET endpoint for webhook verification
export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'Minted Merch webhook endpoint is active',
    timestamp: new Date().toISOString(),
    version: '3.0 - Handles both signed and unsigned Farcaster events'
  });
} 