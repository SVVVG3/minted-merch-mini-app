// Points system utility functions for daily check-in system
// Handles check-ins, point awards, streaks, and leaderboard operations

import { supabase, supabaseAdmin } from './supabase.js';
import { 
  getCurrentCheckInDay, 
  canCheckInTodayPST, 
  calculateStreakPST 
} from './timezone.js';

/**
 * Get user's current leaderboard data
 * @param {number} userFid - Farcaster ID of the user
 * @returns {object} User's leaderboard data or null if not found
 */
export async function getUserLeaderboardData(userFid) {
  try {
    const { data, error } = await supabaseAdmin
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
    const { data, error } = await supabaseAdmin
      .from('user_leaderboard')
      .insert({
        user_fid: userFid,
        total_points: 0,
        checkin_streak: 0,
        last_checkin_date: null,
        total_orders: 0,
        total_spent: 0.00,
        points_from_purchases: 0,
        points_from_checkins: 0
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
 * Check if user can check in today (PST timezone with 8 AM reset)
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

    // Use PST timezone logic with 8 AM reset
    return canCheckInTodayPST(userData.last_checkin_date);
  } catch (error) {
    console.error('Error in canCheckInToday:', error);
    return false;
  }
}

/**
 * Calculate streak for check-in (PST timezone with 8 AM reset)
 * @param {string|null} lastCheckinDate - Last check-in date (YYYY-MM-DD format)
 * @param {number} currentStreak - Current streak count
 * @returns {number} New streak count
 */
function calculateNewStreak(lastCheckinDate, currentStreak) {
  // Use PST timezone logic with 8 AM reset
  return calculateStreakPST(lastCheckinDate, currentStreak);
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
export async function performDailyCheckin(userFid, txHash = null, skipBlockchainCheck = false) {
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

    // Update user leaderboard with PST check-in day
    const checkInDay = getCurrentCheckInDay();
    const { data: updatedData, error } = await supabaseAdmin
      .from('user_leaderboard')
      .update({
        total_points: userData.total_points + finalPoints,
        points_from_checkins: (userData.points_from_checkins || 0) + finalPoints,
        last_checkin_date: checkInDay,
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

    // Log the point transaction (with optional blockchain data)
    try {
      const transactionData = {
        userFid: userFid,
        transactionType: 'daily_checkin',
        pointsEarned: finalPoints,
        pointsBefore: userData.total_points,
        pointsAfter: updatedData.total_points,
        description: txHash ? `On-chain daily check-in (streak: ${newStreak})` : `Daily check-in (streak: ${newStreak})`,
        referenceId: `checkin-${userFid}-${checkInDay}`,
        metadata: {
          basePoints: basePoints,
          streakBonus: finalPoints - basePoints,
          streak: newStreak,
          checkInDay: checkInDay,
          onChain: !!txHash,
          txHash: txHash || null
        }
      };

      // For on-chain spins, update the existing pending transaction instead of creating new one
      if (txHash) {
        // Find and update the pending transaction
        const { data: pendingTx, error: findError } = await supabase
          .from('point_transactions')
          .select('id')
          .eq('user_fid', userFid)
          .eq('transaction_type', 'daily_checkin')
          .eq('spin_tx_hash', null)
          .is('spin_confirmed_at', null)
          .not('spin_reserved_at', 'is', null)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within last 24 hours
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (pendingTx && !findError) {
          console.log('🔄 Updating existing pending transaction:', pendingTx.id);
          // Update the existing pending transaction
          const { error: updateError } = await supabase
            .from('point_transactions')
            .update({
              points_earned: finalPoints,
              points_before: userData.total_points,
              points_after: updatedData.total_points,
              description: `On-chain daily check-in (streak: ${newStreak})`,
              spin_tx_hash: txHash,
              spin_confirmed_at: new Date().toISOString(),
              metadata: transactionData.metadata
            })
            .eq('id', pendingTx.id);

          if (updateError) {
            console.error('Error updating pending transaction:', updateError);
            // Fall back to creating new transaction
            await logPointTransaction(transactionData);
          } else {
            console.log('✅ Updated pending transaction with points and confirmation');
          }
        } else {
          console.log('⚠️ No pending transaction found, creating new one');
          transactionData.spin_tx_hash = txHash;
          transactionData.spin_confirmed_at = new Date().toISOString();
          await logPointTransaction(transactionData);
        }
      } else {
        // For off-chain check-ins, create new transaction as usual
        await logPointTransaction(transactionData);
      }
    } catch (logError) {
      console.error('Error logging check-in transaction:', logError);
      // Don't fail the check-in, just log the error
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
 * Add points to user from purchase and update purchase tracking
 * @param {number} userFid - Farcaster ID of the user
 * @param {number} orderTotal - Order total in dollars
 * @param {string} orderId - Order ID for reference
 * @returns {object} Result of point addition
 */
export async function addPurchasePoints(userFid, orderTotal, orderId) {
  try {
    // Calculate points: 500% of order total (minimum 10 points)
    const points = Math.max(Math.floor(orderTotal * 5.0), 10);

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

    // Update user leaderboard with purchase tracking  
    const adminClient = supabaseAdmin || supabase;
    const { data: updatedData, error } = await adminClient
      .from('user_leaderboard')
      .update({
        total_points: userData.total_points + points,
        total_orders: userData.total_orders + 1,
        total_spent: userData.total_spent + orderTotal,
        points_from_purchases: userData.points_from_purchases + points
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

    // Also update profiles table for purchase tracking
    // First get current values, then increment them
    const { data: currentProfile, error: fetchError } = await adminClient
      .from('profiles')
      .select('total_orders, total_spent')
      .eq('fid', userFid)
      .single();

    if (!fetchError && currentProfile) {
      const { error: profileError } = await adminClient
        .from('profiles')
        .update({
          total_orders: (currentProfile.total_orders || 0) + 1,
          total_spent: (parseFloat(currentProfile.total_spent) || 0) + parseFloat(orderTotal)
        })
        .eq('fid', userFid);

      if (profileError) {
        console.error('Error updating profiles purchase tracking:', profileError);
        // Don't fail the entire operation, just log the error
      }
    } else {
      console.error('Error fetching current profile for purchase tracking:', fetchError);
    }

    // Log the point transaction
    try {
      await logPointTransaction({
        userFid: userFid,
        transactionType: 'purchase',
        pointsEarned: points,
        pointsBefore: userData.total_points,
        pointsAfter: updatedData.total_points,
        description: `Purchase order (500% of $${orderTotal.toFixed(2)})`,
        referenceId: orderId,
        metadata: {
          orderTotal: orderTotal,
          orderId: orderId,
          pointsMultiplier: 5.0
        }
      });
    } catch (logError) {
      console.error('Error logging purchase transaction:', logError);
      // Don't fail the purchase points, just log the error
    }

    console.log(`Purchase points added for user ${userFid}: +${points} points, order count: ${updatedData.total_orders}, total spent: $${updatedData.total_spent} (order: ${orderId})`);

    return {
      success: true,
      pointsEarned: points,
      orderTotal: orderTotal,
      orderId: orderId,
      totalPoints: updatedData.total_points,
      totalOrders: updatedData.total_orders,
      totalSpent: updatedData.total_spent,
      pointsFromPurchases: updatedData.points_from_purchases
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
 * @param {string} category - 'points', 'streaks', 'purchases', 'spending' (default: 'points')
 * @returns {array} Array of leaderboard entries
 */
export async function getLeaderboard(limit = 10, category = 'points') {
  try {
    let query = supabaseAdmin
      .from('user_leaderboard')
      .select(`
        user_fid, 
        username, 
        total_points, 
        checkin_streak, 
        last_checkin_date, 
        total_orders, 
        total_spent, 
        points_from_purchases, 
        points_from_checkins, 
        created_at,
        profiles!inner (
          display_name,
          pfp_url
        )
      `)
      .limit(limit);

    // Sort based on category
    switch (category) {
      case 'points':
        query = query.order('total_points', { ascending: false });
        break;
      case 'streaks':
        query = query
          .order('checkin_streak', { ascending: false })
          .order('total_points', { ascending: false }); // Secondary sort by points
        break;
      case 'purchases':
        // Filter to only show users who have made purchases, then sort by points from purchases
        query = query
          .gt('total_orders', 0)
          .order('points_from_purchases', { ascending: false })
          .order('total_orders', { ascending: false });
        break;
      case 'spending':
        // Sort by total amount spent
        query = query
          .order('total_spent', { ascending: false })
          .order('total_orders', { ascending: false }); // Secondary sort by order count
        break;
      default:
        console.warn(`Category '${category}' not recognized, using 'points'`);
        query = query.order('total_points', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    // Add category-specific display information and flatten profile data
    const enhancedData = (data || []).map((user, index) => ({
      ...user,
      display_name: user.profiles?.display_name || user.username,
      pfp_url: user.profiles?.pfp_url || null,
      rank: index + 1,
      category: category
    }));

    return enhancedData;
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
        streak: 0,
        totalOrders: 0,
        totalSpent: 0,
        pointsFromPurchases: 0
      };
    }

    // Count users with more points
    const { count, error } = await supabaseAdmin
      .from('user_leaderboard')
      .select('user_fid', { count: 'exact' })
      .gt('total_points', userData.total_points);

    if (error) {
      console.error('Error calculating leaderboard position:', error);
      return {
        position: null,
        totalPoints: userData.total_points,
        streak: userData.checkin_streak,
        totalOrders: userData.total_orders || 0,
        totalSpent: userData.total_spent || 0,
        pointsFromPurchases: userData.points_from_purchases || 0
      };
    }

    return {
      position: count + 1, // Position is count + 1 (1st place, 2nd place, etc.)
      totalPoints: userData.total_points,
      streak: userData.checkin_streak,
      lastCheckin: userData.last_checkin_date,
      totalOrders: userData.total_orders || 0,
      totalSpent: userData.total_spent || 0,
      pointsFromPurchases: userData.points_from_purchases || 0
    };

  } catch (error) {
    console.error('Error in getUserLeaderboardPosition:', error);
    return {
      position: null,
      totalPoints: 0,
      streak: 0,
      totalOrders: 0,
      totalSpent: 0,
      pointsFromPurchases: 0
    };
  }
}

/**
 * Sync existing order data to populate purchase tracking columns
 * This function should be run once to populate the new columns with existing data
 * @param {number} userFid - Farcaster ID of the user (optional - if not provided, syncs all users)
 * @returns {object} Result of sync operation
 */
export async function syncPurchaseTracking(userFid = null) {
  try {
    let query = supabaseAdmin
      .from('orders')
      .select('fid, amount_total')
      .in('status', ['paid', 'shipped']); // Count both paid and shipped orders

    if (userFid) {
      query = query.eq('fid', userFid);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Error fetching orders for sync:', ordersError);
      return { success: false, error: 'Failed to fetch orders' };
    }

    // Group orders by user
    const userOrderStats = {};
    orders.forEach(order => {
      const fid = order.fid;
      if (!userOrderStats[fid]) {
        userOrderStats[fid] = { totalOrders: 0, totalSpent: 0 };
      }
      userOrderStats[fid].totalOrders++;
      userOrderStats[fid].totalSpent += parseFloat(order.amount_total);
    });

    let successCount = 0;
    let errorCount = 0;

    // Update each user's stats
    for (const [fid, stats] of Object.entries(userOrderStats)) {
      const userFidNum = parseInt(fid);
      
      // Calculate points from purchases (500% of total spent)
      const pointsFromPurchases = Math.floor(stats.totalSpent * 5.0);

      // Check if user exists in leaderboard, if not create them
      const { data: existingUser } = await supabaseAdmin
        .from('user_leaderboard')
        .select('user_fid, total_points')
        .eq('user_fid', userFidNum)
        .single();

      let leaderboardError = null;

      if (!existingUser) {
        // Create new leaderboard entry for users who have orders but haven't checked in
        const { error } = await supabaseAdmin
          .from('user_leaderboard')
          .insert({
            user_fid: userFidNum,
            total_points: pointsFromPurchases, // Start with purchase points
            checkin_streak: 0,
            last_checkin_date: null,
            total_orders: stats.totalOrders,
            total_spent: stats.totalSpent,
            points_from_purchases: pointsFromPurchases
          });
        leaderboardError = error;
      } else {
        // Update existing leaderboard entry
        const { error } = await supabaseAdmin
          .from('user_leaderboard')
          .update({
            total_orders: stats.totalOrders,
            total_spent: stats.totalSpent,
            points_from_purchases: pointsFromPurchases,
            total_points: existingUser.total_points + pointsFromPurchases // Add purchase points to existing points
          })
          .eq('user_fid', userFidNum);
        leaderboardError = error;
      }

      // Update profiles  
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          total_orders: stats.totalOrders,
          total_spent: stats.totalSpent
        })
        .eq('fid', userFidNum);

      if (leaderboardError || profileError) {
        console.error(`Error updating user ${fid}:`, leaderboardError || profileError);
        errorCount++;
      } else {
        console.log(`Synced user ${fid}: ${stats.totalOrders} orders, $${stats.totalSpent} spent, ${pointsFromPurchases} points`);
        successCount++;
      }
    }

    return {
      success: true,
      usersProcessed: Object.keys(userOrderStats).length,
      successCount,
      errorCount
    };

  } catch (error) {
    console.error('Error in syncPurchaseTracking:', error);
    return { success: false, error: 'Unexpected error during sync' };
  }
}

/**
 * Log a point transaction to the point_transactions table
 * @param {Object} transactionData - Transaction details
 * @param {number} transactionData.userFid - User's Farcaster ID
 * @param {string} transactionData.transactionType - Type: 'daily_checkin', 'purchase', 'bonus', 'adjustment'
 * @param {number} transactionData.pointsEarned - Points earned in this transaction
 * @param {number} transactionData.pointsBefore - Points before transaction
 * @param {number} transactionData.pointsAfter - Points after transaction
 * @param {string} transactionData.description - Human-readable description
 * @param {string} transactionData.referenceId - Reference ID (order ID, session ID, etc.)
 * @param {Object} transactionData.metadata - Additional metadata as JSON
 * @returns {Promise<Object>} Result of logging operation
 */
export async function logPointTransaction({
  userFid,
  transactionType,
  pointsEarned,
  pointsBefore,
  pointsAfter,
  description,
  referenceId,
  metadata = {}
}) {
  try {
    // Use admin client for system operations that log transactions
    const adminClient = supabaseAdmin || supabase;
    const { data, error } = await adminClient
      .from('point_transactions')
      .insert({
        user_fid: userFid,
        transaction_type: transactionType,
        points_earned: pointsEarned,
        points_before: pointsBefore,
        points_after: pointsAfter,
        description: description,
        reference_id: referenceId,
        metadata: metadata
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging point transaction:', error);
      return { success: false, error: error.message };
    }

    console.log(`Point transaction logged: ${userFid} earned ${pointsEarned} points (${transactionType})`);
    return { success: true, transaction: data };

  } catch (error) {
    console.error('Error in logPointTransaction:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get point transaction history for a user
 * @param {number} userFid - User's Farcaster ID
 * @param {number} limit - Maximum number of transactions to return (default: 50)
 * @param {string} transactionType - Filter by transaction type (optional)
 * @returns {Promise<Array>} Array of point transactions
 */
export async function getUserPointTransactions(userFid, limit = 50, transactionType = null) {
  try {
    let query = supabaseAdmin
      .from('point_transactions')
      .select('*')
      .eq('user_fid', userFid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (transactionType) {
      query = query.eq('transaction_type', transactionType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user point transactions:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('Error in getUserPointTransactions:', error);
    return [];
  }
}

/**
 * Get point transaction statistics for a user
 * @param {number} userFid - User's Farcaster ID
 * @returns {Promise<Object>} Transaction statistics
 */
export async function getUserPointTransactionStats(userFid) {
  try {
    const { data, error } = await supabaseAdmin
      .from('point_transactions')
      .select('transaction_type, points_earned')
      .eq('user_fid', userFid);

    if (error) {
      console.error('Error fetching transaction stats:', error);
      return { 
        totalTransactions: 0,
        totalCheckinPoints: 0,
        totalPurchasePoints: 0,
        totalBonusPoints: 0,
        checkinTransactions: 0,
        purchaseTransactions: 0,
        bonusTransactions: 0
      };
    }

    const stats = {
      totalTransactions: data.length,
      totalCheckinPoints: 0,
      totalPurchasePoints: 0,
      totalBonusPoints: 0,
      checkinTransactions: 0,
      purchaseTransactions: 0,
      bonusTransactions: 0
    };

    data.forEach(transaction => {
      switch (transaction.transaction_type) {
        case 'daily_checkin':
          stats.totalCheckinPoints += transaction.points_earned;
          stats.checkinTransactions++;
          break;
        case 'purchase':
          stats.totalPurchasePoints += transaction.points_earned;
          stats.purchaseTransactions++;
          break;
        case 'bonus':
        case 'adjustment':
          stats.totalBonusPoints += transaction.points_earned;
          stats.bonusTransactions++;
          break;
      }
    });

    return stats;

  } catch (error) {
    console.error('Error in getUserPointTransactionStats:', error);
    return { 
      totalTransactions: 0,
      totalCheckinPoints: 0,
      totalPurchasePoints: 0,
      totalBonusPoints: 0,
      checkinTransactions: 0,
      purchaseTransactions: 0,
      bonusTransactions: 0
    };
  }
} 