import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';

// Initialize Neynar client
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_CLIENT_ID = process.env.NEYNAR_CLIENT_ID || '11f2fe11-b70c-40fa-b653-9770b7588bdf';

if (!NEYNAR_API_KEY) {
  console.warn('NEYNAR_API_KEY not found in environment variables. Neynar features will be disabled.');
}

// Create Neynar client instance with proper Configuration object
export const neynarClient = NEYNAR_API_KEY 
  ? new NeynarAPIClient(new Configuration({ apiKey: NEYNAR_API_KEY }))
  : null;

// Helper function to check if Neynar is available
export function isNeynarAvailable() {
  return neynarClient !== null;
}

// Send notification to specific user
export async function sendNotification({ targetFid, title, body, targetUrl }) {
  if (!isNeynarAvailable()) {
    console.warn('Neynar client not available - notification not sent');
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    console.log('Sending notification:', { targetFid, title, body, targetUrl });
    
    const result = await neynarClient.publishFrameNotifications({
      target_fids: [targetFid],
      notification: {
        title,
        body,
        target_url: targetUrl
      }
    });
    
    console.log('Notification sent successfully:', result);
    return { success: true, result };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
}

// Send welcome notification
export async function sendWelcomeNotification(userFid) {
  return await sendNotification({
    targetFid: userFid,
    title: "🎉 Welcome to Minted Merch!",
    body: "Thanks for adding our shop! Browse crypto merch and pay with USDC on Base 🔵",
    targetUrl: process.env.NEXT_PUBLIC_APP_URL || "https://mintedmerch.vercel.app"
  });
}

// Send order confirmation notification
export async function sendOrderConfirmationNotification(userFid, orderNumber, totalAmount) {
  return await sendNotification({
    targetFid: userFid,
    title: `✅ Order ${orderNumber} Confirmed!`,
    body: `Your order for ${totalAmount} USDC is confirmed. Thanks for shopping with crypto! 🚀`,
    targetUrl: process.env.NEXT_PUBLIC_APP_URL || "https://mintedmerch.vercel.app"
  });
}

// Send shipping notification
export async function sendShippingNotification(userFid, orderNumber, trackingNumber, trackingCompany = 'Carrier') {
  const trackingText = trackingNumber 
    ? `Tracking: ${trackingNumber} via ${trackingCompany}` 
    : 'Your order is on the way!';
    
  return await sendNotification({
    targetFid: userFid,
    title: `📦 Order ${orderNumber} Shipped!`,
    body: `${trackingText} Check your order status anytime! 🚚`,
    targetUrl: process.env.NEXT_PUBLIC_APP_URL || "https://mintedmerch.vercel.app"
  });
}

// Get notification tokens for testing/debugging
export async function getNotificationTokens() {
  if (!isNeynarAvailable()) {
    return { success: false, error: 'Neynar not configured' };
  }

  try {
    // Test basic API connectivity with a simple method
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