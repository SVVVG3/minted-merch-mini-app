import { NextResponse } from 'next/server';
import { sendWelcomeNotification } from '@/lib/neynar';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Log the webhook event for debugging
    console.log('=== FARCASTER WEBHOOK RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Event:', JSON.stringify(body, null, 2));

    // Handle different webhook events
    switch (body.type) {
      case 'app.added':
        await handleAppAdded(body);
        break;
      
      case 'app.removed':
        await handleAppRemoved(body);
        break;
      
      case 'notification.clicked':
        await handleNotificationClicked(body);
        break;
      
      default:
        console.log('Unknown webhook event type:', body.type);
    }

    // Return success response
    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('Webhook error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process webhook' 
      },
      { status: 500 }
    );
  }
}

// Handle Mini App addition
async function handleAppAdded(body) {
  console.log('=== MINI APP ADDED ===');
  
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

// Handle Mini App removal
async function handleAppRemoved(body) {
  console.log('=== MINI APP REMOVED ===');
  
  const userFid = body.data?.user?.fid;
  console.log('User FID:', userFid);
  
  if (userFid) {
    console.log(`User ${userFid} removed the Mini App`);
    // Could track this for analytics or cleanup
  }
}

// Handle notification clicks
async function handleNotificationClicked(body) {
  console.log('=== NOTIFICATION CLICKED ===');
  
  const userFid = body.data?.user?.fid;
  const notificationId = body.data?.notification?.id;
  
  console.log('User FID:', userFid);
  console.log('Notification ID:', notificationId);
  
  if (userFid) {
    console.log(`User ${userFid} clicked notification ${notificationId}`);
    // Could track this for analytics
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({ 
    message: 'Minted Merch Farcaster webhook endpoint',
    status: 'active',
    timestamp: new Date().toISOString()
  });
} 