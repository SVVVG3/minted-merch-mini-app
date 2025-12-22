/**
 * Client-aware URL handling for mini apps
 * 
 * Detects whether the user is in Farcaster (Warpcast) or Base app
 * and opens URLs appropriately to stay within the same client.
 */

import { sdk } from '@farcaster/miniapp-sdk';

// Known client FIDs
const FARCASTER_CLIENT_FID = 9152; // Warpcast/Farcaster

/**
 * Get the current client information
 * @returns {Promise<{clientFid: number, isBaseApp: boolean, isFarcaster: boolean, platformType: string}>}
 */
export async function getClientInfo() {
  try {
    const context = await sdk.context;
    const clientFid = context?.client?.clientFid;
    const platformType = context?.client?.platformType || 'unknown';
    
    return {
      clientFid,
      isBaseApp: clientFid && clientFid !== FARCASTER_CLIENT_FID,
      isFarcaster: clientFid === FARCASTER_CLIENT_FID,
      platformType
    };
  } catch (error) {
    console.error('Error getting client info:', error);
    return {
      clientFid: null,
      isBaseApp: false,
      isFarcaster: false,
      platformType: 'unknown'
    };
  }
}

/**
 * Open a URL in the appropriate way based on the current client
 * @param {string} url - The URL to open
 * @param {Object} options - Optional configuration
 * @param {string} options.farcasterUrl - Alternative URL for Farcaster (e.g., warpcast.com deep link)
 * @param {string} options.baseUrl - Alternative URL for Base app
 */
export async function openClientAwareUrl(url, options = {}) {
  try {
    const { isBaseApp, isFarcaster, platformType } = await getClientInfo();
    
    let targetUrl = url;
    
    // Use client-specific URL if provided
    if (isFarcaster && options.farcasterUrl) {
      targetUrl = options.farcasterUrl;
    } else if (isBaseApp && options.baseUrl) {
      targetUrl = options.baseUrl;
    }
    
    console.log(`🔗 Opening URL (isBaseApp: ${isBaseApp}, isFarcaster: ${isFarcaster}):`, targetUrl);
    
    // Try to use SDK openUrl
    if (sdk?.actions?.openUrl) {
      await sdk.actions.openUrl(targetUrl);
    } else {
      // Fallback to window.open
      window.open(targetUrl, '_blank');
    }
  } catch (error) {
    console.error('Error opening URL:', error);
    // Fallback to window.open
    window.open(url, '_blank');
  }
}

/**
 * Open a Farcaster cast URL
 * For Farcaster: uses warpcast.com URL
 * For Base: uses the standard cast URL (farcaster.xyz or direct)
 * @param {string} castUrl - The cast URL (can be warpcast.com or any cast URL)
 */
export async function openCastUrl(castUrl) {
  const { isBaseApp } = await getClientInfo();
  
  // Extract cast hash if it's a warpcast URL
  let normalizedUrl = castUrl;
  
  if (isBaseApp && castUrl.includes('warpcast.com')) {
    // For Base app, convert warpcast URLs to farcaster.xyz format if needed
    // warpcast.com/username/0x123... -> keep as is, Base should handle it
    // The key is that we don't want Base to try to open Warpcast app
    console.log('🔗 Opening cast in Base app:', castUrl);
  }
  
  await openClientAwareUrl(normalizedUrl);
}

/**
 * Open a Farcaster profile URL
 * @param {string} username - The username (without @)
 */
export async function openProfileUrl(username) {
  const { isBaseApp, isFarcaster } = await getClientInfo();
  
  // Standard profile URL
  const warpcastUrl = `https://warpcast.com/${username}`;
  
  // For Base, they should handle warpcast URLs, but let's log for debugging
  console.log(`🔗 Opening profile (isBaseApp: ${isBaseApp}): @${username}`);
  
  await openClientAwareUrl(warpcastUrl);
}

/**
 * Open a Farcaster channel URL
 * @param {string} channelId - The channel ID (without /)
 */
export async function openChannelUrl(channelId) {
  const warpcastUrl = `https://warpcast.com/~/channel/${channelId}`;
  
  await openClientAwareUrl(warpcastUrl);
}

/**
 * Open a compose cast URL
 * @param {string} text - The cast text
 * @param {string[]} embeds - Array of embed URLs
 */
export async function openComposeUrl(text, embeds = []) {
  const { isBaseApp, isFarcaster } = await getClientInfo();
  
  // Build the compose URL
  let composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
  
  embeds.forEach(embed => {
    composeUrl += `&embeds[]=${encodeURIComponent(embed)}`;
  });
  
  console.log(`🔗 Opening compose (isBaseApp: ${isBaseApp}, isFarcaster: ${isFarcaster})`);
  
  await openClientAwareUrl(composeUrl);
}

/**
 * Open a mini app URL
 * For mobile: uses openUrl with the mini app URL
 * For desktop/web: uses openMiniApp
 * @param {string} miniAppUrl - The direct mini app URL
 * @param {string} deepLinkUrl - Optional deep link URL for mobile
 */
export async function openMiniAppUrl(miniAppUrl, deepLinkUrl = null) {
  try {
    const context = await sdk.context;
    const platformType = context?.client?.platformType;
    const { isBaseApp } = await getClientInfo();
    
    console.log(`🔗 Opening mini app (platformType: ${platformType}, isBaseApp: ${isBaseApp})`);
    
    if (platformType === 'mobile' && sdk?.actions?.openUrl) {
      // Mobile - use openUrl with deep link if available
      const url = deepLinkUrl || miniAppUrl;
      await sdk.actions.openUrl(url);
    } else if (sdk?.actions?.openMiniApp) {
      // Desktop/web - use openMiniApp
      await sdk.actions.openMiniApp({ url: miniAppUrl });
    } else {
      // Fallback
      window.open(miniAppUrl, '_blank');
    }
  } catch (error) {
    console.error('Error opening mini app:', error);
    window.open(miniAppUrl, '_blank');
  }
}

