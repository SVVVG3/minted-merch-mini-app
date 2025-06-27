// Simplified notification system using direct HTTP calls to Neynar API
// This avoids the React 19 compatibility issues with @neynar/nodejs-sdk

import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';

// Initialize Neynar client
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE_URL = 'https://api.neynar.com';
const NEYNAR_CLIENT_ID = process.env.NEYNAR_CLIENT_ID || '11f2fe11-b70c-40fa-b653-9770b7588bdf';

if (!NEYNAR_API_KEY) {
  console.warn('⚠️ NEYNAR_API_KEY not found in environment variables');
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

// Fetch notification tokens for specific users from Neynar
export async function fetchNotificationTokensFromNeynar(userFids = []) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, cannot fetch notification tokens');
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    console.log('Fetching notification tokens from Neynar for FIDs:', userFids);
    
    // Use Neynar's API to get notification tokens
    const response = await neynarClient.fetchNotificationTokens({
      fids: userFids.length > 0 ? userFids.join(',') : undefined,
      limit: 100
    });

    console.log('Notification tokens fetched from Neynar:', response);
    return { 
      success: true, 
      tokens: response.notification_tokens || [],
      hasNext: !!response.next?.cursor
    };
  } catch (error) {
    console.error('Error fetching notification tokens from Neynar:', error);
    return { success: false, error: error.message };
  }
}

// Check if user has notification token via Neynar API
export async function hasNotificationTokenInNeynar(targetFid) {
  const status = await checkUserNotificationStatus(targetFid);
  return status.hasNotifications;
}

/**
 * Generate a proper UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Send a welcome notification using Neynar's managed notification system
 * This uses Neynar's API to send notifications to users who have enabled notifications for our Mini App
 */
export async function sendWelcomeNotificationWithNeynar(targetFid) {
  try {
    console.log('🔔 Sending welcome notification via Neynar managed system for FID:', targetFid);

    const notification = {
      title: "👋 Welcome to Minted Merch!",
      body: "Discover our exclusive collection of premium merchandise. Start shopping now!",
      target_url: "https://mintedmerch.vercel.app",
      uuid: generateUUID()
    };

    const requestBody = {
      target_fids: [targetFid], // Send to specific user
      notification: notification
    };

    console.log('Sending notification request to Neynar:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${NEYNAR_BASE_URL}/v2/farcaster/frame/notifications/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NEYNAR_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();
    console.log('Neynar notification response:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error('❌ Neynar notification failed:', response.status, responseData);
      return {
        success: false,
        error: `Neynar API error: ${response.status}`,
        details: responseData
      };
    }

    // Check if notification was delivered successfully
    const deliveries = responseData.notification_deliveries || [];
    const userDelivery = deliveries.find(d => d.fid === targetFid);

    if (userDelivery && userDelivery.status === 'success') {
      console.log('✅ Welcome notification sent successfully via Neynar');
      return {
        success: true,
        delivery: userDelivery,
        notificationId: notification.uuid
      };
    } else {
      console.log('⚠️ Notification not delivered:', userDelivery);
      return {
        success: false,
        error: 'Notification not delivered',
        delivery: userDelivery
      };
    }

  } catch (error) {
    console.error('❌ Error sending welcome notification via Neynar:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if a user has notification tokens available via Neynar
 */
export async function checkUserNotificationStatus(targetFid) {
  try {
    console.log('🔍 Checking notification status for FID:', targetFid);

    const response = await fetch(`${NEYNAR_BASE_URL}/v2/farcaster/frame/notification_tokens/?fids=${targetFid}`, {
      method: 'GET',
      headers: {
        'x-api-key': NEYNAR_API_KEY
      }
    });

    const responseData = await response.json();
    console.log('Neynar token check response:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error('❌ Failed to check notification status:', response.status, responseData);
      return {
        hasNotifications: false,
        error: `API error: ${response.status}`
      };
    }

    // Check if user has any active notification tokens
    const tokens = responseData.notification_tokens || [];
    const userTokens = tokens.filter(token => token.fid === targetFid);
    const activeTokens = userTokens.filter(token => token.status === 'enabled');

    console.log(`Found ${userTokens.length} total tokens, ${activeTokens.length} active tokens`);

    return {
      hasNotifications: activeTokens.length > 0,
      tokenCount: activeTokens.length,
      totalTokens: userTokens.length,
      tokens: activeTokens,
      allTokens: userTokens
    };

  } catch (error) {
    console.error('❌ Error checking notification status:', error);
    return {
      hasNotifications: false,
      error: error.message
    };
  }
}

/**
 * Send a notification to multiple users using Neynar's managed system
 */
export async function sendNotificationToUsers(targetFids, notification) {
  try {
    console.log('🔔 Sending notification to multiple users via Neynar:', targetFids);

    const requestBody = {
      target_fids: targetFids,
      notification: {
        ...notification,
        uuid: notification.uuid || `notification-${Date.now()}`
      }
    };

    const response = await fetch(`${NEYNAR_BASE_URL}/v2/farcaster/frame/notifications/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NEYNAR_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: `Neynar API error: ${response.status}`,
        details: responseData
      };
    }

    return {
      success: true,
      deliveries: responseData.notification_deliveries || []
    };

  } catch (error) {
    console.error('❌ Error sending notifications via Neynar:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Legacy functions - keeping for backward compatibility but they now use Neynar
export async function sendWelcomeNotification(targetFid) {
  return await sendWelcomeNotificationWithNeynar(targetFid);
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

// Send notification to all users with active tokens (using Neynar's managed tokens)
export async function sendNotificationToAllUsers(notificationData) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping bulk notification');
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    console.log('Getting users with active notification tokens from Neynar...');
    
    const tokensResult = await fetchNotificationTokensFromNeynar();
    if (!tokensResult.success) {
      console.error('Failed to get notification tokens from Neynar:', tokensResult.error);
      return { success: false, error: tokensResult.error };
    }

    const activeTokens = tokensResult.tokens.filter(token => token.status === 'enabled');
    if (activeTokens.length === 0) {
      console.log('No users with active notification tokens found in Neynar');
      return { success: true, sent: 0, message: 'No users to notify' };
    }

    console.log(`Sending notification to ${activeTokens.length} users...`);
    
    const targetFids = activeTokens.map(token => token.fid);
    
    const response = await neynarClient.publishFrameNotifications({
      targetFids: targetFids,
      notification: {
        title: notificationData.title,
        body: notificationData.body,
        target_url: notificationData.target_url || "https://mintedmerch.vercel.app"
      }
    });

    console.log('Bulk notification sent successfully:', response);
    return { 
      success: true, 
      data: response, 
      sent: targetFids.length,
      targetFids: targetFids
    };
  } catch (error) {
    console.error('Error sending bulk notification:', error);
    return { success: false, error: error.message, details: error.response?.data };
  }
}

// Send order confirmation notification
export async function sendOrderConfirmationNotification(userFid, orderDetails) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping order confirmation notification');
    return { success: false, error: 'Neynar not configured' };
  }

  // Check if user has active notification token via Neynar API
  try {
    const tokenCheck = await hasNotificationTokenInNeynar(userFid);
    if (!tokenCheck.success || !tokenCheck.hasToken) {
      console.log('User does not have active notification token, skipping order confirmation');
      return { 
        success: false, 
        error: 'User has not enabled notifications',
        status: 'token_not_found'
      };
    }
  } catch (error) {
    console.error('Error checking notification token:', error);
    return { success: false, error: 'Failed to check notification permissions' };
  }

  try {
    console.log('Sending order confirmation notification to user FID:', userFid);
    
    const response = await neynarClient.publishFrameNotifications({
      targetFids: [userFid],
      notification: {
        title: "📦 Order Confirmed!",
        body: `Your order #${orderDetails.orderNumber} has been confirmed. Total: $${orderDetails.total}`,
        target_url: `https://mintedmerch.vercel.app/order/${orderDetails.orderNumber}`
      }
    });

    console.log('Order confirmation notification sent successfully:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('Error sending order confirmation notification:', error);
    return { success: false, error: error.message, details: error.response?.data };
  }
}

// Send shipping notification
export async function sendShippingNotification(userFid, shippingDetails) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping shipping notification');
    return { success: false, error: 'Neynar not configured' };
  }

  // Check if user has active notification token via Neynar API
  try {
    const tokenCheck = await hasNotificationTokenInNeynar(userFid);
    if (!tokenCheck.success || !tokenCheck.hasToken) {
      console.log('User does not have active notification token, skipping shipping notification');
      return { 
        success: false, 
        error: 'User has not enabled notifications',
        status: 'token_not_found'
      };
    }
  } catch (error) {
    console.error('Error checking notification token:', error);
    return { success: false, error: 'Failed to check notification permissions' };
  }

  try {
    console.log('Sending shipping notification to user FID:', userFid);
    
    const response = await neynarClient.publishFrameNotifications({
      targetFids: [userFid],
      notification: {
        title: "🚚 Your Order Has Shipped!",
        body: `Order #${shippingDetails.orderNumber} is on its way! Track: ${shippingDetails.trackingNumber}`,
        target_url: `https://mintedmerch.vercel.app/track/${shippingDetails.trackingNumber}`
      }
    });

    console.log('Shipping notification sent successfully:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('Error sending shipping notification:', error);
    return { success: false, error: error.message, details: error.response?.data };
  }
}

// Get notification status for a user (using Neynar's managed tokens)
export async function getNotificationStatus(userFid) {
  if (!isNeynarAvailable()) {
    return { 
      success: false, 
      error: 'Neynar not configured',
      enabled: false,
      hasToken: false
    };
  }

  try {
    const tokenCheck = await hasNotificationTokenInNeynar(userFid);
    
    return {
      success: true,
      enabled: tokenCheck.hasToken,
      hasToken: tokenCheck.hasToken,
      token: tokenCheck.token,
      source: 'neynar_managed'
    };
  } catch (error) {
    console.error('Error getting notification status:', error);
    return { 
      success: false, 
      error: error.message,
      enabled: false,
      hasToken: false
    };
  }
}

// Test notification function
export async function sendTestNotification(userFid, message = "Test notification from Minted Merch!") {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping test notification');
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    console.log('Sending test notification to user FID:', userFid);
    
    const response = await neynarClient.publishFrameNotifications({
      targetFids: [userFid],
      notification: {
        title: "🧪 Test Notification",
        body: message,
        target_url: "https://mintedmerch.vercel.app"
      }
    });

    console.log('Test notification sent successfully:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('Error sending test notification:', error);
    return { success: false, error: error.message, details: error.response?.data };
  }
} 