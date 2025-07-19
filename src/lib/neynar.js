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
 * Now includes a unique 15% discount code for first-time users
 */
export async function sendWelcomeNotificationWithNeynar(targetFid) {
  try {
    console.log('🔔 Sending welcome notification via Neynar managed system for FID:', targetFid);

    // Generate or get existing welcome discount code for this user
    const { createWelcomeDiscountCode } = await import('./discounts');
    const discountResult = await createWelcomeDiscountCode(targetFid);
    
    let discountCode = null;
    if (discountResult.success) {
      discountCode = discountResult.code;
      console.log('✅ Discount code for welcome notification:', discountCode);
    } else {
      console.log('⚠️ Could not create discount code:', discountResult.error);
    }

    // Create notification message with or without discount code
    const notification = {
      title: "👋 Welcome to Minted Merch!",
      body: discountCode 
        ? `Get 15% off your first order with code: ${discountCode}`
        : "Discover our exclusive collection of premium merchandise. Start shopping now!",
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
 * Fetch user profiles in bulk from Neynar
 * @param {Array} fids - Array of Farcaster IDs to fetch
 * @returns {Object} Success status and user data
 */
export async function fetchBulkUserProfiles(fids) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, cannot fetch user profiles');
    return { success: false, error: 'Neynar not configured' };
  }

  if (!fids || !Array.isArray(fids) || fids.length === 0) {
    return { success: false, error: 'No FIDs provided' };
  }

  try {
    console.log('🔍 Fetching bulk user profiles for FIDs:', fids);
    
    const userResponse = await neynarClient.fetchBulkUsers({
      fids: fids.map(fid => parseInt(fid))
    });

    if (!userResponse.users || userResponse.users.length === 0) {
      console.log('No users found for provided FIDs');
      return { success: false, error: 'No users found' };
    }

    // Create a map of FID to user data for easy lookup
    const userMap = {};
    userResponse.users.forEach(user => {
      userMap[user.fid] = {
        fid: user.fid,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.pfp_url,
        bio: user.profile?.bio?.text || '',
        follower_count: user.follower_count,
        following_count: user.following_count,
        verified: user.verified || false
      };
    });

    console.log(`✅ Successfully fetched ${userResponse.users.length} user profiles`);
    return { 
      success: true, 
      users: userMap,
      count: userResponse.users.length 
    };

  } catch (error) {
    console.error('Error fetching bulk user profiles:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a user has notification tokens available via Neynar
 */
export async function checkUserNotificationStatus(targetFid) {
  try {
    console.log('🔍 Checking notification status for FID:', targetFid);

    if (!isNeynarAvailable()) {
      console.log('Neynar not available, cannot check notification status');
      return { hasNotifications: false, error: 'Neynar not configured' };
    }

    // Use the SDK to fetch notification tokens for this specific user
    const response = await neynarClient.fetchNotificationTokens({
      fids: targetFid.toString(),
      limit: 100
    });

    console.log('Neynar token check response:', JSON.stringify(response, null, 2));

    // Check if user has any active notification tokens
    const tokens = response.notification_tokens || [];
    const userTokens = tokens.filter(token => token.fid === targetFid);
    const activeTokens = userTokens.filter(token => token.status === 'enabled');

    console.log(`Found ${userTokens.length} total tokens, ${activeTokens.length} active tokens for FID ${targetFid}`);

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
        uuid: notification.uuid || generateUUID()
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
    
    // Generate or get existing welcome discount code for this user
    const { createWelcomeDiscountCode } = await import('./discounts');
    const discountResult = await createWelcomeDiscountCode(userFid);
    
    let discountCode = null;
    if (discountResult.success) {
      discountCode = discountResult.code;
      console.log('✅ Discount code for welcome notification:', discountCode);
    } else {
      console.log('⚠️ Could not create discount code:', discountResult.error);
    }
    
    // Simply send the welcome notification - Neynar will handle delivery based on user permissions
    const response = await neynarClient.publishFrameNotifications({
      targetFids: [userFid],
              notification: {
          title: "👋 Welcome to Minted Merch!",
          body: discountCode 
            ? `Get 15% off your first order with code: ${discountCode}`
            : "Discover our exclusive collection of premium merchandise. Start shopping now!",
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

  try {
    console.log('Sending order confirmation notification to user FID:', userFid);
    console.log('Order details:', orderDetails);
    
    const notification = {
      title: "📦 Minted Merch Order Confirmed!",
      body: `Your order ${orderDetails.orderId} is confirmed. We'll notify you when it ships!`,
      target_url: `https://mintedmerch.vercel.app`,
      uuid: generateUUID()
    };

    console.log('Sending notification via Neynar:', notification);

    const response = await neynarClient.publishFrameNotifications({
      targetFids: [userFid],
      notification: notification
    });

    console.log('Order confirmation notification sent successfully:', response);
    return { 
      success: true, 
      data: response,
      notificationId: notification.uuid,
      delivery: 'sent_via_neynar_managed'
    };

  } catch (error) {
    console.error('❌ Error sending order confirmation notification:', error);
    console.error('Full error details:', error.response?.data || error);
    
    // If the error indicates user has not enabled notifications, that's expected behavior
    if (error.message && (error.message.includes('notification') || error.message.includes('token'))) {
      console.log('User notifications not enabled - this is normal, Neynar will handle appropriately');
      return { 
        success: true, 
        skipped: true, 
        reason: 'User has not enabled notifications',
        delivery: 'handled_by_neynar'
      };
    }
    
    return { 
      success: false, 
      error: error.message, 
      details: error.response?.data,
      delivery: 'failed'
    };
  }
}

// Send partner assignment notification
export async function sendPartnerAssignmentNotification(partnerFid, assignmentDetails) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping partner assignment notification');
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    console.log('Sending partner assignment notification to partner FID:', partnerFid);
    console.log('Assignment details:', assignmentDetails);
    
    const notification = {
      title: "🎯 New Order Assigned to You!",
      body: `Order ${assignmentDetails.orderId} has been assigned to you. Check your partner dashboard to fulfill!`,
      target_url: `https://mintedmerch.vercel.app/partner`,
      uuid: generateUUID()
    };

    console.log('Sending partner notification via Neynar:', notification);

    const response = await neynarClient.publishFrameNotifications({
      targetFids: [partnerFid],
      notification: notification
    });

    console.log('Partner assignment notification sent successfully:', response);
    return { 
      success: true, 
      data: response,
      notificationId: notification.uuid,
      delivery: 'sent_via_neynar_managed'
    };

  } catch (error) {
    console.error('❌ Error sending partner assignment notification:', error);
    console.error('Full error details:', error.response?.data || error);
    
    // If the error indicates partner has not enabled notifications, that's expected behavior
    if (error.message && (error.message.includes('notification') || error.message.includes('token'))) {
      console.log('Partner notifications not enabled - this is normal, Neynar will handle appropriately');
      return { 
        success: true, 
        skipped: true, 
        reason: 'Partner has not enabled notifications',
        delivery: 'handled_by_neynar'
      };
    }
    
    return { 
      success: false, 
      error: error.message, 
      details: error.response?.data,
      delivery: 'failed'
    };
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
    const tokenCheck = await checkUserNotificationStatus(userFid);
    if (!tokenCheck.hasNotifications) {
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
    
    const notification = {
      title: "🚚 Your Order Has Shipped!",
      body: `Order ${shippingDetails.orderId} is on its way!${shippingDetails.trackingNumber ? ` Track: ${shippingDetails.trackingNumber}` : ''}`,
      target_url: shippingDetails.trackingUrl || `https://mintedmerch.vercel.app`,
      uuid: generateUUID()
    };

    const requestBody = {
      target_fids: [userFid],
      notification: notification
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
    console.log('Shipping notification response:', responseData);

    if (!response.ok) {
      console.error('Shipping notification failed:', response.status, responseData);
      return {
        success: false,
        error: `Neynar API error: ${response.status}`,
        details: responseData
      };
    }

    const deliveries = responseData.notification_deliveries || [];
    const userDelivery = deliveries.find(d => d.fid === userFid);

    return {
      success: userDelivery?.status === 'success',
      delivery: userDelivery,
      notificationId: notification.uuid
    };

  } catch (error) {
    console.error('Error sending shipping notification:', error);
    return { success: false, error: error.message };
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

/**
 * Send notification with Neynar API (for daily check-in reminders)
 * @param {number} userFid - User's Farcaster ID
 * @param {Object} message - Message object with title, body, targetUrl
 * @returns {Object} Result of notification send
 */
export async function sendNotificationWithNeynar(userFid, message) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, skipping notification');
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    console.log('🔔 Sending notification via Neynar for FID:', userFid);
    console.log('Message:', message);

    const notification = {
      title: message.title,
      body: message.body,
      target_url: message.targetUrl,
      uuid: generateUUID()
    };

    const response = await neynarClient.publishFrameNotifications({
      targetFids: [userFid],
      notification: notification
    });

    console.log('✅ Notification sent successfully via Neynar:', response);
    return {
      success: true,
      userFid: userFid,
      notificationId: notification.uuid,
      data: response
    };

  } catch (error) {
    console.error('❌ Error sending notification via Neynar:', error);
    console.error('Full error details:', error.response?.data || error);
    
    // If the error indicates user has not enabled notifications, that's expected behavior
    if (error.message && (error.message.includes('notification') || error.message.includes('token'))) {
      console.log('User notifications not enabled - this is normal behavior');
      return { 
        success: true, 
        skipped: true, 
        reason: 'User has not enabled notifications',
        userFid: userFid
      };
    }
    
    return {
      success: false,
      error: error.message,
      userFid: userFid,
      details: error.response?.data
    };
  }
} 