// Daily check-in notification system
// Handles sending reminders at 8 AM PST every day

import { supabase } from './supabase.js';
import { sendNotificationWithNeynar } from './neynar.js';
import { getCurrentPSTTime, formatPSTTime, isNotificationTime } from './timezone.js';

/**
 * Get all users who have notifications enabled and haven't checked in today
 * @returns {array} Array of user FIDs who need check-in reminders
 */
export async function getUsersNeedingCheckInReminders() {
  try {
    // Get all users who have notifications enabled
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('fid')
      .eq('has_notifications', true);

    if (profilesError) {
      console.error('Error fetching users with notifications:', profilesError);
      return [];
    }

    if (!profilesData || profilesData.length === 0) {
      console.log('No users with notifications enabled');
      return [];
    }

    // Get current check-in day
    const { getCurrentCheckInDay } = await import('./timezone.js');
    const currentCheckInDay = getCurrentCheckInDay();

    // Get users who haven't checked in today
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('user_leaderboard')
      .select('user_fid, last_checkin_date')
      .in('user_fid', profilesData.map(p => p.fid));

    if (leaderboardError) {
      console.error('Error fetching leaderboard data:', leaderboardError);
      return [];
    }

    // Filter users who need reminders
    const usersNeedingReminders = profilesData.filter(profile => {
      const userLeaderboard = leaderboardData.find(lb => lb.user_fid === profile.fid);
      
      // If user has no leaderboard entry, they need a reminder
      if (!userLeaderboard) {
        return true;
      }

      // If user hasn't checked in today, they need a reminder
      return userLeaderboard.last_checkin_date !== currentCheckInDay;
    });

    console.log(`Found ${usersNeedingReminders.length} users needing check-in reminders`);
    return usersNeedingReminders.map(user => user.fid);

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
      targetUrl: "https://mintedmerch.vercel.app?from=checkin_reminder&t=" + Date.now()
    };

  } catch (error) {
    console.error('Error creating check-in reminder message:', error);
    return {
      title: "🎯 Daily Check-in Time",
      body: "Spin the wheel to earn points and be entered into raffles for FREE merch!",
      targetUrl: "https://mintedmerch.vercel.app?from=checkin_reminder&t=" + Date.now()
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
      console.log(`✅ Check-in reminder sent successfully to FID: ${userFid}`);
      
      // Log notification in database (optional)
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
 * Send check-in reminders to all eligible users
 * @returns {object} Summary of notification results
 */
export async function sendDailyCheckInReminders() {
  try {
    console.log('🚀 Starting daily check-in reminder process...');
    console.log('📅 Current PST time:', formatPSTTime());

    // Get users who need reminders
    const userFids = await getUsersNeedingCheckInReminders();

    if (userFids.length === 0) {
      console.log('✅ No users need check-in reminders');
      return {
        success: true,
        totalUsers: 0,
        successCount: 0,
        failureCount: 0,
        results: []
      };
    }

    console.log(`📤 Sending check-in reminders to ${userFids.length} users...`);

    // Send reminders to all users
    const results = await Promise.allSettled(
      userFids.map(userFid => sendCheckInReminder(userFid))
    );

    // Count successes and failures
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failureCount = results.length - successCount;

    console.log(`📊 Check-in reminder results:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   📱 Total: ${results.length}`);

    return {
      success: true,
      totalUsers: userFids.length,
      successCount: successCount,
      failureCount: failureCount,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    };

  } catch (error) {
    console.error('Error in sendDailyCheckInReminders:', error);
    return {
      success: false,
      error: error.message,
      totalUsers: 0,
      successCount: 0,
      failureCount: 0,
      results: []
    };
  }
}

/**
 * Log notification sent to database (optional tracking)
 * @param {number} userFid - User's Farcaster ID
 * @param {string} type - Notification type
 * @param {object} message - Message content
 */
async function logNotificationSent(userFid, type, message) {
  try {
    // This could be expanded to track notification history
    console.log(`📝 Logged ${type} notification for FID: ${userFid}`);
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