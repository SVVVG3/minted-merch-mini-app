// Staking reminder notification system

import { supabase, supabaseAdmin } from './supabase.js';
import { sendNotificationWithNeynar } from './neynar.js';
import { formatPSTTime, isStakingReminderTime } from './timezone.js';

/**
 * Log batch notifications sent to database (OPTIMIZED for batch operations)
 * @param {Array<number>} userFids - Array of user Farcaster IDs
 * @param {string} type - Notification type ('staking_reminder')
 */
async function logBatchNotificationsSent(userFids, type) {
  try {
    const adminClient = supabaseAdmin || supabase;
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();
    
    const updateData = {};
    if (type === 'staking_reminder') {
      updateData.last_staking_reminder_sent_date = currentCheckInDay;
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await adminClient
        .from('profiles')
        .update(updateData)
        .in('fid', userFids);

      if (error) {
        console.error(`Error logging batch ${type}:`, error);
      } else {
        console.log(`📝 Logged ${type} notification for ${userFids.length} users on ${currentCheckInDay}`);
      }
    }
  } catch (error) {
    console.error('Error logging batch notifications:', error);
  }
}

/**
 * Log notification sent to database (tracks when reminders were last sent)
 * @param {number} userFid - User's Farcaster ID
 * @param {string} type - Notification type ('staking_reminder')
 * @param {object} message - Message content
 */
async function logNotificationSent(userFid, type, message) {
  try {
    const adminClient = supabaseAdmin || supabase;
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();
    
    const updateData = {};
    if (type === 'staking_reminder') {
      updateData.last_staking_reminder_sent_date = currentCheckInDay;
    }
    
    if (Object.keys(updateData).length > 0) {
      const { error } = await adminClient
        .from('profiles')
        .update(updateData)
        .eq('fid', userFid);
      
      if (error) {
        console.error(`Error logging ${type} for FID ${userFid}:`, error);
      } else {
        console.log(`📝 Logged ${type} notification for FID: ${userFid} on ${currentCheckInDay}`);
      }
    }
  } catch (error) {
    console.error('Error logging notification:', error);
  }
}

export function shouldSendStakingReminders() {
  return isStakingReminderTime();
}

/**
 * Get all users who have tokens staked and have notifications enabled
 * Uses the staked_balance column in profiles table (updated via RPC when users open the app)
 * @returns {array} Array of { fid, stakedAmount } for users who need staking reminders
 */
export async function getUsersWithStakedBalances() {
  try {
    const adminClient = supabaseAdmin || supabase;
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();
    
    let allUsers = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: usersBatch, error: usersError } = await adminClient
        .from('profiles')
        .select('fid, staked_balance, last_staking_reminder_sent_date')
        .eq('has_notifications', true)
        .gt('staked_balance', 0)
        .order('fid', { ascending: true })
        .range(from, from + batchSize - 1);

      if (usersError) {
        console.error('Error fetching users with staked balances:', usersError);
        break;
      }

      if (usersBatch && usersBatch.length > 0) {
        allUsers = allUsers.concat(usersBatch);
        
        if (usersBatch.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Found ${allUsers.length} users with staked balances and notifications enabled`);
    
    const usersNeedingReminder = allUsers
      .filter(user => user.last_staking_reminder_sent_date !== currentCheckInDay)
      .map(user => ({
        fid: user.fid,
        stakedAmount: parseFloat(user.staked_balance) || 0
      }));
    
    console.log(`📊 ${usersNeedingReminder.length} users need staking reminders (not sent today)`);
    return usersNeedingReminder;
    
  } catch (error) {
    console.error('Error in getUsersWithStakedBalances:', error);
    return [];
  }
}

/**
 * Create staking reminder message
 * @returns {object} Notification message object
 */
export function createStakingReminderMessage() {
  return {
    title: "FREE Spin-to-Claim is Live!",
    body: "Spin the wheel to claim & compound your $mintedmerch rewards, with a bonus chance to win physical merch packs!",
    targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/stake?from=staking_reminder&t=${Date.now()}`
  };
}

/**
 * Send staking reminder to a single user
 * @param {number} userFid - User's Farcaster ID
 * @returns {object} Result of notification send
 */
export async function sendStakingReminder(userFid) {
  try {
    console.log(`Sending staking reminder to FID: ${userFid}`);

    const message = createStakingReminderMessage();
    const result = await sendNotificationWithNeynar(userFid, message);

    if (result.success) {
      if (result.skipped) {
        console.log(`⏭️ Skipped FID ${userFid}: ${result.reason || 'Notifications not enabled'}`);
        return {
          success: true,
          skipped: true,
          userFid: userFid,
          reason: result.reason || 'Notifications not enabled'
        };
      }
      
      console.log(`✅ Staking reminder sent successfully to FID: ${userFid}`);
      await logNotificationSent(userFid, 'staking_reminder', message);
      
      return {
        success: true,
        userFid: userFid,
        message: message
      };
    } else {
      console.error(`❌ Failed to send staking reminder to FID: ${userFid}`, result.error);
      return {
        success: false,
        userFid: userFid,
        error: result.error
      };
    }

  } catch (error) {
    console.error(`Error sending staking reminder to FID: ${userFid}`, error);
    return {
      success: false,
      userFid: userFid,
      error: error.message
    };
  }
}

/**
 * Send staking reminders to all users with staked balances using BATCHED Neynar API
 * @returns {object} Summary of notification results
 */
export async function sendStakingReminders() {
  try {
    console.log('💎 Starting staking reminder process...');
    console.log('📅 Current PST time:', formatPSTTime());

    const usersWithStakes = await getUsersWithStakedBalances();

    if (usersWithStakes.length === 0) {
      console.log('✅ No users need staking reminders');
      return {
        success: true,
        totalUsers: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        results: []
      };
    }

    console.log(`📤 Sending staking reminders to ${usersWithStakes.length} users using BATCH API...`);

    const { sendBatchNotificationWithNeynar } = await import('./neynar.js');
    const allFids = usersWithStakes.map(u => u.fid);
    
    const message = {
      title: "FREE Spin-to-Claim is Live!",
      body: "Spin the wheel to claim & compound your $mintedmerch rewards, with a bonus chance to win physical merch packs!",
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/stake?from=staking_reminder&t=${Date.now()}`
    };
    
    console.log(`📤 Sending single batch: ${allFids.length} users...`);
    
    const batchResult = await sendBatchNotificationWithNeynar(allFids, message);
    const allResults = [];
    
    if (batchResult.success && batchResult.results) {
      allResults.push(...batchResult.results);
      
      const successfulFids = batchResult.results
        .filter(r => r.success && !r.skipped)
        .map(r => r.userFid);
      
      if (successfulFids.length > 0) {
        await logBatchNotificationsSent(successfulFids, 'staking_reminder');
      }

      // Log Neynar's aggregate delivery stats for credit monitoring
      if (batchResult.stats) {
        const { successCount, failureCount, notAttemptedCount } = batchResult.stats;
        console.log(`📊 Neynar delivery stats: ${successCount} delivered, ${failureCount} failed, ${notAttemptedCount} not attempted (no active token)`);
      }
    } else {
      allResults.push(...allFids.map(fid => ({
        success: false,
        userFid: fid,
        error: batchResult.error || 'Batch send failed'
      })));
    }
    
    const actuallySent = allResults.filter(r => r.success && !r.skipped).length;
    const skippedCount = allResults.filter(r => r.skipped).length;
    const actualFailures = allResults.filter(r => !r.success).length;

    console.log(`📊 Staking reminder results:`);
    console.log(`   ✅ FIDs marked as sent: ${actuallySent}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Failed: ${actualFailures}`);
    console.log(`   📱 Total FIDs in batch: ${allResults.length}`);

    return {
      success: true,
      totalUsers: usersWithStakes.length,
      successCount: actuallySent,
      failureCount: actualFailures,
      skippedCount: skippedCount,
      results: allResults
    };

  } catch (error) {
    console.error('Error in sendStakingReminders:', error);
    return {
      success: false,
      error: error.message,
      totalUsers: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      results: []
    };
  }
}
