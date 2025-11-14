// Ambassador notification system
// Handles sending Farcaster notifications for ambassador activities

import { sendNotificationWithNeynar } from './neynar.js';
import { supabaseAdmin } from './supabase.js';

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
 * Send new bounty notification to all active ambassadors
 * @param {object} bountyData - The bounty data (from database)
 * @returns {Promise<object>} Summary of notification results
 */
export async function sendNewBountyNotification(bountyData) {
  try {
    console.log(`🔔 Sending new bounty notification for: "${bountyData.title}"`);

    // Get ambassadors to notify - either all active or specific targets
    let ambassadorFids;
    
    if (bountyData.target_ambassador_fids && Array.isArray(bountyData.target_ambassador_fids) && bountyData.target_ambassador_fids.length > 0) {
      // Targeted bounty - only notify specific ambassadors
      console.log(`🎯 Targeted bounty: notifying ${bountyData.target_ambassador_fids.length} specific ambassador(s)`);
      ambassadorFids = bountyData.target_ambassador_fids;
    } else {
      // General bounty - notify all active ambassadors
      console.log(`📢 General bounty: notifying all active ambassadors`);
      ambassadorFids = await getAllActiveAmbassadors();
    }

    if (ambassadorFids.length === 0) {
      console.log('⚠️ No ambassadors to notify');
      return {
        success: true,
        totalAmbassadors: 0,
        successCount: 0,
        failureCount: 0
      };
    }

    // Create notification message
    const rewardAmount = bountyData.reward_tokens || bountyData.rewardTokens;
    const message = {
      title: "🎯 New Bounty!", // Keep under 32 chars
      body: `${bountyData.title} - Earn ${rewardAmount.toLocaleString()} $mintedmerch tokens!`,
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/ambassador?from=new_bounty&t=${Date.now()}`
    };

    console.log(`📤 Sending notifications to ${ambassadorFids.length} ambassadors...`);

    // Send notifications to all ambassadors
    const results = await Promise.allSettled(
      ambassadorFids.map(fid => sendNotificationWithNeynar(fid, message))
    );

    // Count successes and failures
    const successCount = results.filter(r => 
      r.status === 'fulfilled' && r.value.success && !r.value.skipped
    ).length;
    const skippedCount = results.filter(r => 
      r.status === 'fulfilled' && r.value.skipped
    ).length;
    const failureCount = results.length - successCount - skippedCount;

    console.log(`📊 New bounty notification results:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️ Skipped: ${skippedCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);

    return {
      success: true,
      totalAmbassadors: ambassadorFids.length,
      successCount,
      failureCount,
      skippedCount,
      bountyTitle: bountyData.title
    };

  } catch (error) {
    console.error('❌ Error in sendNewBountyNotification:', error);
    return {
      success: false,
      error: error.message,
      totalAmbassadors: 0,
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

