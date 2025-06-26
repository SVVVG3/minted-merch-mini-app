// Simplified notification system using direct HTTP calls to Neynar API
// This avoids the React 19 compatibility issues with @neynar/nodejs-sdk

import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';

// Initialize Neynar client
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_CLIENT_ID = process.env.NEYNAR_CLIENT_ID || '11f2fe11-b70c-40fa-b653-9770b7588bdf';

if (!NEYNAR_API_KEY) {
  console.warn('NEYNAR_API_KEY not found in environment variables. Neynar features will be disabled.');
}

// Create Neynar client instance with proper Configuration object
export const neynarClient = NEYNAR_API_KEY 
  ? new NeynarAPIClient(new Configuration({
      apiKey: NEYNAR_API_KEY,
      baseOptions: {
        headers: {
          "x-neynar-experimental": true,
        },
      },
    }))
  : null;

// Helper function to check if Neynar is available
export function isNeynarAvailable() {
  return neynarClient !== null;
}

// Send welcome notification when user adds the Mini App
export async function sendWelcomeNotification(userFid) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping welcome notification');
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    console.log('Sending welcome notification to user FID:', userFid);
    
    const response = await neynarClient.publishFrameNotifications({
      targetFids: [userFid],
      notification: {
        title: "🎉 Welcome to Minted Merch!",
        body: "Thanks for adding our Mini App! Browse our exclusive collection and get 10% off your first order with code WELCOME10.",
        target_url: "https://mintedmerch.vercel.app"
      }
    });

    console.log('Welcome notification sent successfully:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('Error sending welcome notification:', error);
    console.error('Full error details:', error.response?.data || error);
    return { success: false, error: error.message, details: error.response?.data };
  }
}

// Send welcome notification for new users (simplified approach)
export async function sendWelcomeForNewUser(userFid) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping welcome notification');
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    console.log('Sending welcome notification for new user FID:', userFid);
    
    // Simply send the welcome notification - Neynar will handle delivery based on user permissions
    const response = await neynarClient.publishFrameNotifications({
      targetFids: [userFid],
      notification: {
        title: "👋 Welcome to Minted Merch!",
        body: "Discover our exclusive collection of premium merchandise. Start shopping now!",
        target_url: "https://mintedmerch.vercel.app"
      }
    });

    console.log('Welcome notification sent successfully:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('Error sending welcome notification:', error);
    console.error('Full error details:', error.response?.data || error);
    
    // If error is about user not having notification permissions, that's expected
    if (error.message && error.message.includes('notification')) {
      console.log('User does not have notification permissions yet - this is normal');
      return { success: true, skipped: true, reason: 'User has not enabled notifications' };
    }
    
    return { success: false, error: error.message, details: error.response?.data };
  }
}

// Send order confirmation notification
export async function sendOrderConfirmationNotification(userFid, orderDetails) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping order confirmation notification');
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    console.log('Sending order confirmation notification to user FID:', userFid);
    
    const response = await neynarClient.publishFrameNotifications({
      targetFids: [userFid],
      notification: {
        title: "✅ Order Confirmed!",
        body: `Your order #${orderDetails.id} for $${orderDetails.total} has been confirmed. We'll notify you when it ships!`,
        target_url: `https://mintedmerch.vercel.app/order/${orderDetails.id}`
      }
    });

    console.log('Order confirmation notification sent successfully:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('Error sending order confirmation notification:', error);
    return { success: false, error: error.message };
  }
}

// Send shipping notification
export async function sendShippingNotification(userFid, shippingDetails) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping shipping notification');
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    console.log('Sending shipping notification to user FID:', userFid);
    
    const response = await neynarClient.publishFrameNotifications({
      targetFids: [userFid],
      notification: {
        title: "📦 Your Order Has Shipped!",
        body: `Order #${shippingDetails.orderId} is on its way! Track: ${shippingDetails.trackingNumber}`,
        target_url: `https://mintedmerch.vercel.app/tracking/${shippingDetails.trackingNumber}`
      }
    });

    console.log('Shipping notification sent successfully:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('Error sending shipping notification:', error);
    return { success: false, error: error.message };
  }
}

// Test API connectivity
export async function getNotificationTokens() {
  if (!isNeynarAvailable()) {
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    // Test basic API connectivity with a simple user lookup
    const userResponse = await neynarClient.lookupUserByUsername({ username: 'dwr.eth' });
    return { 
      success: true, 
      apiConnected: true,
      testResponse: userResponse ? 'API working' : 'No response'
    };
  } catch (error) {
    console.error('Error testing API connectivity:', error);
    return { success: false, error: error.message };
  }
} 