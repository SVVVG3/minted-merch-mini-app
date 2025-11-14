// Farcaster Bounty Verification System
// Auto-verifies engagement bounties (likes, recasts, comments) via Neynar API

import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';
import { ReactionsType } from '@neynar/nodejs-sdk/build/api';

// Lazy-initialize Neynar client to avoid build-time errors
let neynarClient = null;

/**
 * Get or create Neynar client instance
 * @returns {NeynarAPIClient}
 */
function getNeynarClient() {
  if (!neynarClient) {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      throw new Error('NEYNAR_API_KEY is not configured');
    }
    
    // Use SDK v2 Configuration object
    const config = new Configuration({
      apiKey: apiKey
    });
    
    neynarClient = new NeynarAPIClient(config);
  }
  return neynarClient;
}

/**
 * Check if Neynar is available
 * @returns {boolean}
 */
function isNeynarAvailable() {
  return !!(process.env.NEYNAR_API_KEY);
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

    // Fetch all likes on the target cast using SDK v2 method
    const client = getNeynarClient();
    const response = await client.fetchCastReactions({
      hash: castHash,
      types: ReactionsType.Likes,
      viewerFid: ambassadorFid,
      limit: 100
    });

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

    // Fetch all recasts of the target cast using SDK v2 method
    const client = getNeynarClient();
    const response = await client.fetchCastReactions({
      hash: castHash,
      types: ReactionsType.Recasts,
      viewerFid: ambassadorFid,
      limit: 100
    });

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

    // Fetch cast conversation (includes all direct replies) using SDK v2 method
    const client = getNeynarClient();
    const response = await client.lookupCastConversation({
      identifier: castHash,
      type: 'hash',  // Use string literal instead of enum
      replyDepth: 1, // Only fetch direct replies (first level)
      includeChronologicalParentCasts: false,
      limit: 100
    });

    // Extract direct replies from conversation
    const directReplies = response.conversation?.cast?.direct_replies || [];
    console.log(`📊 Found ${directReplies.length} replies to cast`);

    // Check if any reply is from the ambassador
    const hasCommented = directReplies.some(cast => 
      cast.author?.fid === ambassadorFid
    );

    if (hasCommented) {
      console.log(`✅ FID ${ambassadorFid} has commented on cast ${castHash}`);
      
      // Get the ambassador's comment for details
      const ambassadorComment = directReplies.find(cast => cast.author?.fid === ambassadorFid);
      
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
 * Verify if an ambassador completed ALL engagement actions (like + recast + comment)
 * @param {number} ambassadorFid - Ambassador's Farcaster ID
 * @param {string} castHash - Target cast hash (0x...)
 * @param {number} castAuthorFid - Target cast author's FID
 * @returns {Promise<{verified: boolean, error?: string, details?: object}>}
 */
export async function verifyAllEngagementBounty(ambassadorFid, castHash, castAuthorFid) {
  try {
    console.log(`🎯 Verifying ALL engagement (like + recast + comment) for FID ${ambassadorFid} on cast ${castHash}`);

    if (!isNeynarAvailable()) {
      return {
        verified: false,
        error: 'Neynar API not configured'
      };
    }

    // Run all three verifications in parallel
    const [likeResult, recastResult, commentResult] = await Promise.all([
      verifyLikeBounty(ambassadorFid, castHash, castAuthorFid),
      verifyRecastBounty(ambassadorFid, castHash, castAuthorFid),
      verifyCommentBounty(ambassadorFid, castHash, castAuthorFid)
    ]);

    // Check which actions are missing
    const missingActions = [];
    if (!likeResult.verified) missingActions.push('like');
    if (!recastResult.verified) missingActions.push('recast');
    if (!commentResult.verified) missingActions.push('comment');

    if (missingActions.length > 0) {
      console.log(`❌ FID ${ambassadorFid} missing actions: ${missingActions.join(', ')}`);
      return {
        verified: false,
        error: `Please complete all actions. Missing: ${missingActions.join(', ')} the cast.`,
        details: {
          ambassadorFid,
          castHash,
          castAuthorFid,
          completed: {
            like: likeResult.verified,
            recast: recastResult.verified,
            comment: commentResult.verified
          },
          missing: missingActions
        }
      };
    }

    console.log(`✅ FID ${ambassadorFid} completed ALL engagement actions on cast ${castHash}`);
    return {
      verified: true,
      details: {
        ambassadorFid,
        castHash,
        castAuthorFid,
        completed: {
          like: true,
          recast: true,
          comment: true
        },
        verifiedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('❌ Error verifying all engagement bounty:', error);
    return {
      verified: false,
      error: `Verification failed: ${error.message}`
    };
  }
}

/**
 * Main verification router - calls appropriate function based on bounty type
 * @param {string} bountyType - Type of bounty (farcaster_like, farcaster_recast, farcaster_comment, farcaster_engagement)
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
    
    case 'farcaster_engagement':
      return await verifyAllEngagementBounty(ambassadorFid, castHash, castAuthorFid);
    
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
 * - https://farcaster.xyz/username/0x10269f05 (short hash, 8 hex chars)
 * - https://farcaster.xyz/username/0xabc123...40chars (full hash)
 * - https://warpcast.com/username/0xhash (legacy, still supported)
 * @param {string} castUrl - Farcaster cast URL
 * @returns {Promise<{hash: string, authorFid: number, authorUsername: string, text: string} | null>}
 */
export async function parseCastUrl(castUrl) {
  try {
    console.log(`🔍 Parsing Farcaster cast URL: ${castUrl}`);
    
    // Extract hash from URL - support both short hashes (8 chars) and full hashes (40 chars)
    // Farcaster URLs can use either format: 0x10269f05 or 0x...40 chars
    const hashMatch = castUrl.match(/0x[a-fA-F0-9]{8,}/);
    if (!hashMatch) {
      console.error('❌ Invalid cast URL: no hash found in URL');
      console.error(`   URL provided: ${castUrl}`);
      console.error('   Expected format: https://farcaster.xyz/username/0xhash or https://warpcast.com/username/0xhash');
      console.error('   Hash should be at least 8 hex characters (e.g., 0x10269f05)');
      return null;
    }

    const hash = hashMatch[0];
    console.log(`✅ Extracted cast hash: ${hash} (${hash.length - 2} hex chars)`);

    // Fetch the cast directly to get all details using SDK v2 method
    console.log(`🔍 Fetching cast details from Neynar API...`);
    const client = getNeynarClient();
    const castResponse = await client.lookupCastByHashOrWarpcastUrl({
      identifier: hash,
      type: 'hash'  // Use string literal instead of enum
    });
    
    if (!castResponse?.cast) {
      console.error('❌ Cast not found in Neynar');
      console.error(`   Hash: ${hash}`);
      console.error('   The cast may not exist, may be deleted, or Neynar may not have indexed it yet');
      return null;
    }

    const cast = castResponse.cast;
    console.log(`✅ Cast found! Author: @${cast.author?.username}, FID: ${cast.author?.fid}`);
    
    const authorFid = cast.author?.fid;
    const authorUsername = cast.author?.username;
    const text = cast.text || '';

    if (!authorFid || !authorUsername) {
      console.error('❌ Could not resolve author details from cast');
      console.error(`   Cast response:`, cast);
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

