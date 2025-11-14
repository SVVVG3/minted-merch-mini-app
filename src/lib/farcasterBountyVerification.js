// Farcaster Bounty Verification System
// Auto-verifies engagement bounties (likes, recasts, comments) via Neynar API

import { NeynarAPIClient } from '@neynar/nodejs-sdk';

// Initialize Neynar client
const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY);

/**
 * Check if Neynar is available
 * @returns {boolean}
 */
function isNeynarAvailable() {
  return !!(process.env.NEXT_PUBLIC_NEYNAR_API_KEY);
}

/**
 * Verify if an ambassador liked a specific cast
 * @param {number} ambassadorFid - Ambassador's Farcaster ID
 * @param {string} castHash - Target cast hash (0x...)
 * @param {number} castAuthorFid - Target cast author's FID
 * @returns {Promise<{verified: boolean, error?: string, details?: object}>}
 */
export async function verifyLikeBounty(ambassadorFid, castHash, castAuthorFid) {
  try {
    console.log(`🔍 Verifying LIKE bounty for FID ${ambassadorFid} on cast ${castHash}`);

    if (!isNeynarAvailable()) {
      return {
        verified: false,
        error: 'Neynar API not configured'
      };
    }

    // Fetch all likes on the target cast
    const response = await neynarClient.fetchReactionsForCast(
      castHash,
      'likes',
      { viewerFid: ambassadorFid, limit: 100 }
    );

    console.log(`📊 Found ${response.reactions?.length || 0} likes on cast`);

    // Check if ambassador's FID is in the list of likers
    const hasLiked = response.reactions?.some(reaction => 
      reaction.user?.fid === ambassadorFid && reaction.reaction_type === 1 // 1 = like
    );

    if (hasLiked) {
      console.log(`✅ FID ${ambassadorFid} has liked cast ${castHash}`);
      return {
        verified: true,
        details: {
          ambassadorFid,
          castHash,
          castAuthorFid,
          verifiedAt: new Date().toISOString()
        }
      };
    } else {
      console.log(`❌ FID ${ambassadorFid} has NOT liked cast ${castHash}`);
      return {
        verified: false,
        error: 'Like not found. Please like the cast and try again.',
        details: {
          ambassadorFid,
          castHash,
          totalLikes: response.reactions?.length || 0
        }
      };
    }

  } catch (error) {
    console.error('❌ Error verifying like bounty:', error);
    return {
      verified: false,
      error: `Verification failed: ${error.message}`
    };
  }
}

/**
 * Verify if an ambassador recasted a specific cast
 * @param {number} ambassadorFid - Ambassador's Farcaster ID
 * @param {string} castHash - Target cast hash (0x...)
 * @param {number} castAuthorFid - Target cast author's FID
 * @returns {Promise<{verified: boolean, error?: string, details?: object}>}
 */
export async function verifyRecastBounty(ambassadorFid, castHash, castAuthorFid) {
  try {
    console.log(`🔍 Verifying RECAST bounty for FID ${ambassadorFid} on cast ${castHash}`);

    if (!isNeynarAvailable()) {
      return {
        verified: false,
        error: 'Neynar API not configured'
      };
    }

    // Fetch all recasts of the target cast
    const response = await neynarClient.fetchReactionsForCast(
      castHash,
      'recasts',
      { viewerFid: ambassadorFid, limit: 100 }
    );

    console.log(`📊 Found ${response.reactions?.length || 0} recasts of cast`);

    // Check if ambassador's FID is in the list of recasters
    const hasRecasted = response.reactions?.some(reaction => 
      reaction.user?.fid === ambassadorFid && reaction.reaction_type === 2 // 2 = recast
    );

    if (hasRecasted) {
      console.log(`✅ FID ${ambassadorFid} has recasted cast ${castHash}`);
      return {
        verified: true,
        details: {
          ambassadorFid,
          castHash,
          castAuthorFid,
          verifiedAt: new Date().toISOString()
        }
      };
    } else {
      console.log(`❌ FID ${ambassadorFid} has NOT recasted cast ${castHash}`);
      return {
        verified: false,
        error: 'Recast not found. Please recast the post and try again.',
        details: {
          ambassadorFid,
          castHash,
          totalRecasts: response.reactions?.length || 0
        }
      };
    }

  } catch (error) {
    console.error('❌ Error verifying recast bounty:', error);
    return {
      verified: false,
      error: `Verification failed: ${error.message}`
    };
  }
}

/**
 * Verify if an ambassador commented on a specific cast
 * @param {number} ambassadorFid - Ambassador's Farcaster ID
 * @param {string} castHash - Target cast hash (0x...)
 * @param {number} castAuthorFid - Target cast author's FID
 * @returns {Promise<{verified: boolean, error?: string, details?: object}>}
 */
export async function verifyCommentBounty(ambassadorFid, castHash, castAuthorFid) {
  try {
    console.log(`🔍 Verifying COMMENT bounty for FID ${ambassadorFid} on cast ${castHash}`);

    if (!isNeynarAvailable()) {
      return {
        verified: false,
        error: 'Neynar API not configured'
      };
    }

    // Fetch all replies to the target cast
    const response = await neynarClient.fetchRepliesForCast(
      castHash,
      castAuthorFid,
      { limit: 100 }
    );

    console.log(`📊 Found ${response.casts?.length || 0} replies to cast`);

    // Check if any reply is from the ambassador
    const hasCommented = response.casts?.some(cast => 
      cast.author?.fid === ambassadorFid
    );

    if (hasCommented) {
      console.log(`✅ FID ${ambassadorFid} has commented on cast ${castHash}`);
      
      // Get the ambassador's comment for details
      const ambassadorComment = response.casts?.find(cast => cast.author?.fid === ambassadorFid);
      
      return {
        verified: true,
        details: {
          ambassadorFid,
          castHash,
          castAuthorFid,
          commentText: ambassadorComment?.text?.substring(0, 100), // First 100 chars
          verifiedAt: new Date().toISOString()
        }
      };
    } else {
      console.log(`❌ FID ${ambassadorFid} has NOT commented on cast ${castHash}`);
      return {
        verified: false,
        error: 'Comment not found. Please reply to the cast and try again.',
        details: {
          ambassadorFid,
          castHash,
          totalComments: response.casts?.length || 0
        }
      };
    }

  } catch (error) {
    console.error('❌ Error verifying comment bounty:', error);
    return {
      verified: false,
      error: `Verification failed: ${error.message}`
    };
  }
}

/**
 * Main verification router - calls appropriate function based on bounty type
 * @param {string} bountyType - Type of bounty (farcaster_like, farcaster_recast, farcaster_comment)
 * @param {number} ambassadorFid - Ambassador's Farcaster ID
 * @param {string} castHash - Target cast hash
 * @param {number} castAuthorFid - Target cast author's FID
 * @returns {Promise<{verified: boolean, error?: string, details?: object}>}
 */
export async function verifyFarcasterBounty(bountyType, ambassadorFid, castHash, castAuthorFid) {
  console.log(`🎯 Verifying ${bountyType} bounty for FID ${ambassadorFid}`);

  // Validate inputs
  if (!ambassadorFid || !castHash || !castAuthorFid) {
    return {
      verified: false,
      error: 'Missing required parameters for verification'
    };
  }

  // Route to appropriate verification function
  switch (bountyType) {
    case 'farcaster_like':
      return await verifyLikeBounty(ambassadorFid, castHash, castAuthorFid);
    
    case 'farcaster_recast':
      return await verifyRecastBounty(ambassadorFid, castHash, castAuthorFid);
    
    case 'farcaster_comment':
      return await verifyCommentBounty(ambassadorFid, castHash, castAuthorFid);
    
    default:
      return {
        verified: false,
        error: `Unknown bounty type: ${bountyType}`
      };
  }
}

/**
 * Parse cast URL to extract hash, author FID, and cast details
 * Supports formats:
 * - https://warpcast.com/username/0xhash
 * - https://warpcast.com/~/conversations/0xhash
 * @param {string} castUrl - Warpcast URL
 * @returns {Promise<{hash: string, authorFid: number, authorUsername: string, text: string} | null>}
 */
export async function parseCastUrl(castUrl) {
  try {
    // Extract hash from URL
    const hashMatch = castUrl.match(/0x[a-fA-F0-9]{40}/);
    if (!hashMatch) {
      console.error('❌ Invalid cast URL: no hash found');
      return null;
    }

    const hash = hashMatch[0];
    console.log(`📍 Extracted hash: ${hash}`);

    // Fetch the cast directly to get all details
    console.log(`🔍 Fetching cast details for hash: ${hash}`);
    const castResponse = await neynarClient.lookUpCastByHashOrWarpcastUrl(hash, 'hash');
    
    if (!castResponse?.cast) {
      console.error('❌ Cast not found');
      return null;
    }

    const cast = castResponse.cast;
    const authorFid = cast.author?.fid;
    const authorUsername = cast.author?.username;
    const text = cast.text || '';

    if (!authorFid || !authorUsername) {
      console.error('❌ Could not resolve author details from cast');
      return null;
    }

    console.log(`✅ Cast parsed: @${authorUsername} (FID: ${authorFid})`);
    
    return {
      hash,
      authorFid,
      authorUsername,
      text
    };

  } catch (error) {
    console.error('❌ Error parsing cast URL:', error);
    return null;
  }
}

