// Mogul notification system
// Handles sending Farcaster notifications for Minted Merch Missions
// OPTIMIZED: Now uses batch API for multi-user notifications to reduce credit consumption

import { sendBatchNotificationWithNeynar, sendNotificationWithNeynar } from './neynar.js';
import { supabaseAdmin } from './supabase.js';
import { getAllCustomBountyEligibleUsers } from './mogulHelpers.js';

// Interaction bounty types - available to all missions-eligible users
const INTERACTION_BOUNTY_TYPES = ['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_like_recast', 'farcaster_engagement'];

/**
 * Get all active ambassadors' FIDs
 * @returns {Promise<number[]>} Array of FIDs for active ambassadors
 */
export async function getAllActiveAmbassadors() {
  try {
    const { data: ambassadors, error } = await supabaseAdmin
      .from('ambassadors')
      .select('fid')
      .eq('is_active', true);

    if (error) {
      console.error('❌ Error fetching active ambassadors:', error);
      return [];
    }

    const fids = ambassadors.map(a => a.fid);
    console.log(`📋 Found ${fids.length} active ambassadors`);
    return fids;

  } catch (error) {
    console.error('❌ Error in getAllActiveAmbassadors:', error);
    return [];
  }
}

/**
 * Get all users eligible for Minted Merch Missions
 * Includes: Merch Moguls (50M+ tokens) AND Stakers (10M+ staked)
 * @returns {Promise<number[]>} Array of FIDs for eligible users
 */
export async function getAllMissionsEligibleUsers() {
  try {
    const MOGUL_TOKEN_THRESHOLD = 50_000_000;
    const STAKER_TOKEN_THRESHOLD = 10_000_000; // 10M staked required
    
    // Get Merch Moguls (50M+ tokens)
    const { data: moguls, error: mogulsError } = await supabaseAdmin
      .from('profiles')
      .select('fid')
      .gte('token_balance', MOGUL_TOKEN_THRESHOLD);

    if (mogulsError) {
      console.error('❌ Error fetching Merch Moguls:', mogulsError);
    }

    // Get Stakers (10M+ staked)
    const { data: stakers, error: stakersError } = await supabaseAdmin
      .from('profiles')
      .select('fid')
      .gte('staked_balance', STAKER_TOKEN_THRESHOLD);

    if (stakersError) {
      console.error('❌ Error fetching Stakers:', stakersError);
    }

    // Combine and deduplicate
    const mogulFids = (moguls || []).map(p => p.fid);
    const stakerFids = (stakers || []).map(p => p.fid);
    const allFids = [...new Set([...mogulFids, ...stakerFids])];

    console.log(`🎯 Found ${allFids.length} missions-eligible users (${mogulFids.length} moguls, ${stakerFids.length} stakers)`);
    return allFids;

  } catch (error) {
    console.error('❌ Error in getAllMissionsEligibleUsers:', error);
    return [];
  }
}

/**
 * Legacy alias for getAllMissionsEligibleUsers
 * @deprecated Use getAllMissionsEligibleUsers
 */
export async function getAllMerchMoguls() {
  return getAllMissionsEligibleUsers();
}

/**
 * Send new bounty notification - routes to correct recipients based on bounty type
 * - Interaction bounties (like, recast, comment, engagement) → Missions-eligible users (50M+ tokens OR 10M+ staked)
 * - Custom bounties → 50M+ Stakers (Moguls) or targeted users
 * OPTIMIZED: Uses batch API - 1 API call instead of N calls
 * @param {object} bountyData - The bounty data (from database)
 * @returns {Promise<object>} Summary of notification results
 */
export async function sendNewBountyNotification(bountyData) {
  try {
    const bountyType = bountyData.bounty_type || bountyData.bountyType || 'custom';
    const isInteractionBounty = INTERACTION_BOUNTY_TYPES.includes(bountyType);
    
    console.log(`🔔 Sending new bounty notification for: "${bountyData.title}" (type: ${bountyType})`);

    let recipientFids;
    let recipientType;
    let targetUrl;
    
    if (isInteractionBounty) {
      // INTERACTION BOUNTY → Notify missions-eligible users (50M+ tokens OR 10M+ staked)
      console.log(`🎯 Interaction bounty: notifying missions-eligible users`);
      recipientFids = await getAllMissionsEligibleUsers();
      recipientType = 'missions_users';
      targetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/missions?from=new_mission&t=${Date.now()}`;
    } else {
      // CUSTOM BOUNTY → Notify 50M+ Stakers (Moguls)
      if (bountyData.target_ambassador_fids && Array.isArray(bountyData.target_ambassador_fids) && bountyData.target_ambassador_fids.length > 0) {
        // Targeted bounty - only notify specific users
        console.log(`🎯 Targeted custom bounty: notifying ${bountyData.target_ambassador_fids.length} specific user(s)`);
        recipientFids = bountyData.target_ambassador_fids;
      } else {
        // General custom bounty - notify all 50M+ stakers
        console.log(`📢 Custom bounty: notifying all 50M+ stakers (Moguls)`);
        recipientFids = await getAllCustomBountyEligibleUsers();
      }
      recipientType = 'moguls';
      targetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/missions?from=new_mission&t=${Date.now()}`; // Now points to missions
    }

    if (recipientFids.length === 0) {
      console.log(`⚠️ No ${recipientType} to notify`);
      return {
        success: true,
        totalRecipients: 0,
        successCount: 0,
        failureCount: 0,
        recipientType
      };
    }

    // Create notification message
    const rewardAmount = bountyData.reward_tokens || bountyData.rewardTokens;
    const title = "🎯 New Mission!"; // All bounties are now missions
    const message = {
      title, // Keep under 32 chars
      body: `${bountyData.title} - Earn ${rewardAmount.toLocaleString()} $mintedmerch tokens!`,
      targetUrl
    };

    console.log(`📤 Sending BATCH notification to ${recipientFids.length} ${recipientType} (1 API call)...`);

    // OPTIMIZED: Single batch API call
    const batchResult = await sendBatchNotificationWithNeynar(recipientFids, message);

    // Count successes and failures from batch result
    let successCount = 0;
    let skippedCount = 0;
    let failureCount = 0;

    if (batchResult.success && batchResult.results) {
      successCount = batchResult.results.filter(r => r.success && !r.skipped).length;
      skippedCount = batchResult.results.filter(r => r.skipped).length;
      failureCount = batchResult.results.filter(r => !r.success && !r.skipped).length;
    } else {
      failureCount = recipientFids.length;
    }

    console.log(`📊 New bounty notification results (${recipientType}):`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️ Skipped: ${skippedCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   🚀 API calls: 1 (instead of ${recipientFids.length})`);

    return {
      success: true,
      totalRecipients: recipientFids.length,
      successCount,
      failureCount,
      skippedCount,
      bountyTitle: bountyData.title,
      recipientType,
      bountyType
    };

  } catch (error) {
    console.error('❌ Error in sendNewBountyNotification:', error);
    return {
      success: false,
      error: error.message,
      totalRecipients: 0,
      successCount: 0,
      failureCount: 0
    };
  }
}

/**
 * Send payout ready notification to individual ambassador
 * @param {number} fid - Ambassador's Farcaster ID
 * @param {object} payoutData - The payout data
 * @returns {Promise<object>} Result of notification send
 */
export async function sendPayoutReadyNotification(fid, payoutData) {
  try {
    console.log(`🔔 Sending payout ready notification to FID: ${fid}`);

    const amountTokens = payoutData.amount_tokens || payoutData.amountTokens;
    const bountyTitle = payoutData.bounty?.title || payoutData.notes || 'Bounty';

    // Create notification message
    const message = {
      title: "💰 Payout Ready!", // Keep under 32 chars
      body: `Your ${amountTokens.toLocaleString()} $mintedmerch tokens are ready! Tap to claim now.`,
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/ambassador?tab=payouts&from=payout_ready&t=${Date.now()}`
    };

    // Send notification via Neynar
    const result = await sendNotificationWithNeynar(fid, message);

    if (result.success && !result.skipped) {
      console.log(`✅ Payout ready notification sent to FID: ${fid}`);
      return {
        success: true,
        fid,
        amount: amountTokens
      };
    } else if (result.skipped) {
      console.log(`⏭️ Notification skipped for FID ${fid}: ${result.reason || 'Notifications not enabled'}`);
      return {
        success: false,
        skipped: true,
        fid,
        reason: result.reason
      };
    } else {
      console.error(`❌ Failed to send payout ready notification to FID: ${fid}`, result.error);
      return {
        success: false,
        fid,
        error: result.error
      };
    }

  } catch (error) {
    console.error(`❌ Error sending payout ready notification to FID: ${fid}`, error);
    return {
      success: false,
      fid,
      error: error.message
    };
  }
}

/**
 * Send submission rejected notification to individual ambassador
 * @param {number} fid - Ambassador's Farcaster ID
 * @param {object} submissionData - The submission data with bounty info
 * @param {string} adminNotes - Feedback from admin
 * @returns {Promise<object>} Result of notification send
 */
export async function sendSubmissionRejectedNotification(fid, submissionData, adminNotes) {
  try {
    console.log(`🔔 Sending submission rejected notification to FID: ${fid}`);

    const bountyTitle = submissionData.bounty?.title || submissionData.bountyTitle || 'Bounty';

    // Create notification message
    const message = {
      title: "❌ Submission Rejected", // Keep under 32 chars
      body: `Your "${bountyTitle}" submission was rejected. Check feedback and try again!`,
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/ambassador?tab=submissions&from=submission_rejected&t=${Date.now()}`
    };

    // Send notification via Neynar
    const result = await sendNotificationWithNeynar(fid, message);

    if (result.success && !result.skipped) {
      console.log(`✅ Rejection notification sent to FID: ${fid}`);
      return {
        success: true,
        fid,
        bountyTitle
      };
    } else if (result.skipped) {
      console.log(`⏭️ Notification skipped for FID ${fid}: ${result.reason || 'Notifications not enabled'}`);
      return {
        success: false,
        skipped: true,
        fid,
        reason: result.reason
      };
    } else {
      console.error(`❌ Failed to send rejection notification to FID: ${fid}`, result.error);
      return {
        success: false,
        fid,
        error: result.error
      };
    }

  } catch (error) {
    console.error(`❌ Error sending rejection notification to FID: ${fid}`, error);
    return {
      success: false,
      fid,
      error: error.message
    };
  }
}

/**
 * Send welcome notification to newly added ambassador
 * @param {number} fid - Ambassador's Farcaster ID
 * @param {object} ambassadorData - The ambassador data
 * @returns {Promise<object>} Result of notification send
 */
export async function sendWelcomeAmbassadorNotification(fid, ambassadorData) {
  try {
    console.log(`🔔 Sending welcome notification to new ambassador FID: ${fid}`);

    // Get username from ambassador data if available
    const username = ambassadorData.profiles?.username || 
                    ambassadorData.username || 
                    `FID ${fid}`;

    // Create welcome message
    const message = {
      title: "🎉 Welcome Ambassador!", // Keep under 32 chars
      body: `You're now a Minted Merch Ambassador! Start earning $mintedmerch tokens by completing bounties.`,
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/ambassador?from=welcome&t=${Date.now()}`
    };

    // Send notification via Neynar
    const result = await sendNotificationWithNeynar(fid, message);

    if (result.success && !result.skipped) {
      console.log(`✅ Welcome notification sent to @${username} (FID: ${fid})`);
      return {
        success: true,
        fid,
        username
      };
    } else if (result.skipped) {
      console.log(`⏭️ Welcome notification skipped for FID ${fid}: ${result.reason || 'Notifications not enabled'}`);
      return {
        success: false,
        skipped: true,
        fid,
        reason: result.reason
      };
    } else {
      console.error(`❌ Failed to send welcome notification to FID: ${fid}`, result.error);
      return {
        success: false,
        fid,
        error: result.error
      };
    }

  } catch (error) {
    console.error(`❌ Error sending welcome notification to FID: ${fid}`, error);
    return {
      success: false,
      fid,
      error: error.message
    };
  }
}

/**
 * Test function to send a single ambassador notification
 * @param {number} fid - Ambassador's Farcaster ID to test
 * @returns {Promise<object>} Test result
 */
export async function testAmbassadorNotification(fid) {
  console.log(`🧪 Testing ambassador notification for FID: ${fid}`);
  
  try {
    const testBounty = {
      title: 'Test Bounty Notification',
      reward_tokens: 1000
    };
    
    const result = await sendNewBountyNotification(testBounty);
    
    console.log('🧪 Test result:', result);
    return result;
  } catch (error) {
    console.error('🧪 Test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

