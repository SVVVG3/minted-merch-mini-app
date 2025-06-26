import { NextResponse } from 'next/server';
import { sendWelcomeNotification } from '@/lib/neynar';

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
      
      // Handle the event based on the decoded payload
      await handleFarcasterEvent(decodedPayload, body);
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
async function handleFarcasterEvent(payload, signedData) {
  console.log('=== HANDLING FARCASTER EVENT ===');
  console.log('Event type:', payload.event);
  
  switch (payload.event) {
    case 'frame_added':
      await handleFrameAdded(payload, signedData);
      break;
    
    case 'frame_removed':
      await handleFrameRemoved(payload, signedData);
      break;
    
    case 'notifications_enabled':
      await handleNotificationsEnabled(payload, signedData);
      break;
    
    case 'notifications_disabled':
      await handleNotificationsDisabled(payload, signedData);
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
async function handleFrameAdded(payload, signedData) {
  console.log('=== FRAME ADDED ===');
  
  // Extract user FID from the signed data header
  const headerData = JSON.parse(Buffer.from(signedData.header, 'base64url').toString());
  const userFid = headerData.fid;
  const notificationDetails = payload.notificationDetails;
  
  console.log('User FID:', userFid);
  console.log('Header data:', headerData);
  console.log('Notification details:', notificationDetails);
  
  if (!userFid) {
    console.log('No user FID found in header data');
    return;
  }

  // Check if user enabled notifications
  if (notificationDetails && notificationDetails.token) {
    console.log('🎉 User enabled notifications - sending welcome notification!');
    
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

// Handle frame_removed event
async function handleFrameRemoved(payload, signedData) {
  console.log('=== FRAME REMOVED ===');
  
  const headerData = JSON.parse(Buffer.from(signedData.header, 'base64url').toString());
  const userFid = headerData.fid;
  
  console.log('User FID:', userFid);
  
  if (userFid) {
    console.log(`User ${userFid} removed the Mini App`);
    // Could track this for analytics or cleanup
  }
}

// Handle notifications_enabled event
async function handleNotificationsEnabled(payload, signedData) {
  console.log('=== NOTIFICATIONS ENABLED ===');
  
  const headerData = JSON.parse(Buffer.from(signedData.header, 'base64url').toString());
  const userFid = headerData.fid;
  const notificationDetails = payload.notificationDetails;
  
  console.log('User FID:', userFid);
  console.log('Notification details:', notificationDetails);
  
  if (userFid && notificationDetails) {
    console.log(`User ${userFid} enabled notifications`);
    // Could send a welcome notification here too
  }
}

// Handle notifications_disabled event
async function handleNotificationsDisabled(payload, signedData) {
  console.log('=== NOTIFICATIONS DISABLED ===');
  
  const headerData = JSON.parse(Buffer.from(signedData.header, 'base64url').toString());
  const userFid = headerData.fid;
  
  console.log('User FID:', userFid);
  
  if (userFid) {
    console.log(`User ${userFid} disabled notifications`);
    // Could track this for analytics
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
    expectedEvents: ['frame_added', 'frame_removed', 'notifications_enabled', 'notifications_disabled']
  });
} 