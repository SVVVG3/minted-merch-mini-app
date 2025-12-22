/**
 * Client-aware URL handling for mini apps
 * 
 * Detects whether the user is in Farcaster (Warpcast) or Base app
 * and uses the appropriate SDK actions to navigate.
 * 
 * Key patterns from Base docs:
 * - View casts: Use sdk.actions.viewCast(castUrl)
 * - Compose casts: Use sdk.actions.composeCast({ text, embeds })
 * - Open external URLs: Use sdk.actions.openUrl(url)
 * - Open mini apps in Base: Use cbwallet://miniapp?url=${MINI_APP_URL}
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
 * Open an external URL using the SDK
 * Works for both Farcaster and Base app
 * @param {string} url - The URL to open
 */
export async function openUrl(url) {
  try {
    if (sdk?.actions?.openUrl) {
      await sdk.actions.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  } catch (error) {
    console.error('Error opening URL:', error);
    window.open(url, '_blank');
  }
}

/**
 * View a Farcaster cast
 * Uses sdk.actions.viewCast() which works for both Farcaster and Base app
 * @param {string} castUrl - The cast URL
 */
export async function viewCast(castUrl) {
  try {
    if (sdk?.actions?.viewCast) {
      await sdk.actions.viewCast(castUrl);
    } else if (sdk?.actions?.openUrl) {
      // Fallback to openUrl
      await sdk.actions.openUrl(castUrl);
    } else {
      window.open(castUrl, '_blank');
    }
  } catch (error) {
    console.error('Error viewing cast:', error);
    window.open(castUrl, '_blank');
  }
}

/**
 * Open the cast composer
 * Uses sdk.actions.composeCast() which works for both Farcaster and Base app
 * @param {string} text - The cast text
 * @param {string[]} embeds - Array of embed URLs
 */
export async function composeCast(text, embeds = []) {
  try {
    if (sdk?.actions?.composeCast) {
      await sdk.actions.composeCast({ text, embeds });
    } else {
      // Fallback to warpcast compose URL
      let composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
      embeds.forEach(embed => {
        composeUrl += `&embeds[]=${encodeURIComponent(embed)}`;
      });
      window.open(composeUrl, '_blank');
    }
  } catch (error) {
    console.error('Error composing cast:', error);
    // Fallback to warpcast compose URL
    let composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
    embeds.forEach(embed => {
      composeUrl += `&embeds[]=${encodeURIComponent(embed)}`;
    });
    window.open(composeUrl, '_blank');
  }
}

/**
 * Open a mini app URL
 * For Farcaster: uses farcaster.xyz deep links or openMiniApp
 * For Base: uses cbwallet://miniapp?url= deeplink
 * @param {string} miniAppUrl - The direct mini app URL
 * @param {string} farcasterDeepLink - Optional farcaster.xyz deep link for Farcaster mobile
 */
export async function openMiniApp(miniAppUrl, farcasterDeepLink = null) {
  try {
    const context = await sdk.context;
    const platformType = context?.client?.platformType;
    const { isBaseApp, isFarcaster } = await getClientInfo();
    
    console.log(`🔗 Opening mini app (platformType: ${platformType}, isBaseApp: ${isBaseApp})`);
    
    if (isBaseApp) {
      // Base app - use cbwallet deeplink to open as mini app within Base
      const baseDeeplink = `cbwallet://miniapp?url=${encodeURIComponent(miniAppUrl)}`;
      if (sdk?.actions?.openUrl) {
        await sdk.actions.openUrl(baseDeeplink);
      } else {
        window.open(miniAppUrl, '_blank');
      }
    } else if (isFarcaster && platformType === 'mobile' && farcasterDeepLink && sdk?.actions?.openUrl) {
      // Mobile Farcaster app - use farcaster.xyz deep link
      await sdk.actions.openUrl(farcasterDeepLink);
    } else if (sdk?.actions?.openMiniApp) {
      // Desktop/web Farcaster - use openMiniApp
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

/**
 * Open a Farcaster profile
 * @param {string} username - The username (without @)
 */
export async function openProfile(username) {
  const profileUrl = `https://warpcast.com/${username}`;
  await openUrl(profileUrl);
}

/**
 * Open a Farcaster channel
 * @param {string} channelId - The channel ID (without /)
 */
export async function openChannel(channelId) {
  const channelUrl = `https://warpcast.com/~/channel/${channelId}`;
  await openUrl(channelUrl);
}
