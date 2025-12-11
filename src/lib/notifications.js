// Daily check-in notification system
// Handles sending reminders at 8 AM PST every day

import { supabase, supabaseAdmin } from './supabase.js';
import { sendNotificationWithNeynar } from './neynar.js';
import { getCurrentPSTTime, formatPSTTime, isNotificationTime, isAfternoonNotificationTime, isEveningNotificationTime, isStakingReminderTime } from './timezone.js';

/**
 * Get all users who have notifications enabled and haven't checked in today
 * @returns {array} Array of user FIDs who need check-in reminders
 */
export async function getUsersNeedingCheckInReminders() {
  try {
    // Use supabaseAdmin to bypass RLS for system operations
    const adminClient = supabaseAdmin || supabase;
    
    // Get current check-in day for filtering
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();
    
    // Get all users who have notifications enabled and haven't received a reminder today
    // NOTE: last_daily_reminder_sent_date is stored as DATE in PST timezone
    // 🔧 FIX: Fetch ALL users, not just 1000 (Supabase default limit)
    let allProfiles = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: profilesBatch, error: profilesError } = await adminClient
        .from('profiles')
        .select('fid, last_daily_reminder_sent_date')
        .eq('has_notifications', true)
        .order('fid', { ascending: true })  // ✅ FIX: Ensure consistent ordering for pagination
        .range(from, from + batchSize - 1);

      if (profilesError) {
        console.error('Error fetching users with notifications:', profilesError);
        break;
      }

      if (profilesBatch && profilesBatch.length > 0) {
        allProfiles = allProfiles.concat(profilesBatch);
        console.log(`📥 Fetched batch: ${profilesBatch.length} users (total so far: ${allProfiles.length})`);
        
        // If we got fewer than batchSize, we've reached the end
        if (profilesBatch.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }

    const profilesData = allProfiles;

    if (!profilesData || profilesData.length === 0) {
      console.log('No users with notifications enabled');
      return [];
    }

    console.log(`Found ${profilesData.length} users with notifications enabled`);

    // Get users who haven't checked in today
    // 🔧 FIX: Batch the .in() query to avoid PostgreSQL limit on array size (typically ~1000)
    let leaderboardData = [];
    const LEADERBOARD_BATCH_SIZE = 1000;
    
    for (let i = 0; i < profilesData.length; i += LEADERBOARD_BATCH_SIZE) {
      const fidBatch = profilesData.slice(i, i + LEADERBOARD_BATCH_SIZE).map(p => p.fid);
      
      const { data: leaderboardBatch, error: leaderboardError } = await adminClient
        .from('user_leaderboard')
        .select('user_fid, last_checkin_date')
        .in('user_fid', fidBatch);

      if (leaderboardError) {
        console.error('Error fetching leaderboard data batch:', leaderboardError);
        continue; // Skip this batch but continue with others
      }
      
      if (leaderboardBatch) {
        leaderboardData.push(...leaderboardBatch);
      }
    }
    
    console.log(`📊 Fetched leaderboard data for ${leaderboardData.length} users`);

    // Filter users who need reminders
    const usersNeedingReminders = profilesData.filter(profile => {
      // DUPLICATE PREVENTION: Skip if we already sent a reminder today
      if (profile.last_daily_reminder_sent_date === currentCheckInDay) {
        return false;
      }

      const userLeaderboard = leaderboardData.find(lb => lb.user_fid === profile.fid);
      
      // If user has no leaderboard entry, they need a reminder
      if (!userLeaderboard) {
        return true;
      }

      // If user hasn't checked in today, they need a reminder
      return userLeaderboard.last_checkin_date !== currentCheckInDay;
    });

    console.log(`${usersNeedingReminders.length} users need check-in reminders`);
    console.log(`${profilesData.length - usersNeedingReminders.length} users filtered out (already checked in or already notified)`);
    return usersNeedingReminders.map(u => u.fid);

  } catch (error) {
    console.error('Error in getUsersNeedingCheckInReminders:', error);
    return [];
  }
}

/**
 * Create check-in reminder message
 * @param {number} userFid - User's Farcaster ID
 * @returns {object} Notification message object
 */
export async function createCheckInReminderMessage(userFid) {
  try {
    // Get user's current streak and points
    const { getUserLeaderboardData } = await import('./points.js');
    const userData = await getUserLeaderboardData(userFid);

    const currentStreak = userData?.checkin_streak || 0;
    const totalPoints = userData?.total_points || 0;

    // Create personalized message based on streak
    let message = "Spin the wheel to earn points and be entered into raffles for FREE merch!";
    
    if (currentStreak >= 7) {
      message = `🔥 ${currentStreak}-day streak! Don't break it - spin now for bonus points!`;
    } else if (currentStreak >= 3) {
      message = `⚡ ${currentStreak}-day streak! Keep it going - spin for bonus points!`;
    } else if (currentStreak >= 1) {
      message = `🎯 Day ${currentStreak + 1} awaits! Spin now to continue your streak!`;
    } else if (totalPoints > 0) {
      message = `🎲 Daily spin available! Add to your ${totalPoints} points & keep moving up the leaderboard!`;
    }

    return {
      title: "🎯 Daily Check-in Time",
      body: message,
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}?from=checkin_reminder&t=${Date.now()}`
    };

  } catch (error) {
    console.error('Error creating check-in reminder message:', error);
    return {
      title: "🎯 Daily Check-in Time",
      body: "Spin the wheel to earn points and be entered into raffles for FREE merch!",
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}?from=checkin_reminder&t=${Date.now()}`
    };
  }
}

/**
 * Send check-in reminder to a single user
 * @param {number} userFid - User's Farcaster ID
 * @returns {object} Result of notification send
 */
export async function sendCheckInReminder(userFid) {
  try {
    console.log(`Sending check-in reminder to FID: ${userFid}`);

    // Create personalized message
    const message = await createCheckInReminderMessage(userFid);

    // Send notification via Neynar
    const result = await sendNotificationWithNeynar(userFid, message);

    if (result.success) {
      // Check if it was actually sent or just skipped
      if (result.skipped) {
        console.log(`⏭️ Skipped FID ${userFid}: ${result.reason || 'Notifications not enabled'}`);
        return {
          success: true, // ✅ Skipped is not a failure - it's expected when notifications are disabled
          skipped: true,
          userFid: userFid,
          reason: result.reason || 'Notifications not enabled'
        };
      }
      
      console.log(`✅ Check-in reminder sent successfully to FID: ${userFid}`);
      
      // Log notification in database
      await logNotificationSent(userFid, 'checkin_reminder', message);
      
      return {
        success: true,
        userFid: userFid,
        message: message
      };
    } else {
      console.error(`❌ Failed to send check-in reminder to FID: ${userFid}`, result.error);
      return {
        success: false,
        userFid: userFid,
        error: result.error
      };
    }

  } catch (error) {
    console.error(`Error sending check-in reminder to FID: ${userFid}`, error);
    return {
      success: false,
      userFid: userFid,
      error: error.message
    };
  }
}

/**
 * Send check-in reminders to all eligible users using BATCHED Neynar API
 * OPTIMIZED: Groups users by message type and sends in batch (1,400 users = ~10 API calls instead of 1,400)
 * @returns {object} Summary of notification results
 */
export async function sendDailyCheckInReminders() {
  try {
    console.log('🚀 Starting daily check-in reminder process...');
    console.log('📅 Current PST time:', formatPSTTime());

    // Step 0: Reset stale streaks BEFORE fetching user data
    // Users who missed yesterday's check-in window should have their streak reset to 0
    // This ensures notifications show correct streak info and dashboard stats are accurate
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();
    const currentDate = new Date(currentCheckInDay);
    currentDate.setDate(currentDate.getDate() - 1);
    const yesterdayCheckInDay = currentDate.toISOString().split('T')[0];
    
    console.log(`🔄 Resetting stale streaks (last_checkin_date < ${yesterdayCheckInDay} AND checkin_streak > 0)...`);
    
    const adminClient = supabaseAdmin || supabase;
    
    // First, count how many will be reset (for accurate logging)
    const { count: staleCount, error: countError } = await adminClient
      .from('user_leaderboard')
      .select('user_fid', { count: 'exact', head: true })
      .lt('last_checkin_date', yesterdayCheckInDay)
      .gt('checkin_streak', 0);
    
    if (countError) {
      console.error('❌ Error counting stale streaks:', countError);
    } else {
      console.log(`📊 Found ${staleCount || 0} users with stale streaks to reset`);
    }
    
    // Now perform the reset (only on users with streak > 0)
    const { error: resetError } = await adminClient
      .from('user_leaderboard')
      .update({ checkin_streak: 0 })
      .lt('last_checkin_date', yesterdayCheckInDay)
      .gt('checkin_streak', 0);
      
    if (resetError) {
      console.error('❌ Error resetting stale streaks:', resetError);
    } else {
      console.log(`✅ Reset ${staleCount || 0} stale streaks to 0`);
    }

    // Get users who need reminders
    const userFids = await getUsersNeedingCheckInReminders();

    if (userFids.length === 0) {
      console.log('✅ No users need check-in reminders');
      return {
        success: true,
        totalUsers: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        results: []
      };
    }

    console.log(`📤 Sending check-in reminders to ${userFids.length} users using BATCH API...`);

    // Step 1: Fetch all user leaderboard data in batches
    const { getUserLeaderboardData } = await import('./points.js');
    // adminClient already defined above for streak reset
    
    console.log('📊 Fetching leaderboard data for message personalization...');
    let allLeaderboardData = [];
    const LEADERBOARD_BATCH_SIZE = 1000;
    
    for (let i = 0; i < userFids.length; i += LEADERBOARD_BATCH_SIZE) {
      const fidBatch = userFids.slice(i, i + LEADERBOARD_BATCH_SIZE);
      const { data, error } = await adminClient
        .from('user_leaderboard')
        .select('user_fid, checkin_streak, total_points')
        .in('user_fid', fidBatch);
      
      if (!error && data) {
        allLeaderboardData.push(...data);
      }
    }
    
    console.log(`✅ Fetched leaderboard data for ${allLeaderboardData.length} users`);
    
    // Step 2: Group users by message type
    const messageGroups = new Map();
    
    let skippedNoStreak = 0;
    
    for (const userFid of userFids) {
      const userData = allLeaderboardData.find(d => d.user_fid === userFid);
      const currentStreak = userData?.checkin_streak || 0;
      
      // OPTIMIZATION: Skip users with no active streak (currentStreak === 0)
      // These users have very low engagement (<1% open rate) and account for ~75% of notifications
      // This saves ~500K+ Neynar credits per day
      if (currentStreak === 0) {
        skippedNoStreak++;
        continue;
      }
      
      // Determine message body - OPTIMIZED: Use ranges instead of exact numbers to reduce API calls
      // Now only 4 groups (streak holders only)
      let messageBody;
      if (currentStreak >= 30) {
        messageBody = "🏆 Legendary streak! You're in the top 1% - keep it going!";
      } else if (currentStreak >= 7) {
        messageBody = "🔥 You're on fire! Don't break your streak - spin now!";
      } else if (currentStreak >= 3) {
        messageBody = "⚡ Nice streak! Keep it going - spin for bonus points!";
      } else {
        messageBody = "🎯 Keep your streak going! Spin now to continue!";
      }
      
      // Group users by message body
      if (!messageGroups.has(messageBody)) {
        messageGroups.set(messageBody, []);
      }
      messageGroups.get(messageBody).push(userFid);
    }
    
    console.log(`⏭️ Skipped ${skippedNoStreak} users with no active streak (0-day streak)`);
    const totalToNotify = userFids.length - skippedNoStreak;
    console.log(`📬 Will notify ${totalToNotify} users with active streaks`);
    
    console.log(`📊 Grouped users into ${messageGroups.size} message types`);
    messageGroups.forEach((fids, message) => {
      console.log(`   "${message.substring(0, 50)}..." → ${fids.length} users`);
    });
    
    // Step 3: Send batch notifications for each message group
    const { sendBatchNotificationWithNeynar } = await import('./neynar.js');
    const allResults = [];
    let groupNumber = 0;
    
    for (const [messageBody, fids] of messageGroups.entries()) {
      groupNumber++;
      console.log(`📤 Sending batch ${groupNumber}/${messageGroups.size}: ${fids.length} users...`);
      
      const message = {
        title: "🎯 Daily Check-in Time",
        body: messageBody,
        targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}?from=checkin_reminder&t=${Date.now()}`
      };
      
      const batchResult = await sendBatchNotificationWithNeynar(fids, message);
      
      if (batchResult.success && batchResult.results) {
        allResults.push(...batchResult.results);
        
        // Log successful notifications to database
        const successfulFids = batchResult.results
          .filter(r => r.success && !r.skipped)
          .map(r => r.userFid);
        
        if (successfulFids.length > 0) {
          await logBatchNotificationsSent(successfulFids, 'checkin_reminder');
        }
      } else {
        // If batch failed, mark all as failures
        allResults.push(...fids.map(fid => ({
          success: false,
          userFid: fid,
          error: batchResult.error || 'Batch send failed'
        })));
      }
    }
    
    // Step 4: Count results
    const actuallySent = allResults.filter(r => r.success && !r.skipped).length;
    const skippedCount = allResults.filter(r => r.skipped).length;
    const actualFailures = allResults.filter(r => !r.success).length;

    console.log(`📊 Check-in reminder results:`);
    console.log(`   ✅ Successfully sent: ${actuallySent}`);
    console.log(`   ⏭️  Skipped (notifications disabled): ${skippedCount}`);
    console.log(`   ❌ Failed: ${actualFailures}`);
    console.log(`   📱 Total: ${allResults.length}`);
    console.log(`   🚀 API calls made: ${messageGroups.size} (instead of ${userFids.length})`);

    return {
      success: true,
      totalUsers: userFids.length,
      successCount: actuallySent,
      failureCount: actualFailures,
      skippedCount: skippedCount,
      results: allResults
    };

  } catch (error) {
    console.error('Error in sendDailyCheckInReminders:', error);
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

/**
 * Log batch notifications sent to database (OPTIMIZED for batch operations)
 * @param {Array<number>} userFids - Array of user Farcaster IDs
 * @param {string} type - Notification type ('checkin_reminder', 'afternoon_checkin_reminder', 'evening_checkin_reminder', or 'staking_reminder')
 */
async function logBatchNotificationsSent(userFids, type) {
  try {
    const adminClient = supabaseAdmin || supabase;
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();
    
    // Update the appropriate column based on notification type
    const updateData = {};
    if (type === 'checkin_reminder') {
      updateData.last_daily_reminder_sent_date = currentCheckInDay;
    } else if (type === 'afternoon_checkin_reminder') {
      updateData.last_afternoon_reminder_sent_date = currentCheckInDay;
    } else if (type === 'evening_checkin_reminder') {
      updateData.last_evening_reminder_sent_date = currentCheckInDay;
    } else if (type === 'staking_reminder') {
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
 * @param {string} type - Notification type ('checkin_reminder', 'afternoon_checkin_reminder', 'evening_checkin_reminder', or 'staking_reminder')
 * @param {object} message - Message content
 */
async function logNotificationSent(userFid, type, message) {
  try {
    const adminClient = supabaseAdmin || supabase;
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();
    
    // Update the appropriate column based on notification type
    const updateData = {};
    if (type === 'checkin_reminder') {
      updateData.last_daily_reminder_sent_date = currentCheckInDay;
    } else if (type === 'afternoon_checkin_reminder') {
      updateData.last_afternoon_reminder_sent_date = currentCheckInDay;
    } else if (type === 'evening_checkin_reminder') {
      updateData.last_evening_reminder_sent_date = currentCheckInDay;
    } else if (type === 'staking_reminder') {
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

/**
 * Check if it's time to send daily notifications (8 AM PST)
 * @returns {boolean} True if it's notification time
 */
export function shouldSendDailyNotifications() {
  return isNotificationTime();
}

/**
 * Check if it's time to send afternoon notifications (2 PM PST)
 * @returns {boolean} True if it's afternoon notification time
 */
export function shouldSendAfternoonNotifications() {
  return isAfternoonNotificationTime();
}

/**
 * Check if it's time to send evening notifications (8 PM PST)
 * @returns {boolean} True if it's evening notification time
 */
export function shouldSendEveningNotifications() {
  return isEveningNotificationTime();
}

/**
 * Create evening check-in reminder message (more urgent tone)
 * @param {number} userFid - User's Farcaster ID
 * @returns {object} Notification message object
 */
/**
 * Create personalized afternoon check-in reminder message (2 PM PST)
 * @param {number} userFid - User's Farcaster ID
 * @returns {string} Personalized reminder message
 */
export async function createAfternoonCheckInReminderMessage(userFid) {
  try {
    // Get user's current streak and points
    const { getUserLeaderboardData } = await import('./points.js');
    const userData = await getUserLeaderboardData(userFid);

    const currentStreak = userData?.checkin_streak || 0;
    const totalPoints = userData?.total_points || 0;

    // Create afternoon message with a sense of urgency (halfway through the day)
    let message = "🎡 Afternoon reminder: Spin the wheel today to earn points!";
    
    if (currentStreak >= 7) {
      message = `🔥 Your ${currentStreak}-day streak is waiting! Check in before 8 AM PST tomorrow!`;
    } else if (currentStreak >= 3) {
      message = `⚡ Keep building your ${currentStreak}-day streak! Don't forget to check in today!`;
    } else if (currentStreak >= 1) {
      message = `🎯 Afternoon check-in! Keep your ${currentStreak}-day streak going!`;
    } else if (totalPoints > 0) {
      message = `🎲 Add to your ${totalPoints} points! Spin the wheel before 8 AM PST tomorrow!`;
    }

    return {
      title: "☀️ Afternoon Check-in Reminder",
      body: message,
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}?from=afternoon_reminder&t=${Date.now()}`
    };

  } catch (error) {
    console.error('Error creating afternoon check-in reminder message:', error);
    return {
      title: "☀️ Afternoon Check-in Reminder",
      body: "🎡 Friendly reminder: Don't forget to spin the wheel and earn points today!",
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}?from=afternoon_reminder&t=${Date.now()}`
    };
  }
}

/**
 * Send afternoon check-in reminder to a single user (2 PM PST)
 * @param {number} userFid - User's Farcaster ID
 * @returns {object} Result of sending the notification
 */
export async function sendAfternoonCheckInReminder(userFid) {
  try {
    console.log(`Sending afternoon check-in reminder to FID: ${userFid}`);

    // Create personalized afternoon message
    const message = await createAfternoonCheckInReminderMessage(userFid);

    // Send notification via Neynar
    const result = await sendNotificationWithNeynar(userFid, message);

    if (result.success) {
      // Check if it was actually sent or just skipped
      if (result.skipped) {
        console.log(`⏭️ Skipped FID ${userFid}: ${result.reason || 'Notifications not enabled'}`);
        return {
          success: true, // ✅ Skipped is not a failure - it's expected when notifications are disabled
          skipped: true,
          userFid: userFid,
          reason: result.reason || 'Notifications not enabled'
        };
      }
      
      console.log(`✅ Afternoon check-in reminder sent successfully to FID: ${userFid}`);
      
      // Log notification in database
      await logNotificationSent(userFid, 'afternoon_checkin_reminder', message);
      
      return {
        success: true,
        userFid: userFid,
        message: message
      };
    } else {
      console.error(`❌ Failed to send afternoon check-in reminder to FID: ${userFid}`, result.error);
      return {
        success: false,
        userFid: userFid,
        error: result.error
      };
    }

  } catch (error) {
    console.error(`Error sending afternoon check-in reminder to FID: ${userFid}`, error);
    return {
      success: false,
      userFid: userFid,
      error: error.message
    };
  }
}

export async function createEveningCheckInReminderMessage(userFid) {
  try {
    // Get user's current streak and points
    const { getUserLeaderboardData } = await import('./points.js');
    const userData = await getUserLeaderboardData(userFid);

    const currentStreak = userData?.checkin_streak || 0;
    const totalPoints = userData?.total_points || 0;

    // Create more urgent evening message based on streak
    let message = "⏰ Last chance today! Spin the wheel before 8 AM PST to earn points!";
    
    if (currentStreak >= 7) {
      message = `🔥 Don't lose your ${currentStreak}-day streak! Check in before 8 AM PST tomorrow!`;
    } else if (currentStreak >= 3) {
      message = `⚡ Keep your ${currentStreak}-day streak alive! Check in before 8 AM PST tomorrow!`;
    } else if (currentStreak >= 1) {
      message = `🎯 Don't break your streak! Check in before 8 AM PST tomorrow for day ${currentStreak + 1}!`;
    } else if (totalPoints > 0) {
      message = `🎲 Final reminder! Add to your ${totalPoints} points before 8 AM PST tomorrow!`;
    }

    return {
      title: "🌅 Daily Check-in Ending Soon",
      body: message,
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}?from=evening_checkin_reminder&t=${Date.now()}`
    };

  } catch (error) {
    console.error('Error creating evening check-in reminder message:', error);
    return {
      title: "🌅 Daily Check-in Ending Soon",
      body: "⏰ Last chance today! Spin the wheel before 8 AM PST to earn points!",
      targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}?from=evening_checkin_reminder&t=${Date.now()}`
    };
  }
}

/**
 * Send evening check-in reminder to a single user
 * @param {number} userFid - User's Farcaster ID
 * @returns {object} Result of notification send
 */
export async function sendEveningCheckInReminder(userFid) {
  try {
    console.log(`Sending evening check-in reminder to FID: ${userFid}`);

    // Create personalized evening message
    const message = await createEveningCheckInReminderMessage(userFid);

    // Send notification via Neynar
    const result = await sendNotificationWithNeynar(userFid, message);

    if (result.success) {
      // Check if it was actually sent or just skipped
      if (result.skipped) {
        console.log(`⏭️ Skipped FID ${userFid}: ${result.reason || 'Notifications not enabled'}`);
        return {
          success: true, // ✅ Skipped is not a failure - it's expected when notifications are disabled
          skipped: true,
          userFid: userFid,
          reason: result.reason || 'Notifications not enabled'
        };
      }
      
      console.log(`✅ Evening check-in reminder sent successfully to FID: ${userFid}`);
      
      // Log notification in database
      await logNotificationSent(userFid, 'evening_checkin_reminder', message);
      
      return {
        success: true,
        userFid: userFid,
        message: message
      };
    } else {
      console.error(`❌ Failed to send evening check-in reminder to FID: ${userFid}`, result.error);
      return {
        success: false,
        userFid: userFid,
        error: result.error
      };
    }

  } catch (error) {
    console.error(`Error sending evening check-in reminder to FID: ${userFid}`, error);
    return {
      success: false,
      userFid: userFid,
      error: error.message
    };
  }
}

/**
 * Get all users who need afternoon check-in reminders (2 PM PST)
 * Similar to daily reminders but checks afternoon notification tracking
 * @returns {array} Array of user FIDs who need afternoon reminders
 */
export async function getUsersNeedingAfternoonReminders() {
  try {
    const adminClient = supabaseAdmin || supabase;
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();
    
    // Get all users who have notifications enabled
    // 🔧 FIX: Fetch ALL users, not just 1000 (Supabase default limit)
    let allProfiles = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: profilesBatch, error: profilesError } = await adminClient
        .from('profiles')
        .select('fid, last_afternoon_reminder_sent_date')
        .eq('has_notifications', true)
        .order('fid', { ascending: true })  // ✅ FIX: Ensure consistent ordering for pagination
        .range(from, from + batchSize - 1);

      if (profilesError) {
        console.error('Error fetching users with notifications:', profilesError);
        break;
      }

      if (profilesBatch && profilesBatch.length > 0) {
        allProfiles = allProfiles.concat(profilesBatch);
        console.log(`📥 Fetched batch: ${profilesBatch.length} users (total so far: ${allProfiles.length})`);
        
        // If we got fewer than batchSize, we've reached the end
        if (profilesBatch.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }

    const profilesData = allProfiles;

    if (!profilesData || profilesData.length === 0) {
      console.log('No users with notifications enabled');
      return [];
    }

    console.log(`Found ${profilesData.length} users with notifications enabled`);

    // Get users who haven't checked in today
    // 🔧 FIX: Batch the .in() query to avoid PostgreSQL limit on array size (typically ~1000)
    let leaderboardData = [];
    const LEADERBOARD_BATCH_SIZE = 1000;
    
    for (let i = 0; i < profilesData.length; i += LEADERBOARD_BATCH_SIZE) {
      const fidBatch = profilesData.slice(i, i + LEADERBOARD_BATCH_SIZE).map(p => p.fid);
      
      const { data: leaderboardBatch, error: leaderboardError } = await adminClient
        .from('user_leaderboard')
        .select('user_fid, last_checkin_date')
        .in('user_fid', fidBatch);

      if (leaderboardError) {
        console.error('Error fetching leaderboard data batch:', leaderboardError);
        continue; // Skip this batch but continue with others
      }
      
      if (leaderboardBatch) {
        leaderboardData.push(...leaderboardBatch);
      }
    }
    
    console.log(`📊 Fetched leaderboard data for ${leaderboardData.length} users`);

    // Filter users who need afternoon reminders
    const usersNeedingReminders = profilesData.filter(profile => {
      // DUPLICATE PREVENTION: Skip if we already sent an afternoon reminder today
      if (profile.last_afternoon_reminder_sent_date === currentCheckInDay) {
        return false;
      }

      const userLeaderboard = leaderboardData.find(lb => lb.user_fid === profile.fid);
      
      // If user has no leaderboard entry, they need a reminder
      if (!userLeaderboard) {
        return true;
      }

      // If user hasn't checked in today, they need an afternoon reminder
      return userLeaderboard.last_checkin_date !== currentCheckInDay;
    });

    console.log(`${usersNeedingReminders.length} users need afternoon check-in reminders`);
    console.log(`${profilesData.length - usersNeedingReminders.length} users filtered out (already checked in or already notified)`);
    
    return usersNeedingReminders.map(u => u.fid);
    
  } catch (error) {
    console.error('Error getting users needing afternoon reminders:', error);
    return [];
  }
}

/**
 * Get all users who need evening check-in reminders
 * Similar to daily reminders but checks evening notification tracking
 * @returns {array} Array of user FIDs who need evening reminders
 */
export async function getUsersNeedingEveningReminders() {
  try {
    const adminClient = supabaseAdmin || supabase;
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();
    
    // Get all users who have notifications enabled
    // 🔧 FIX: Fetch ALL users, not just 1000 (Supabase default limit)
    let allProfiles = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: profilesBatch, error: profilesError } = await adminClient
        .from('profiles')
        .select('fid, last_evening_reminder_sent_date')
        .eq('has_notifications', true)
        .order('fid', { ascending: true})  // ✅ FIX: Ensure consistent ordering for pagination
        .range(from, from + batchSize - 1);

      if (profilesError) {
        console.error('Error fetching users with notifications:', profilesError);
        break;
      }

      if (profilesBatch && profilesBatch.length > 0) {
        allProfiles = allProfiles.concat(profilesBatch);
        console.log(`📥 Fetched batch: ${profilesBatch.length} users (total so far: ${allProfiles.length})`);
        
        // If we got fewer than batchSize, we've reached the end
        if (profilesBatch.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }

    const profilesData = allProfiles;

    if (!profilesData || profilesData.length === 0) {
      console.log('No users with notifications enabled');
      return [];
    }

    console.log(`Found ${profilesData.length} users with notifications enabled`);

    // Get users who haven't checked in today
    // 🔧 FIX: Batch the .in() query to avoid PostgreSQL limit on array size (typically ~1000)
    let leaderboardData = [];
    const LEADERBOARD_BATCH_SIZE = 1000;
    
    for (let i = 0; i < profilesData.length; i += LEADERBOARD_BATCH_SIZE) {
      const fidBatch = profilesData.slice(i, i + LEADERBOARD_BATCH_SIZE).map(p => p.fid);
      
      const { data: leaderboardBatch, error: leaderboardError } = await adminClient
        .from('user_leaderboard')
        .select('user_fid, last_checkin_date')
        .in('user_fid', fidBatch);

      if (leaderboardError) {
        console.error('Error fetching leaderboard data batch:', leaderboardError);
        continue; // Skip this batch but continue with others
      }
      
      if (leaderboardBatch) {
        leaderboardData.push(...leaderboardBatch);
      }
    }
    
    console.log(`📊 Fetched leaderboard data for ${leaderboardData.length} users`);

    // Filter users who need evening reminders
    const usersNeedingReminders = profilesData.filter(profile => {
      // DUPLICATE PREVENTION: Skip if we already sent an evening reminder today
      if (profile.last_evening_reminder_sent_date === currentCheckInDay) {
        return false;
      }

      const userLeaderboard = leaderboardData.find(lb => lb.user_fid === profile.fid);
      
      // If user has no leaderboard entry, they need a reminder
      if (!userLeaderboard) {
        return true;
      }

      // If user hasn't checked in today, they need an evening reminder
      return userLeaderboard.last_checkin_date !== currentCheckInDay;
    });

    console.log(`${usersNeedingReminders.length} users need evening check-in reminders`);
    console.log(`${profilesData.length - usersNeedingReminders.length} users filtered out (already checked in or already notified)`);
    return usersNeedingReminders.map(u => u.fid);

  } catch (error) {
    console.error('Error in getUsersNeedingEveningReminders:', error);
    return [];
  }
}

/**
 * Send afternoon check-in reminders to all eligible users using BATCHED Neynar API (2 PM PST)
 * OPTIMIZED: Groups users by message type and sends in batch
 * @returns {object} Summary of notification results
 */
export async function sendAfternoonCheckInReminders() {
  try {
    console.log('☀️ Starting afternoon check-in reminder process...');
    console.log('📅 Current PST time:', formatPSTTime());

    const userFids = await getUsersNeedingAfternoonReminders();

    if (userFids.length === 0) {
      console.log('✅ No users need afternoon check-in reminders');
      return {
        success: true,
        totalUsers: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        results: []
      };
    }

    console.log(`📤 Sending afternoon check-in reminders to ${userFids.length} users using BATCH API...`);

    // Fetch leaderboard data and group by message
    const adminClient = supabaseAdmin || supabase;
    let allLeaderboardData = [];
    const LEADERBOARD_BATCH_SIZE = 1000;
    
    for (let i = 0; i < userFids.length; i += LEADERBOARD_BATCH_SIZE) {
      const fidBatch = userFids.slice(i, i + LEADERBOARD_BATCH_SIZE);
      const { data, error } = await adminClient
        .from('user_leaderboard')
        .select('user_fid, checkin_streak, total_points')
        .in('user_fid', fidBatch);
      
      if (!error && data) {
        allLeaderboardData.push(...data);
      }
    }
    
    const messageGroups = new Map();
    
    let skippedNoStreak = 0;
    
    for (const userFid of userFids) {
      const userData = allLeaderboardData.find(d => d.user_fid === userFid);
      const currentStreak = userData?.checkin_streak || 0;
      
      // OPTIMIZATION: Skip users with no active streak (currentStreak === 0)
      // These users have very low engagement (<1% open rate) and account for ~75% of notifications
      // This saves ~500K+ Neynar credits per day
      if (currentStreak === 0) {
        skippedNoStreak++;
        continue;
      }
      
      // OPTIMIZED: Use ranges instead of exact numbers to reduce API calls
      // Now only 4 groups (streak holders only)
      let messageBody;
      if (currentStreak >= 30) {
        messageBody = "🏆 Legendary streak! Don't forget to check in before 8 AM PST!";
      } else if (currentStreak >= 7) {
        messageBody = "🔥 You're on fire! Check in before 8 AM PST tomorrow!";
      } else if (currentStreak >= 3) {
        messageBody = "⚡ Nice streak! Don't forget to check in today!";
      } else {
        messageBody = "🎯 Keep your streak going! Check in today!";
      }
      
      if (!messageGroups.has(messageBody)) {
        messageGroups.set(messageBody, []);
      }
      messageGroups.get(messageBody).push(userFid);
    }
    
    console.log(`⏭️ Skipped ${skippedNoStreak} users with no active streak (0-day streak)`);
    const totalToNotify = userFids.length - skippedNoStreak;
    console.log(`📬 Will notify ${totalToNotify} users with active streaks`);
    
    const { sendBatchNotificationWithNeynar } = await import('./neynar.js');
    const allResults = [];
    let groupNumber = 0;
    
    for (const [messageBody, fids] of messageGroups.entries()) {
      groupNumber++;
      console.log(`📤 Sending batch ${groupNumber}/${messageGroups.size}: ${fids.length} users...`);
      
      const message = {
        title: "☀️ Afternoon Check-in Reminder",
        body: messageBody,
        targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}?from=afternoon_reminder&t=${Date.now()}`
      };
      
      const batchResult = await sendBatchNotificationWithNeynar(fids, message);
      
      if (batchResult.success && batchResult.results) {
        allResults.push(...batchResult.results);
        
        const successfulFids = batchResult.results
          .filter(r => r.success && !r.skipped)
          .map(r => r.userFid);
        
        if (successfulFids.length > 0) {
          await logBatchNotificationsSent(successfulFids, 'afternoon_checkin_reminder');
        }
      } else {
        allResults.push(...fids.map(fid => ({
          success: false,
          userFid: fid,
          error: batchResult.error || 'Batch send failed'
        })));
      }
    }
    
    const actuallySent = allResults.filter(r => r.success && !r.skipped).length;
    const skippedCount = allResults.filter(r => r.skipped).length;
    const actualFailures = allResults.filter(r => !r.success).length;

    console.log(`📊 Afternoon check-in reminder results:`);
    console.log(`   ✅ Successfully sent: ${actuallySent}`);
    console.log(`   ⏭️  Skipped (notifications disabled): ${skippedCount}`);
    console.log(`   ❌ Failed: ${actualFailures}`);
    console.log(`   📱 Total: ${allResults.length}`);
    console.log(`   🚀 API calls made: ${messageGroups.size}`);

    return {
      success: true,
      totalUsers: userFids.length,
      successCount: actuallySent,
      failureCount: actualFailures,
      skippedCount: skippedCount,
      results: allResults
    };

  } catch (error) {
    console.error('Error in sendAfternoonCheckInReminders:', error);
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

/**
 * Send evening check-in reminders to all eligible users using BATCHED Neynar API
 * OPTIMIZED: Groups users by message type and sends in batch
 * @returns {object} Summary of notification results
 */
export async function sendEveningCheckInReminders() {
  try {
    console.log('🌅 Starting evening check-in reminder process...');
    console.log('📅 Current PST time:', formatPSTTime());

    const userFids = await getUsersNeedingEveningReminders();

    if (userFids.length === 0) {
      console.log('✅ No users need evening check-in reminders');
      return {
        success: true,
        totalUsers: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        results: []
      };
    }

    console.log(`📤 Sending evening check-in reminders to ${userFids.length} users using BATCH API...`);

    // Fetch leaderboard data and group by message
    const adminClient = supabaseAdmin || supabase;
    let allLeaderboardData = [];
    const LEADERBOARD_BATCH_SIZE = 1000;
    
    for (let i = 0; i < userFids.length; i += LEADERBOARD_BATCH_SIZE) {
      const fidBatch = userFids.slice(i, i + LEADERBOARD_BATCH_SIZE);
      const { data, error } = await adminClient
        .from('user_leaderboard')
        .select('user_fid, checkin_streak, total_points')
        .in('user_fid', fidBatch);
      
      if (!error && data) {
        allLeaderboardData.push(...data);
      }
    }
    
    const messageGroups = new Map();
    
    let skippedNoStreak = 0;
    
    for (const userFid of userFids) {
      const userData = allLeaderboardData.find(d => d.user_fid === userFid);
      const currentStreak = userData?.checkin_streak || 0;
      
      // OPTIMIZATION: Skip users with no active streak (currentStreak === 0)
      // These users have very low engagement (<1% open rate) and account for ~75% of notifications
      // This saves ~500K+ Neynar credits per day
      if (currentStreak === 0) {
        skippedNoStreak++;
        continue;
      }
      
      // OPTIMIZED: Use ranges instead of exact numbers to reduce API calls
      // Now only 4 groups (streak holders only)
      let messageBody;
      if (currentStreak >= 30) {
        messageBody = "🏆 Last chance! Don't lose your legendary streak - spin now!";
      } else if (currentStreak >= 7) {
        messageBody = "🔥 Don't lose your streak! Check in before 8 AM PST tomorrow!";
      } else if (currentStreak >= 3) {
        messageBody = "⚡ Keep your streak alive! Check in before 8 AM PST tomorrow!";
      } else {
        messageBody = "🎯 Don't break your streak! Check in before 8 AM PST tomorrow!";
      }
      
      if (!messageGroups.has(messageBody)) {
        messageGroups.set(messageBody, []);
      }
      messageGroups.get(messageBody).push(userFid);
    }
    
    console.log(`⏭️ Skipped ${skippedNoStreak} users with no active streak (0-day streak)`);
    const totalToNotify = userFids.length - skippedNoStreak;
    console.log(`📬 Will notify ${totalToNotify} users with active streaks`);
    
    const { sendBatchNotificationWithNeynar } = await import('./neynar.js');
    const allResults = [];
    let groupNumber = 0;
    
    for (const [messageBody, fids] of messageGroups.entries()) {
      groupNumber++;
      console.log(`📤 Sending batch ${groupNumber}/${messageGroups.size}: ${fids.length} users...`);
      
      const message = {
        title: "🌅 Daily Check-in Ending Soon",
        body: messageBody,
        targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}?from=evening_checkin_reminder&t=${Date.now()}`
      };
      
      const batchResult = await sendBatchNotificationWithNeynar(fids, message);
      
      if (batchResult.success && batchResult.results) {
        allResults.push(...batchResult.results);
        
        const successfulFids = batchResult.results
          .filter(r => r.success && !r.skipped)
          .map(r => r.userFid);
        
        if (successfulFids.length > 0) {
          await logBatchNotificationsSent(successfulFids, 'evening_checkin_reminder');
        }
      } else {
        allResults.push(...fids.map(fid => ({
          success: false,
          userFid: fid,
          error: batchResult.error || 'Batch send failed'
        })));
      }
    }
    
    const actuallySent = allResults.filter(r => r.success && !r.skipped).length;
    const skippedCount = allResults.filter(r => r.skipped).length;
    const actualFailures = allResults.filter(r => !r.success).length;

    console.log(`📊 Evening check-in reminder results:`);
    console.log(`   ✅ Successfully sent: ${actuallySent}`);
    console.log(`   ⏭️  Skipped (notifications disabled): ${skippedCount}`);
    console.log(`   ❌ Failed: ${actualFailures}`);
    console.log(`   📱 Total: ${allResults.length}`);
    console.log(`   🚀 API calls made: ${messageGroups.size}`);

    return {
      success: true,
      totalUsers: userFids.length,
      successCount: actuallySent,
      failureCount: actualFailures,
      skippedCount: skippedCount,
      results: allResults
    };

  } catch (error) {
    console.error('Error in sendEveningCheckInReminders:', error);
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

/**
 * Test function to send a single check-in reminder
 * @param {number} userFid - User's Farcaster ID to test
 * @returns {object} Test result
 */
export async function testCheckInReminder(userFid) {
  console.log(`🧪 Testing check-in reminder for FID: ${userFid}`);
  
  try {
    const result = await sendCheckInReminder(userFid);
    
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

// ============================================
// STAKING REMINDER NOTIFICATIONS (1 PM PST)
// ============================================

/**
 * Check if it's time to send staking reminder notifications (1 PM PST)
 * @returns {boolean} True if it's staking reminder notification time
 */
export function shouldSendStakingReminders() {
  return isStakingReminderTime();
}

/**
 * Get all users who have tokens staked and have notifications enabled
 * Uses the subgraph to get current stakers, then matches with profiles
 * @returns {array} Array of { fid, walletAddress, stakedAmount } for users who need staking reminders
 */
export async function getUsersWithStakedBalances() {
  try {
    const adminClient = supabaseAdmin || supabase;
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();
    
    // Step 1: Get all stakers with balances > 0 from the subgraph
    const { getAllStakerBalances } = await import('./stakingBalanceAPI.js');
    const stakerBalances = await getAllStakerBalances();
    
    if (stakerBalances.size === 0) {
      console.log('📊 No stakers found in subgraph');
      return [];
    }
    
    console.log(`📊 Found ${stakerBalances.size} stakers with balances in subgraph`);
    
    // Filter to only stakers with balance > 0
    const activeStakers = Array.from(stakerBalances.entries())
      .filter(([_, balance]) => balance > 0)
      .map(([wallet, balance]) => ({ wallet: wallet.toLowerCase(), balance }));
    
    console.log(`📊 ${activeStakers.length} stakers have balance > 0`);
    
    if (activeStakers.length === 0) {
      return [];
    }
    
    // Step 2: Fetch profiles that have notifications enabled and match staker wallets
    // We need to check multiple wallet columns: primary_eth_address, custody_address, verified_eth_addresses
    let allProfiles = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: profilesBatch, error: profilesError } = await adminClient
        .from('profiles')
        .select('fid, primary_eth_address, custody_address, verified_eth_addresses, last_staking_reminder_sent_date')
        .eq('has_notifications', true)
        .order('fid', { ascending: true })
        .range(from, from + batchSize - 1);

      if (profilesError) {
        console.error('Error fetching profiles with notifications:', profilesError);
        break;
      }

      if (profilesBatch && profilesBatch.length > 0) {
        allProfiles = allProfiles.concat(profilesBatch);
        
        if (profilesBatch.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Found ${allProfiles.length} users with notifications enabled`);
    
    // Step 3: Match profiles to stakers
    const usersWithStakes = [];
    const stakerWalletSet = new Set(activeStakers.map(s => s.wallet));
    
    for (const profile of allProfiles) {
      // Skip if already sent reminder today
      if (profile.last_staking_reminder_sent_date === currentCheckInDay) {
        continue;
      }
      
      // Get all wallet addresses for this user
      const userWallets = [];
      if (profile.primary_eth_address) {
        userWallets.push(profile.primary_eth_address.toLowerCase());
      }
      if (profile.custody_address) {
        userWallets.push(profile.custody_address.toLowerCase());
      }
      if (profile.verified_eth_addresses && Array.isArray(profile.verified_eth_addresses)) {
        userWallets.push(...profile.verified_eth_addresses.map(w => w.toLowerCase()));
      }
      
      // Check if any of user's wallets are in the stakers list
      let userStakedAmount = 0;
      let matchedWallet = null;
      
      for (const wallet of userWallets) {
        if (stakerWalletSet.has(wallet)) {
          const staker = activeStakers.find(s => s.wallet === wallet);
          if (staker && staker.balance > 0) {
            userStakedAmount += staker.balance;
            matchedWallet = wallet;
          }
        }
      }
      
      if (userStakedAmount > 0) {
        usersWithStakes.push({
          fid: profile.fid,
          walletAddress: matchedWallet,
          stakedAmount: userStakedAmount
        });
      }
    }
    
    console.log(`📊 ${usersWithStakes.length} users with staked balances need staking reminders`);
    return usersWithStakes;
    
  } catch (error) {
    console.error('Error in getUsersWithStakedBalances:', error);
    return [];
  }
}

/**
 * Create staking reminder message
 * @param {number} stakedAmount - User's staked amount in tokens
 * @returns {object} Notification message object
 */
export function createStakingReminderMessage(stakedAmount) {
  const formattedAmount = Math.floor(stakedAmount).toLocaleString();
  
  return {
    title: "💎 Your Staking Rewards Await!",
    body: `You have ${formattedAmount} $mintedmerch staked! Spin to claim your daily rewards 🎰`,
    targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/stake?from=staking_reminder&t=${Date.now()}`
  };
}

/**
 * Send staking reminder to a single user
 * @param {number} userFid - User's Farcaster ID
 * @param {number} stakedAmount - User's staked amount
 * @returns {object} Result of notification send
 */
export async function sendStakingReminder(userFid, stakedAmount) {
  try {
    console.log(`Sending staking reminder to FID: ${userFid}`);

    const message = createStakingReminderMessage(stakedAmount);
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

    // Get users with staked balances who need reminders
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

    // Group users by staked amount ranges for message personalization
    const messageGroups = new Map();
    
    for (const user of usersWithStakes) {
      const formattedAmount = Math.floor(user.stakedAmount).toLocaleString();
      
      // Create a message body - group by amount ranges to reduce API calls
      let messageBody;
      if (user.stakedAmount >= 100_000_000) { // 100M+
        messageBody = "🏆 Whale alert! Your massive stake is earning rewards - spin to claim! 🎰";
      } else if (user.stakedAmount >= 10_000_000) { // 10M+
        messageBody = "💎 Your big stake is working hard! Spin to claim daily rewards 🎰";
      } else if (user.stakedAmount >= 1_000_000) { // 1M+
        messageBody = "🔥 Your stake is earning! Spin the wheel to claim rewards 🎰";
      } else {
        messageBody = "💰 Your staked tokens are earning! Spin to claim your rewards 🎰";
      }
      
      if (!messageGroups.has(messageBody)) {
        messageGroups.set(messageBody, []);
      }
      messageGroups.get(messageBody).push(user.fid);
    }
    
    console.log(`📊 Grouped users into ${messageGroups.size} message types`);
    messageGroups.forEach((fids, message) => {
      console.log(`   "${message.substring(0, 50)}..." → ${fids.length} users`);
    });
    
    // Send batch notifications for each message group
    const { sendBatchNotificationWithNeynar } = await import('./neynar.js');
    const allResults = [];
    let groupNumber = 0;
    
    for (const [messageBody, fids] of messageGroups.entries()) {
      groupNumber++;
      console.log(`📤 Sending batch ${groupNumber}/${messageGroups.size}: ${fids.length} users...`);
      
      const message = {
        title: "💎 Your Staking Rewards Await!",
        body: messageBody,
        targetUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/stake?from=staking_reminder&t=${Date.now()}`
      };
      
      const batchResult = await sendBatchNotificationWithNeynar(fids, message);
      
      if (batchResult.success && batchResult.results) {
        allResults.push(...batchResult.results);
        
        // Log successful notifications to database
        const successfulFids = batchResult.results
          .filter(r => r.success && !r.skipped)
          .map(r => r.userFid);
        
        if (successfulFids.length > 0) {
          await logBatchNotificationsSent(successfulFids, 'staking_reminder');
        }
      } else {
        // If batch failed, mark all as failures
        allResults.push(...fids.map(fid => ({
          success: false,
          userFid: fid,
          error: batchResult.error || 'Batch send failed'
        })));
      }
    }
    
    // Count results
    const actuallySent = allResults.filter(r => r.success && !r.skipped).length;
    const skippedCount = allResults.filter(r => r.skipped).length;
    const actualFailures = allResults.filter(r => !r.success).length;

    console.log(`📊 Staking reminder results:`);
    console.log(`   ✅ Successfully sent: ${actuallySent}`);
    console.log(`   ⏭️  Skipped (notifications disabled): ${skippedCount}`);
    console.log(`   ❌ Failed: ${actualFailures}`);
    console.log(`   📱 Total: ${allResults.length}`);
    console.log(`   🚀 API calls made: ${messageGroups.size}`);

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