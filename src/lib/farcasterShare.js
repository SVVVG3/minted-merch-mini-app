/**
 * Farcaster Share Utilities
 * Handles sharing to Farcaster in both mini-app and non-mini-app environments
 */

import { sdk } from '@farcaster/miniapp-sdk';

/**
 * Share content to Farcaster
 * @param {Object} options - Share options
 * @param {string} options.text - The text content to share
 * @param {string[]} [options.embeds] - Optional array of URLs to embed
 * @param {boolean} [options.isInFarcaster] - Whether user is in Farcaster mini app
 * @returns {Promise<boolean>} - True if share was successful or initiated
 */
export async function shareToFarcaster({ text, embeds = [], isInFarcaster = false }) {
  try {
    if (isInFarcaster) {
      // In mini app - use SDK
      console.log('📱 Sharing via Farcaster mini app SDK');
      const result = await sdk.actions.composeCast({
        text,
        embeds,
      });
      console.log('✅ Cast composed successfully:', result);
      return true;
    } else {
      // Not in mini app - use Warpcast deep link
      console.log('🌐 Sharing via Warpcast deep link');
      
      // Encode the text for URL
      const encodedText = encodeURIComponent(text);
      
      // Build embeds parameter (multiple embeds supported)
      const embedsParam = embeds.map((url, index) => 
        `&embeds[]=${encodeURIComponent(url)}`
      ).join('');
      
      // Use Farcaster compose URL (farcaster.xyz is the new domain)
      const farcasterUrl = `https://farcaster.xyz/~/compose?text=${encodedText}${embedsParam}`;
      
      console.log('🔗 Opening Farcaster compose:', farcasterUrl);
      
      // Detect if user is on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // On mobile: Open in a new window to prevent navigating away from app
        // This allows the system to handle the deep link properly
        const newWindow = window.open(farcasterUrl, '_blank');
        
        // Check if the window opened successfully
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          // Popup blocked - use an invisible iframe approach for deep link
          console.log('🔄 Trying iframe approach for deep link');
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = farcasterUrl;
          document.body.appendChild(iframe);
          
          // Clean up iframe after a short delay
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 100);
        }
      } else {
        // On desktop: Open web version in new tab
        console.log('💻 Desktop detected, opening web version');
        const newWindow = window.open(farcasterUrl, '_blank', 'noopener,noreferrer');
        
        // If popup was blocked, use location.href
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          console.log('🔄 Popup blocked, using location.href');
          window.location.href = farcasterUrl;
        }
      }
      
      return true;
    }
  } catch (error) {
    console.error('❌ Error sharing to Farcaster:', error);
    
    // Fallback to native share if available
    if (navigator.share) {
      try {
        await navigator.share({
          text: `${text}\n\n${embeds.join('\n')}`,
        });
        return true;
      } catch (shareError) {
        console.error('❌ Native share also failed:', shareError);
      }
    }
    
    // Last resort - copy to clipboard
    try {
      await navigator.clipboard.writeText(`${text}\n\n${embeds.join('\n')}`);
      alert('Share text copied to clipboard!');
      return true;
    } catch (clipboardError) {
      console.error('❌ Clipboard copy failed:', clipboardError);
    }
    
    return false;
  }
}

/**
 * Share leaderboard position to Farcaster
 * @param {Object} options - Share options
 * @param {number} options.position - User's leaderboard position
 * @param {number} options.totalPoints - User's total points
 * @param {string} options.category - Leaderboard category
 * @param {string} [options.username] - User's username
 * @param {number} [options.multiplier] - User's token multiplier
 * @param {string} [options.tier] - User's tier (legendary, elite, none)
 * @param {string} [options.pfp] - User's profile picture URL
 * @param {number} [options.tokenBalance] - User's token balance
 * @param {number} [options.fid] - User's FID
 * @param {boolean} [options.isInFarcaster] - Whether user is in mini app
 * @returns {Promise<boolean>}
 */
export async function shareLeaderboardPosition({ 
  position, 
  totalPoints, 
  category, 
  username = 'Anonymous',
  multiplier = 1,
  tier = 'none',
  pfp = null,
  tokenBalance = 0,
  fid = null,
  isInFarcaster = false 
}) {
  const positionText = position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`;
  
  // Build leaderboard page URL with user FID and category
  // This will trigger the generateMetadata in /leaderboard/page.js which creates the mini app embed
  const leaderboardParams = new URLSearchParams({
    user: fid.toString(),
    category: category,
    t: Date.now().toString() // Cache busting
  });
  
  const leaderboardUrl = `${window.location.origin}/leaderboard?${leaderboardParams.toString()}`;
  
  console.log('🔗 Sharing leaderboard URL:', leaderboardUrl);
  console.log('📊 Leaderboard share data:', { position, totalPoints, username, multiplier, tier, pfp, tokenBalance, fid });
  
  const shareText = `I'm currently ranked ${positionText} place on the @mintedmerch mini app leaderboard!\n\nSpin the wheel daily (for free) & shop using USDC to earn more points on /mintedmerch. The more $mintedmerch you hold, the higher your multiplier!`;
  
  return shareToFarcaster({
    text: shareText,
    embeds: [leaderboardUrl],
    isInFarcaster,
  });
}

/**
 * Share daily check-in to Farcaster
 * @param {Object} options - Share options
 * @param {Object} options.spinResult - Spin result data
 * @param {Object} options.userStatus - User status data
 * @param {boolean} [options.isInFarcaster] - Whether user is in mini app
 * @returns {Promise<boolean>}
 */
export async function shareCheckIn({ spinResult, userStatus, isInFarcaster = false }) {
  // Calculate multiplied earned points
  const multipliedEarnedPoints = spinResult.multipliedPoints || 
    (userStatus?.tokenMultiplier 
      ? spinResult.pointsEarned * userStatus.tokenMultiplier
      : spinResult.pointsEarned);

  // BUGFIX: Calculate UPDATED total points by adding today's earned points to the old total
  // userStatus.totalPoints is the total BEFORE the spin, so we need to add the new points
  const oldTotalPoints = userStatus?.totalPoints || 0;
  const multipliedTotalPoints = oldTotalPoints + multipliedEarnedPoints;

  const shareParams = new URLSearchParams({
    checkin: 'true',
    fid: userStatus?.userFid || '',
    streak: spinResult.newStreak.toString(),
    points: multipliedEarnedPoints.toString(),
    base: spinResult.basePoints.toString(),
    bonus: spinResult.streakBonus.toString(),
    multiplier: userStatus?.tokenMultiplier?.toString() || '1',
    total: multipliedTotalPoints.toString(),
  });

  const baseUrl = `${window.location.origin}/`;
  const shareUrl = `${baseUrl}?${shareParams.toString()}`;

  // Create share text
  const streakEmoji = spinResult.newStreak >= 30 ? "👑" : 
                    spinResult.newStreak >= 14 ? "🔥" : 
                    spinResult.newStreak >= 7 ? "⚡" : 
                    spinResult.newStreak >= 3 ? "🌟" : "💫";

  const shareText = `🎯 Daily check-in complete! +${multipliedEarnedPoints.toLocaleString()} points earned!\n\n(${spinResult.basePoints} base${spinResult.streakBonus > 0 ? ` + ${spinResult.streakBonus} streak bonus` : ''}${userStatus?.tokenMultiplier > 1 ? ` × ${userStatus.tokenMultiplier}x multiplier` : ''})\n\n${streakEmoji} ${spinResult.newStreak} day streak • 💎 ${multipliedTotalPoints.toLocaleString()} total points\n\nSpin the wheel daily (for free) & shop using USDC to earn more points on /mintedmerch. The more $mintedmerch you hold, the higher your multiplier!`;

  return shareToFarcaster({
    text: shareText,
    embeds: [shareUrl],
    isInFarcaster,
  });
}

/**
 * Share product to Farcaster
 * @param {Object} options - Share options
 * @param {string} options.productHandle - Product handle/slug
 * @param {string} options.productTitle - Product title
 * @param {boolean} [options.isInFarcaster] - Whether user is in mini app
 * @returns {Promise<boolean>}
 */
export async function shareProduct({ productHandle, productTitle, isInFarcaster = false }) {
  const productUrl = `${window.location.origin}/product/${productHandle}`;
  const shareText = `Check out this ${productTitle} on @mintedmerch\n\nShop using 1200+ tokens across 20+ chains\n\n$mintedmerch - Where Tokens Meet Merch`;

  return shareToFarcaster({
    text: shareText,
    embeds: [productUrl],
    isInFarcaster,
  });
}

/**
 * Share collection to Farcaster
 * @param {Object} options - Share options
 * @param {string} options.collectionHandle - Collection handle
 * @param {string} options.collectionName - Collection display name
 * @param {boolean} [options.isInFarcaster] - Whether user is in mini app
 * @returns {Promise<boolean>}
 */
export async function shareCollection({ collectionHandle, collectionName, isInFarcaster = false }) {
  const collectionUrl = `${window.location.origin}/?collection=${collectionHandle}`;
  const shareText = `Check out ${collectionName} on @mintedmerch!\n\nShop using 1200+ tokens across 20+ chains\n\n$mintedmerch - Where Tokens Meet Merch`;

  return shareToFarcaster({
    text: shareText,
    embeds: [collectionUrl],
    isInFarcaster,
  });
}

/**
 * Share order to Farcaster
 * @param {Object} options - Share options
 * @param {string} options.orderNumber - Order number
 * @param {string} options.mainProduct - Main product name from order
 * @param {boolean} [options.isInFarcaster] - Whether user is in mini app
 * @returns {Promise<boolean>}
 */
export async function shareOrder({ orderNumber, mainProduct, isInFarcaster = false }) {
  const orderUrl = `${window.location.origin}/order/${orderNumber}`;
  const shareText = `Just ordered my new ${mainProduct}!\n\nYou get 15% off your first order when you add the $mintedmerch mini app! 👀\n\nShop on @mintedmerch - pay onchain`;

  return shareToFarcaster({
    text: shareText,
    embeds: [orderUrl],
    isInFarcaster,
  });
}

