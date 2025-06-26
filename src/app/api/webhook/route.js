import { NextResponse } from 'next/server';
import { sendWelcomeNotification } from '@/lib/neynar';
import { 
  getOrCreateProfile, 
  storeNotificationToken, 
  disableNotificationToken 
} from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Enhanced logging for debugging
    console.log('=== FARCASTER WEBHOOK RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    console.log('Raw Body:', JSON.stringify(body, null, 2));
    
    // Handle Farcaster's JSON Farcaster Signature format
    if (body.header && body.payload && body.signature) {
      console.log('Processing JSON Farcaster Signature format');
      
      // Decode the payload to get the actual event data
      const decodedPayload = JSON.parse(Buffer.from(body.payload, 'base64url').toString());
      console.log('Decoded Payload:', JSON.stringify(decodedPayload, null, 2));
      
      // Decode the header to get user information
      const decodedHeader = JSON.parse(Buffer.from(body.header, 'base64url').toString());
      console.log('Decoded Header:', JSON.stringify(decodedHeader, null, 2));
      
      // Handle the event based on the decoded payload
      await handleFarcasterEvent(decodedPayload, decodedHeader, body);
    } else {
      // Handle direct event format (for testing)
      console.log('Processing direct event format');
      await handleDirectEvent(body);
    }
    
    console.log('=== END WEBHOOK DATA ===');

    // Return success response
    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== WEBHOOK ERROR ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error:', error);
    console.error('=== END WEBHOOK ERROR ===');
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process webhook',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Handle Farcaster events in the proper format
async function handleFarcasterEvent(payload, header, signedData) {
  console.log('=== HANDLING FARCASTER EVENT ===');
  console.log('Event type:', payload.event);
  console.log('User FID:', header.fid);
  
  const userFid = header.fid;
  
  switch (payload.event) {
    case 'frame_added':
      await handleFrameAdded(payload, userFid);
      break;
    
    case 'frame_removed':
      await handleFrameRemoved(payload, userFid);
      break;
    
    case 'notifications_enabled':
      await handleNotificationsEnabled(payload, userFid);
      break;
    
    case 'notifications_disabled':
      await handleNotificationsDisabled(payload, userFid);
      break;
    
    default:
      console.log('Unknown Farcaster event type:', payload.event);
  }
}

// Handle direct events (for testing)
async function handleDirectEvent(body) {
  console.log('=== HANDLING DIRECT EVENT ===');
  
  switch (body.type) {
    case 'app.added':
      await handleAppAdded(body);
      break;
    
    case 'app.removed':
      await handleAppRemoved(body);
      break;
    
    default:
      console.log('Unknown direct event type:', body.type);
  }
}

// Handle frame_added event (the correct Farcaster event)
async function handleFrameAdded(payload, userFid) {
  console.log('=== FRAME ADDED ===');
  console.log('User FID:', userFid);
  console.log('Notification details:', payload.notificationDetails);
  
  if (!userFid) {
    console.log('No user FID found in event data');
    return;
  }

  // First, ensure user profile exists in our database
  try {
    const profileResult = await getOrCreateProfile(userFid, {
      username: `user_${userFid}`, // We'll update this with real data later
      display_name: null,
      bio: null,
      pfp_url: null
    });

    if (!profileResult.success) {
      console.error('Failed to create/get user profile:', profileResult.error);
      // Continue anyway, don't block the notification flow
    } else {
      console.log('User profile ready:', profileResult.profile?.id);
    }
  } catch (error) {
    console.error('Error handling user profile:', error);
    // Continue anyway
  }

  // Check if user enabled notifications
  if (payload.notificationDetails && payload.notificationDetails.token) {
    console.log('🎉 User enabled notifications - storing token and sending welcome notification!');
    
    // Store the notification token in our database
    try {
      const tokenResult = await storeNotificationToken(userFid, payload.notificationDetails);
      if (tokenResult.success) {
        console.log('✅ Notification token stored successfully');
      } else {
        console.error('❌ Failed to store notification token:', tokenResult.error);
      }
    } catch (error) {
      console.error('Error storing notification token:', error);
    }
    
    // Send welcome notification
    try {
      const result = await sendWelcomeNotification(userFid);
      console.log('Welcome notification result:', result);
      
      if (result.success) {
        console.log('✅ Welcome notification sent successfully!');
      } else {
        console.log('❌ Failed to send welcome notification:', result.error);
      }
    } catch (error) {
      console.error('Error sending welcome notification:', error);
    }
  } else {
    console.log('User did not enable notifications - no token to store');
  }
}

// Handle frame_removed event
async function handleFrameRemoved(payload, userFid) {
  console.log('=== FRAME REMOVED ===');
  console.log('User FID:', userFid);
  
  if (userFid) {
    console.log(`User ${userFid} removed the Mini App`);
    
    // Disable their notification token
    try {
      const result = await disableNotificationToken(userFid);
      if (result.success) {
        console.log('✅ Notification token disabled successfully');
      } else {
        console.error('❌ Failed to disable notification token:', result.error);
      }
    } catch (error) {
      console.error('Error disabling notification token:', error);
    }
  }
}

// Handle notifications_enabled event
async function handleNotificationsEnabled(payload, userFid) {
  console.log('=== NOTIFICATIONS ENABLED ===');
  console.log('User FID:', userFid);
  console.log('Notification details:', payload.notificationDetails);
  
  if (userFid && payload.notificationDetails) {
    console.log(`User ${userFid} enabled notifications`);
    
    // Store the new notification token
    try {
      const tokenResult = await storeNotificationToken(userFid, payload.notificationDetails);
      if (tokenResult.success) {
        console.log('✅ Notification token stored successfully');
        
        // Send a welcome notification since they just enabled notifications
        const result = await sendWelcomeNotification(userFid);
        if (result.success) {
          console.log('✅ Welcome notification sent!');
        }
      } else {
        console.error('❌ Failed to store notification token:', tokenResult.error);
      }
    } catch (error) {
      console.error('Error handling notifications enabled:', error);
    }
  }
}

// Handle notifications_disabled event
async function handleNotificationsDisabled(payload, userFid) {
  console.log('=== NOTIFICATIONS DISABLED ===');
  console.log('User FID:', userFid);
  
  if (userFid) {
    console.log(`User ${userFid} disabled notifications`);
    
    // Disable their notification token
    try {
      const result = await disableNotificationToken(userFid);
      if (result.success) {
        console.log('✅ Notification token disabled successfully');
      } else {
        console.error('❌ Failed to disable notification token:', result.error);
      }
    } catch (error) {
      console.error('Error disabling notification token:', error);
    }
  }
}

// Legacy handlers for backward compatibility
async function handleAppAdded(body) {
  console.log('=== MINI APP ADDED (LEGACY) ===');
  
  const userFid = body.data?.user?.fid;
  const notificationDetails = body.data?.notification_details;
  
  console.log('User FID:', userFid);
  console.log('Notification details:', notificationDetails);
  
  if (!userFid) {
    console.log('No user FID found in webhook data');
    return;
  }

  // Check if user enabled notifications
  if (notificationDetails && notificationDetails.token) {
    console.log('User enabled notifications - sending welcome notification');
    
    try {
      const result = await sendWelcomeNotification(userFid);
      console.log('Welcome notification result:', result);
      
      if (result.success) {
        console.log('✅ Welcome notification sent successfully!');
      } else {
        console.log('❌ Failed to send welcome notification:', result.error);
      }
    } catch (error) {
      console.error('Error sending welcome notification:', error);
    }
  } else {
    console.log('User did not enable notifications - no welcome notification sent');
  }
}

async function handleAppRemoved(body) {
  console.log('=== MINI APP REMOVED (LEGACY) ===');
  
  const userFid = body.data?.user?.fid;
  console.log('User FID:', userFid);
  
  if (userFid) {
    console.log(`User ${userFid} removed the Mini App`);
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