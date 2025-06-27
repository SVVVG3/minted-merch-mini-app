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
export async function hasNotificationTokenInNeynar(userFid) {
  const result = await fetchNotificationTokensFromNeynar([userFid]);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const userToken = result.tokens.find(token => token.fid === userFid && token.status === 'enabled');
  
  return {
    success: true,
    hasToken: !!userToken,
    token: userToken || null
  };
}

// Send welcome notification when user adds the Mini App
export async function sendWelcomeNotification(userFid) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping welcome notification');
    return { success: false, error: 'Neynar not configured' };
  }

  // Check if user has active notification token via Neynar API
  try {
    const tokenCheck = await hasNotificationTokenInNeynar(userFid);
    if (!tokenCheck.success) {
      console.log('Failed to check notification token:', tokenCheck.error);
      // Continue anyway, let Neynar handle the token validation
    } else if (!tokenCheck.hasToken) {
      console.log('User does not have active notification token in Neynar');
      return { 
        success: false, 
        error: 'User has not enabled notifications',
        status: 'token_not_found'
      };
    } else {
      console.log('User has active notification token in Neynar:', tokenCheck.token);
    }
  } catch (error) {
    console.error('Error checking notification token:', error);
    // Continue anyway
  }

  try {
    console.log('Sending welcome notification to user FID:', userFid);
    
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
    
    // Parse the error to provide better feedback
    const errorMessage = error.response?.data?.message || error.message;
    
    if (errorMessage && errorMessage.toLowerCase().includes('token')) {
      return { 
        success: false, 
        error: 'User has not enabled notifications',
        status: 'token_disabled',
        details: error.response?.data 
      };
    }
    
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