// Points system utility functions for daily check-in system
// Handles check-ins, point awards, streaks, and leaderboard operations

import { supabase } from './supabase.js';

/**
 * Get user's current leaderboard data
 * @param {number} userFid - Farcaster ID of the user
 * @returns {object} User's leaderboard data or null if not found
 */
export async function getUserLeaderboardData(userFid) {
  try {
    const { data, error } = await supabase
      .from('user_leaderboard')
      .select('*')
      .eq('user_fid', userFid)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching user leaderboard data:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserLeaderboardData:', error);
    return null;
  }
}

/**
 * Initialize a new user in the leaderboard
 * @param {number} userFid - Farcaster ID of the user
 * @returns {object} Created leaderboard entry or null if error
 */
export async function initializeUserLeaderboard(userFid) {
  try {
    const { data, error } = await supabase
      .from('user_leaderboard')
      .insert({
        user_fid: userFid,
        total_points: 0,
        checkin_streak: 0,
        last_checkin_date: null
      })
      .select()
      .single();

    if (error) {
      console.error('Error initializing user leaderboard:', error);
      return null;
    }

    console.log(`Initialized leaderboard for user ${userFid}`);
    return data;
  } catch (error) {
    console.error('Error in initializeUserLeaderboard:', error);
    return null;
  }
}

/**
 * Check if user can check in today
 * @param {number} userFid - Farcaster ID of the user
 * @returns {boolean} True if user can check in today, false otherwise
 */
export async function canCheckInToday(userFid) {
  try {
    const userData = await getUserLeaderboardData(userFid);
    
    if (!userData) {
      // New user, can check in
      return true;
    }

    if (!userData.last_checkin_date) {
      // User exists but never checked in, can check in
      return true;
    }

    // Check if last check-in was before today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const lastCheckin = userData.last_checkin_date;

    return lastCheckin !== today;
  } catch (error) {
    console.error('Error in canCheckInToday:', error);
    return false;
  }
}

/**
 * Calculate streak for check-in
 * @param {string|null} lastCheckinDate - Last check-in date (YYYY-MM-DD format)
 * @param {number} currentStreak - Current streak count
 * @returns {number} New streak count
 */
function calculateNewStreak(lastCheckinDate, currentStreak) {
  if (!lastCheckinDate) {
    // First check-in ever
    return 1;
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastCheckin = new Date(lastCheckinDate);
  const yesterdayString = yesterday.toISOString().split('T')[0];
  const lastCheckinString = lastCheckin.toISOString().split('T')[0];

  if (lastCheckinString === yesterdayString) {
    // Consecutive day, increment streak
    return currentStreak + 1;
  } else {
    // Streak broken, start new streak
    return 1;
  }
}

/**
 * Generate random points for daily check-in
 * Weighted distribution: lower values more common
 * @returns {number} Points between 25-100
 */
function generateRandomCheckinPoints() {
  const random = Math.random();
  
  // Weighted distribution (lower values more likely)
  if (random < 0.4) {
    // 40% chance: 25-50 points
    return Math.floor(Math.random() * 26) + 25; // 25-50
  } else if (random < 0.75) {
    // 35% chance: 51-75 points
    return Math.floor(Math.random() * 25) + 51; // 51-75
  } else {
    // 25% chance: 76-100 points
    return Math.floor(Math.random() * 25) + 76; // 76-100
  }
}

/**
 * Apply streak bonus to check-in points
 * @param {number} basePoints - Base points from spin
 * @param {number} streak - Current streak count
 * @returns {number} Points with streak bonus applied
 */
function applyStreakBonus(basePoints, streak) {
  if (streak >= 30) {
    // 30+ days: 3x multiplier
    return Math.floor(basePoints * 3);
  } else if (streak >= 7) {
    // 7+ days: 2x multiplier
    return Math.floor(basePoints * 2);
  } else if (streak >= 3) {
    // 3+ days: 1.5x multiplier
    return Math.floor(basePoints * 1.5);
  } else {
    // 1-2 days: no bonus
    return basePoints;
  }
}

/**
 * Perform daily check-in for user
 * @param {number} userFid - Farcaster ID of the user
 * @returns {object} Check-in result with points earned and streak info
 */
export async function performDailyCheckin(userFid) {
  try {
    // Check if user can check in today
    const canCheckin = await canCheckInToday(userFid);
    if (!canCheckin) {
      return {
        success: false,
        error: 'Already checked in today',
        alreadyCheckedIn: true
      };
    }

    // Get or create user data
    let userData = await getUserLeaderboardData(userFid);
    if (!userData) {
      userData = await initializeUserLeaderboard(userFid);
      if (!userData) {
        return {
          success: false,
          error: 'Failed to initialize user leaderboard'
        };
      }
    }

    // Calculate new streak
    const newStreak = calculateNewStreak(
      userData.last_checkin_date, 
      userData.checkin_streak
    );

    // Generate random points for check-in
    const basePoints = generateRandomCheckinPoints();
    
    // Apply streak bonus
    const finalPoints = applyStreakBonus(basePoints, newStreak);

    // Update user leaderboard
    const today = new Date().toISOString().split('T')[0];
    const { data: updatedData, error } = await supabase
      .from('user_leaderboard')
      .update({
        total_points: userData.total_points + finalPoints,
        last_checkin_date: today,
        checkin_streak: newStreak
      })
      .eq('user_fid', userFid)
      .select()
      .single();

    if (error) {
      console.error('Error updating leaderboard for check-in:', error);
      return {
        success: false,
        error: 'Failed to update leaderboard'
      };
    }

    console.log(`Check-in successful for user ${userFid}: +${finalPoints} points (streak: ${newStreak})`);

    return {
      success: true,
      pointsEarned: finalPoints,
      basePoints: basePoints,
      streakBonus: finalPoints - basePoints,
      newStreak: newStreak,
      totalPoints: updatedData.total_points,
      streakBroken: newStreak === 1 && userData.checkin_streak > 1
    };

  } catch (error) {
    console.error('Error in performDailyCheckin:', error);
    return {
      success: false,
      error: 'Unexpected error during check-in'
    };
  }
}

/**
 * Add points to user from purchase
 * @param {number} userFid - Farcaster ID of the user
 * @param {number} orderTotal - Order total in dollars
 * @param {string} orderId - Order ID for reference
 * @returns {object} Result of point addition
 */
export async function addPurchasePoints(userFid, orderTotal, orderId) {
  try {
    // Calculate points: 200% of order total (minimum 10 points)
    const points = Math.max(Math.floor(orderTotal * 2.0), 10);

    // Get or create user data
    let userData = await getUserLeaderboardData(userFid);
    if (!userData) {
      userData = await initializeUserLeaderboard(userFid);
      if (!userData) {
        return {
          success: false,
          error: 'Failed to initialize user leaderboard'
        };
      }
    }

    // Update user points
    const { data: updatedData, error } = await supabase
      .from('user_leaderboard')
      .update({
        total_points: userData.total_points + points
      })
      .eq('user_fid', userFid)
      .select()
      .single();

    if (error) {
      console.error('Error adding purchase points:', error);
      return {
        success: false,
        error: 'Failed to add purchase points'
      };
    }

    console.log(`Purchase points added for user ${userFid}: +${points} points (order: ${orderId})`);

    return {
      success: true,
      pointsEarned: points,
      orderTotal: orderTotal,
      orderId: orderId,
      totalPoints: updatedData.total_points
    };

  } catch (error) {
    console.error('Error in addPurchasePoints:', error);
    return {
      success: false,
      error: 'Unexpected error adding purchase points'
    };
  }
}

/**
 * Get leaderboard data
 * @param {number} limit - Number of top users to return (default: 10)
 * @param {string} timeframe - 'all', 'monthly', 'weekly' (default: 'all')
 * @returns {array} Array of leaderboard entries
 */
export async function getLeaderboard(limit = 10, timeframe = 'all') {
  try {
    let query = supabase
      .from('user_leaderboard')
      .select('user_fid, total_points, checkin_streak, last_checkin_date, created_at')
      .order('total_points', { ascending: false })
      .limit(limit);

    // For MVP, we only support 'all' timeframe
    // TODO: Add monthly/weekly filtering when we have point transactions table
    if (timeframe !== 'all') {
      console.warn(`Timeframe '${timeframe}' not yet implemented, using 'all'`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    return [];
  }
}

/**
 * Get user's leaderboard position
 * @param {number} userFid - Farcaster ID of the user
 * @returns {object} User's position and stats
 */
export async function getUserLeaderboardPosition(userFid) {
  try {
    // Get user's current points
    const userData = await getUserLeaderboardData(userFid);
    if (!userData) {
      return {
        position: null,
        totalPoints: 0,
        streak: 0
      };
    }

    // Count users with more points
    const { count, error } = await supabase
      .from('user_leaderboard')
      .select('user_fid', { count: 'exact' })
      .gt('total_points', userData.total_points);

    if (error) {
      console.error('Error calculating leaderboard position:', error);
      return {
        position: null,
        totalPoints: userData.total_points,
        streak: userData.checkin_streak
      };
    }

    return {
      position: count + 1, // Position is count + 1 (1st place, 2nd place, etc.)
      totalPoints: userData.total_points,
      streak: userData.checkin_streak,
      lastCheckin: userData.last_checkin_date
    };

  } catch (error) {
    console.error('Error in getUserLeaderboardPosition:', error);
    return {
      position: null,
      totalPoints: 0,
      streak: 0
    };
  }
} 