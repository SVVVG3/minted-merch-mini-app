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
    // First, get the username from the profiles table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('fid', userFid)
      .single();

    const username = profile?.username || null;

    const { data, error } = await supabaseAdmin
      .from('user_leaderboard')
      .insert({
        user_fid: userFid,
        username: username,
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

    console.log(`Initialized leaderboard for user ${userFid} with username: ${username}`);
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
        console.log('🔍 Looking for pending transaction for user:', userFid, 'with txHash:', txHash);
        
        // Find and update the pending transaction
        const { data: pendingTx, error: findError } = await supabase
          .from('point_transactions')
          .select('id, created_at, spin_reserved_at, description')
          .eq('user_fid', userFid)
          .eq('transaction_type', 'daily_checkin')
          .is('spin_tx_hash', null)
          .is('spin_confirmed_at', null)
          .not('spin_reserved_at', 'is', null)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within last 24 hours
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        console.log('🔍 Pending transaction search result:', { pendingTx, findError });

        if (pendingTx && !findError) {
          console.log('🔄 Updating existing pending transaction:', pendingTx.id);
          console.log('🔧 Update data:', {
            points_earned: finalPoints,
            points_before: userData.total_points,
            points_after: updatedData.total_points,
            description: `On-chain daily check-in (streak: ${newStreak})`,
            spin_tx_hash: txHash,
            spin_confirmed_at: new Date().toISOString()
          });
          
          // Update the existing pending transaction (using supabaseAdmin for permissions)
          const { error: updateError } = await supabaseAdmin
            .from('point_transactions')
            .update({
              points_earned: finalPoints,
              points_before: userData.total_points,
              points_after: updatedData.total_points,
              description: `On-chain daily check-in (streak: ${newStreak})`,
              reference_id: transactionData.referenceId,
              spin_tx_hash: txHash,
              spin_confirmed_at: new Date().toISOString(),
              metadata: transactionData.metadata
            })
            .eq('id', pendingTx.id);

          if (updateError) {
            console.error('❌ Error updating pending transaction:', updateError);
            // Fall back to creating new transaction
            await logPointTransaction(transactionData);
          } else {
            console.log('✅ Updated pending transaction with points and confirmation');
            
            // Verify the update actually worked
            const { data: verifyTx, error: verifyError } = await supabaseAdmin
              .from('point_transactions')
              .select('points_earned, spin_tx_hash, spin_confirmed_at')
              .eq('id', pendingTx.id)
              .single();
              
            if (verifyError) {
              console.error('❌ Error verifying update:', verifyError);
            } else {
              console.log('🔍 Verification - Updated transaction now has:', verifyTx);
              if (verifyTx.points_earned === 0) {
                console.error('❌ UPDATE FAILED - points still 0, falling back to new transaction');
                await logPointTransaction(transactionData);
              }
            }
          }
        } else {
          console.log('⚠️ No pending transaction found, creating new one. FindError:', findError);
          console.log('🔍 Search criteria was: user_fid =', userFid, 'transaction_type = daily_checkin, spin_tx_hash = null, spin_confirmed_at = null, spin_reserved_at IS NOT NULL');
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
    // Calculate points: 10000% (100x) of order total (minimum 10 points)
    const points = Math.max(Math.floor(orderTotal * 100.0), 10);

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
        description: `Purchase order (10000% of $${orderTotal.toFixed(2)})`,
        referenceId: orderId,
        metadata: {
          orderTotal: orderTotal,
          orderId: orderId,
          pointsMultiplier: 100.0
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
    console.log(`🔍 getLeaderboard called with limit: ${limit}, category: ${category}`);
    
    // For accurate rankings with token multipliers, we need to fetch more users than requested
    // because someone with lower base points but high multiplier might rank higher
    const needsLargerDataset = limit <= 1000;
    const isAdminRequest = limit > 1000;
    
    if (isAdminRequest || needsLargerDataset) {
      console.log(`🏆 ${isAdminRequest ? 'Admin request' : 'Mini app request'} detected - using comprehensive pagination like admin dashboard`);
      
      // Use the same pagination approach as admin dashboard to get ALL users
      let allData = [];
      let currentPage = 0;
      const pageSize = 1000;
      let hasMoreData = true;

      // Build base query (same as admin dashboard)
      let baseQuery = supabaseAdmin
        .from('user_leaderboard')
        .select(`
          *,
          profiles!user_fid (
            username,
            display_name,
            pfp_url,
            token_balance
          )
        `);

      // Add sorting based on category
      switch (category) {
        case 'points':
          baseQuery = baseQuery.order('total_points', { ascending: false });
          break;
        case 'streaks':
          baseQuery = baseQuery.order('checkin_streak', { ascending: false });
          break;
        case 'purchases':
          baseQuery = baseQuery
            .gt('total_orders', 0)
            .order('points_from_purchases', { ascending: false });
          break;
        case 'spending':
          baseQuery = baseQuery.order('total_spent', { ascending: false });
          break;
        default:
          baseQuery = baseQuery.order('total_points', { ascending: false });
      }

      // Fetch all pages (same logic as admin dashboard)
      while (hasMoreData) {
        const startRange = currentPage * pageSize;
        const endRange = startRange + pageSize - 1;
        
        const { data: pageData, error } = await baseQuery.range(startRange, endRange);

        if (error) {
          console.error('Error fetching leaderboard page:', error);
          break;
        }

        if (!pageData || pageData.length === 0) {
          hasMoreData = false;
          break;
        }

        allData.push(...pageData);
        currentPage++;

        // If we got less than pageSize, we've reached the end
        if (pageData.length < pageSize) {
          hasMoreData = false;
        }

        // For mini app, we can limit total fetch to reasonable amount
        if (!isAdminRequest && allData.length >= 10000) {
          console.log(`📊 Mini app: Fetched ${allData.length} users, stopping for performance`);
          hasMoreData = false;
        }
      }

      console.log(`📊 Fetched ${allData.length} total users using pagination`);

      // Apply token multipliers to all users (same as admin dashboard logic)
      const transformedData = allData.map((entry) => {
        const profile = entry.profiles || {};
        const tokenBalanceWei = profile.token_balance || 0;
        const basePoints = entry.total_points || 0;
        const basePurchasePoints = entry.points_from_purchases || 0;
        
        // Apply token multiplier to total points AND purchase points
        const multiplierResult = applyTokenMultiplier(basePoints, tokenBalanceWei);
        const purchaseMultiplierResult = applyTokenMultiplier(basePurchasePoints, tokenBalanceWei);
        
        return {
          ...entry,
          // Use profile data with proper fallbacks
          display_name: profile.display_name || entry.display_name || `User ${entry.user_fid}`,
          username: profile.username || entry.username || null,
          pfp_url: profile.pfp_url || null,
          token_balance: tokenBalanceWei,
          // Store both original and multiplied points
          base_points: basePoints,
          total_points: multiplierResult.multipliedPoints,
          // Store both original and multiplied purchase points
          base_points_from_purchases: basePurchasePoints,
          points_from_purchases: purchaseMultiplierResult.multipliedPoints,
          token_multiplier: multiplierResult.multiplier,
          token_tier: multiplierResult.tier,
          category: category,
          // Remove the nested profiles object
          profiles: undefined
        };
      });

      // Re-sort by the category after applying multipliers (since multipliers can change rankings)
      const sortedData = transformedData.sort((a, b) => {
        switch (category) {
          case 'points':
            return (b.total_points || 0) - (a.total_points || 0);
          case 'streaks':
            if ((b.checkin_streak || 0) !== (a.checkin_streak || 0)) {
              return (b.checkin_streak || 0) - (a.checkin_streak || 0);
            }
            return (b.total_points || 0) - (a.total_points || 0);
          case 'purchases':
            if ((b.points_from_purchases || 0) !== (a.points_from_purchases || 0)) {
              return (b.points_from_purchases || 0) - (a.points_from_purchases || 0);
            }
            return (b.total_orders || 0) - (a.total_orders || 0);
          case 'spending':
            if ((b.total_spent || 0) !== (a.total_spent || 0)) {
              return (b.total_spent || 0) - (a.total_spent || 0);
            }
            return (b.total_orders || 0) - (a.total_orders || 0);
          default:
            return (b.total_points || 0) - (a.total_points || 0);
        }
      });

      // Add final rankings after re-sorting
      const finalData = sortedData.map((user, index) => ({
        ...user,
        rank: index + 1
      }));

      // Return up to the requested limit
      const finalUsers = finalData.slice(0, limit);
      
      console.log(`📊 getLeaderboard returned ${finalUsers.length} users for ${isAdminRequest ? 'admin' : 'mini app'} request with accurate global rankings`);
      
      return finalUsers;
    }
    
    // Original logic for smaller requests
    const SUPABASE_MAX_LIMIT = 1000;
    const needsPagination = limit > SUPABASE_MAX_LIMIT;
    
    let allData = [];
    
    if (needsPagination) {
      console.log(`📄 Using pagination for limit ${limit} (fetching in chunks of ${SUPABASE_MAX_LIMIT})`);
      
      let offset = 0;
      let hasMore = true;
      
      while (hasMore && allData.length < limit) {
        const currentLimit = Math.min(SUPABASE_MAX_LIMIT, limit - allData.length);
        
        let query = supabaseAdmin
          .from('user_leaderboard')
          .select(`
            user_fid, 
            total_points, 
            checkin_streak, 
            last_checkin_date, 
            total_orders, 
            total_spent, 
            points_from_purchases, 
            points_from_checkins, 
            created_at,
            profiles (
              display_name,
              pfp_url,
              username,
              token_balance
            )
          `)
          .range(offset, offset + currentLimit - 1);

        // Sort based on category for this chunk
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

        const { data: chunkData, error } = await query;

        if (error) {
          console.error('Error fetching leaderboard chunk:', error);
          break;
        }

        if (!chunkData || chunkData.length === 0) {
          hasMore = false;
          break;
        }

        allData.push(...chunkData);
        offset += currentLimit;
        
        console.log(`📄 Fetched chunk: ${chunkData.length} users (total so far: ${allData.length})`);
        
        // If we got less than requested, we've reached the end
        if (chunkData.length < currentLimit) {
          hasMore = false;
        }
      }
      
    } else {
      // Single request for limits <= 1000
      let query = supabaseAdmin
        .from('user_leaderboard')
        .select(`
          user_fid, 
          total_points, 
          checkin_streak, 
          last_checkin_date, 
          total_orders, 
          total_spent, 
          points_from_purchases, 
          points_from_checkins, 
          created_at,
          profiles (
            display_name,
            pfp_url,
            username,
            token_balance
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

      allData = data || [];
    }

    console.log(`📊 getLeaderboard returned ${allData.length} users for limit ${limit}`);
    
    if (allData.length === 1000 && limit > 1000) {
      console.warn('⚠️ Exactly 1000 results returned but more requested - possible limit issue!');
    }

    // Add category-specific display information, flatten profile data, and apply token multipliers
    const enhancedData = allData.map((user) => {
      const tokenBalance = user.profiles?.token_balance || 0;
      const basePoints = user.total_points || 0;
      const basePurchasePoints = user.points_from_purchases || 0;
      
      // Apply token multiplier to total points AND purchase points
      const multiplierResult = applyTokenMultiplier(basePoints, tokenBalance);
      const purchaseMultiplierResult = applyTokenMultiplier(basePurchasePoints, tokenBalance);
      
      return {
        ...user,
        // Use profile data with proper fallbacks
        display_name: user.profiles?.display_name || `User ${user.user_fid}`,
        username: user.profiles?.username || null,
        pfp_url: user.profiles?.pfp_url || null,
        token_balance: tokenBalance,
        // Store both original and multiplied points
        base_points: basePoints,
        total_points: multiplierResult.multipliedPoints,
        // Store both original and multiplied purchase points
        base_points_from_purchases: basePurchasePoints,
        points_from_purchases: purchaseMultiplierResult.multipliedPoints,
        token_multiplier: multiplierResult.multiplier,
        token_tier: multiplierResult.tier,
        category: category
      };
    });

    // Re-sort by the category after applying multipliers (since multipliers can change rankings)
    const sortedData = sortUsersByCategory(enhancedData, category);
    
    // Add final rankings after re-sorting
    const finalData = sortedData.map((user, index) => ({
      ...user,
      rank: index + 1
    }));

    console.log(`🎯 Applied token multipliers and re-sorted ${finalData.length} users`);
    
    return finalData;
  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    return [];
  }
}

/**
 * Get user's leaderboard position (with token multipliers applied)
 * @param {number} userFid - Farcaster ID of the user
 * @param {string} category - Category to get position for ('points', 'streaks', 'purchases', 'spending')
 * @returns {object} User's position and stats
 */
export async function getUserLeaderboardPosition(userFid, category = 'points') {
  try {
    // Get user's current points and profile data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('user_leaderboard')
      .select(`
        *,
        profiles!user_fid (
          username,
          display_name,
          pfp_url,
          token_balance
        )
      `)
      .eq('user_fid', userFid)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user leaderboard position:', userError);
    }

    if (!userData) {
      return {
        position: null,
        user_fid: userFid,
        username: null,
        display_name: `User ${userFid}`,
        pfp_url: null,
        totalPoints: 0,
        basePoints: 0,
        tokenMultiplier: 1,
        tokenTier: 'none',
        checkin_streak: 0, // Add this for streak leaderboard component
        streak: 0,
        totalOrders: 0,
        totalSpent: 0,
        pointsFromPurchases: 0
      };
    }

    // Apply token multiplier to user's points
    const tokenBalance = userData.profiles?.token_balance || 0;
    const basePoints = userData.total_points || 0;
    const multiplierResult = applyTokenMultiplier(basePoints, tokenBalance);

    // To calculate position accurately, we need to get all users, apply multipliers, and count
    // This is expensive but necessary for accurate positioning with dynamic multipliers
    const allUsersData = await getLeaderboard(50000, category); // Get ALL users with multipliers applied for the specific category
    
    // Find user's position in the multiplied leaderboard
    let position = null;
    const userEntry = allUsersData.find(user => user.user_fid === userFid);
    if (userEntry) {
      position = userEntry.rank;
    }

    return {
      position: position,
      user_fid: userFid,
      username: userData.profiles?.username || null,
      display_name: userData.profiles?.display_name || `User ${userFid}`,
      pfp_url: userData.profiles?.pfp_url || null,
      totalPoints: multiplierResult.multipliedPoints,
      basePoints: basePoints,
      tokenMultiplier: multiplierResult.multiplier,
      tokenTier: multiplierResult.tier,
      checkin_streak: userData.checkin_streak, // Add this for streak leaderboard component
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
      user_fid: userFid,
      username: null,
      display_name: `User ${userFid}`,
      pfp_url: null,
      totalPoints: 0,
      basePoints: 0,
      tokenMultiplier: 1,
      tokenTier: 'none',
      checkin_streak: 0, // Add this for streak leaderboard component
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
      
      // Calculate points from purchases (10000% of total spent)
      const pointsFromPurchases = Math.floor(stats.totalSpent * 100.0);

      // Check if user exists in leaderboard, if not create them
      const { data: existingUser } = await supabaseAdmin
        .from('user_leaderboard')
        .select('user_fid, total_points')
        .eq('user_fid', userFidNum)
        .single();

      let leaderboardError = null;

      if (!existingUser) {
        // Get username from profiles table
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('username')
          .eq('fid', userFidNum)
          .single();

        // Create new leaderboard entry for users who have orders but haven't checked in
        const { error } = await supabaseAdmin
          .from('user_leaderboard')
          .insert({
            user_fid: userFidNum,
            username: profile?.username || null,
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

/**
 * Get today's check-in result for sharing
 * @param {number} userFid - User's Farcaster ID
 * @returns {Promise<Object>} Today's check-in result or null if not found
 */
export async function getTodaysCheckInResult(userFid) {
  try {
    const checkInDay = getCurrentCheckInDay();
    console.log(`🔍 Looking for today's check-in result for user ${userFid}, check-in day: ${checkInDay}`);
    
    // Also check what the current PST time is for debugging
    const { getCurrentPSTTime } = await import('./timezone.js');
    const currentPST = getCurrentPSTTime();
    console.log(`🔍 Current PST time: ${currentPST.toISOString()}, hour: ${currentPST.getHours()}`);
    
    // Get today's check-in transaction using reference_id instead of created_at
    // This avoids timezone issues since reference_id contains the correct check-in day
    const { data: transaction, error } = await supabaseAdmin
      .from('point_transactions')
      .select('*')
      .eq('user_fid', userFid)
      .eq('transaction_type', 'daily_checkin')
      .eq('reference_id', `checkin-${userFid}-${checkInDay}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log(`🔍 Transaction query result:`, { transaction, error });

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching today\'s check-in result:', error);
      return null;
    }

    if (!transaction) {
      console.log(`⚠️ No transaction found for user ${userFid} on check-in day ${checkInDay}`);
      
      // Let's also check for any recent transactions for this user to debug
      const { data: recentTransactions, error: recentError } = await supabaseAdmin
        .from('point_transactions')
        .select('*')
        .eq('user_fid', userFid)
        .eq('transaction_type', 'daily_checkin')
        .order('created_at', { ascending: false })
        .limit(5);
        
      console.log(`🔍 Recent check-in transactions for user ${userFid}:`, recentTransactions);
      return null;
    }

    // Get current user data for total points and streak
    const userData = await getUserLeaderboardData(userFid);
    if (!userData) {
      return null;
    }

    // Extract base points and streak bonus from metadata
    let basePoints = transaction.points_earned;
    let streakBonus = 0;

    // Check if metadata contains the breakdown
    if (transaction.metadata && typeof transaction.metadata === 'object') {
      if (transaction.metadata.basePoints !== undefined) {
        basePoints = transaction.metadata.basePoints;
      }
      if (transaction.metadata.streakBonus !== undefined) {
        streakBonus = transaction.metadata.streakBonus;
      }
    }

    const result = {
      pointsEarned: transaction.points_earned,
      basePoints: basePoints,
      streakBonus: streakBonus,
      newStreak: userData.checkin_streak,
      totalPoints: userData.total_points,
      checkinDate: checkInDay
    };
    
    console.log(`✅ Returning today's check-in result for user ${userFid}:`, result);
    return result;

  } catch (error) {
    console.error('Error in getTodaysCheckInResult:', error);
    return null;
  }
}

/**
 * Get top users by points (helper for admin leaderboard)
 */
async function getTopUsersByPoints(limit, category) {
  let query = supabaseAdmin
    .from('user_leaderboard')
    .select(`
      user_fid, 
      total_points, 
      checkin_streak, 
      last_checkin_date, 
      total_orders, 
      total_spent, 
      points_from_purchases, 
      points_from_checkins, 
      created_at,
      profiles (
        display_name,
        pfp_url,
        username,
        token_balance
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
        .order('total_points', { ascending: false });
      break;
    case 'purchases':
      query = query
        .gt('total_orders', 0)
        .order('points_from_purchases', { ascending: false })
        .order('total_orders', { ascending: false });
      break;
    case 'spending':
      query = query
        .order('total_spent', { ascending: false })
        .order('total_orders', { ascending: false });
      break;
    default:
      query = query.order('total_points', { ascending: false });
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching top users by points:', error);
    return [];
  }

  return data || [];
}

/**
 * Get top token holders (helper for admin leaderboard)
 */
async function getTopTokenHolders(limit) {
  // Get users with significant token balances from profiles table
  const { data: tokenHolders, error: tokenError } = await supabaseAdmin
    .from('profiles')
    .select(`
      fid,
      username,
      display_name,
      pfp_url,
      token_balance,
      token_balance_updated_at
    `)
    .gt('token_balance', 0)
    .order('token_balance', { ascending: false })
    .limit(limit);

  if (tokenError) {
    console.error('Error fetching token holders:', tokenError);
    return [];
  }

  // Convert to leaderboard format and get their points data
  const tokenHolderFids = tokenHolders.map(holder => holder.fid);
  
  const { data: pointsData, error: pointsError } = await supabaseAdmin
    .from('user_leaderboard')
    .select(`
      user_fid,
      total_points,
      checkin_streak,
      last_checkin_date,
      total_orders,
      total_spent,
      points_from_purchases,
      points_from_checkins,
      created_at
    `)
    .in('user_fid', tokenHolderFids);

  if (pointsError) {
    console.error('Error fetching points data for token holders:', pointsError);
  }

  // Create a map of points data by fid
  const pointsMap = new Map();
  (pointsData || []).forEach(user => {
    pointsMap.set(user.user_fid, user);
  });

  // Combine token holder data with points data
  return tokenHolders.map(holder => {
    const pointsInfo = pointsMap.get(holder.fid) || {
      user_fid: holder.fid,
      total_points: 0,
      checkin_streak: 0,
      last_checkin_date: null,
      total_orders: 0,
      total_spent: 0,
      points_from_purchases: 0,
      points_from_checkins: 0,
      created_at: new Date().toISOString()
    };

    return {
      ...pointsInfo,
      user_fid: holder.fid,
      profiles: {
        display_name: holder.display_name,
        pfp_url: holder.pfp_url,
        username: holder.username,
        token_balance: holder.token_balance
      }
    };
  });
}

/**
 * Sort users by category (helper for admin leaderboard)
 */
function sortUsersByCategory(users, category) {
  return users.sort((a, b) => {
    switch (category) {
      case 'points':
        return (b.total_points || 0) - (a.total_points || 0);
      case 'streaks':
        if ((b.checkin_streak || 0) !== (a.checkin_streak || 0)) {
          return (b.checkin_streak || 0) - (a.checkin_streak || 0);
        }
        return (b.total_points || 0) - (a.total_points || 0);
      case 'purchases':
        if ((b.points_from_purchases || 0) !== (a.points_from_purchases || 0)) {
          return (b.points_from_purchases || 0) - (a.points_from_purchases || 0);
        }
        return (b.total_orders || 0) - (a.total_orders || 0);
      case 'spending':
        if ((b.total_spent || 0) !== (a.total_spent || 0)) {
          return (b.total_spent || 0) - (a.total_spent || 0);
        }
        return (b.total_orders || 0) - (a.total_orders || 0);
      default:
        return (b.total_points || 0) - (a.total_points || 0);
    }
  });
}

/**
 * Calculate token holding multiplier based on $MINTEDMERCH holdings
 * @param {string|number} tokenBalanceWei - Token balance in wei (smallest unit)
 * @returns {object} Multiplier information { multiplier: number, tier: string }
 */
export function calculateTokenMultiplier(tokenBalanceWei) {
  if (!tokenBalanceWei) {
    return { multiplier: 1, tier: 'none' };
  }

  // Convert from wei to tokens (divide by 10^18)
  const tokenBalance = parseFloat(tokenBalanceWei) / 1000000000000000000;

  if (tokenBalance >= 1000000000) {
    // 1B+ tokens = 5x multiplier
    return { multiplier: 5, tier: 'legendary' };
  } else if (tokenBalance >= 200000000) {
    // 200M+ tokens = 3x multiplier
    return { multiplier: 3, tier: 'elite' };
  } else if (tokenBalance >= 50000000) {
    // 50M+ tokens = 2x multiplier
    return { multiplier: 2, tier: 'elite' };
  } else {
    // Less than 50M = no multiplier
    return { multiplier: 1, tier: 'none' };
  }
}

/**
 * Apply token holding multiplier to user's total points
 * @param {number} basePoints - Base total points before multiplier
 * @param {string|number} tokenBalanceWei - Token balance in wei
 * @returns {object} { multipliedPoints: number, multiplier: number, tier: string }
 */
export function applyTokenMultiplier(basePoints, tokenBalanceWei) {
  const multiplierInfo = calculateTokenMultiplier(tokenBalanceWei);
  const multipliedPoints = Math.floor(basePoints * multiplierInfo.multiplier);
  
  return {
    multipliedPoints,
    multiplier: multiplierInfo.multiplier,
    tier: multiplierInfo.tier
  };
}

/**
 * Enhance user data with display information and token multipliers (helper for admin leaderboard)
 */
function enhanceUserData(users, category) {
  return users.map((user, index) => {
    const tokenBalance = user.profiles?.token_balance || 0;
    const basePoints = user.total_points || 0;
    
    // Apply token multiplier to total points
    const multiplierResult = applyTokenMultiplier(basePoints, tokenBalance);
    
    return {
      ...user,
      display_name: user.profiles?.display_name || `User ${user.user_fid}`,
      username: user.profiles?.username || null,
      pfp_url: user.profiles?.pfp_url || null,
      token_balance: tokenBalance,
      // Store both original and multiplied points
      base_points: basePoints,
      total_points: multiplierResult.multipliedPoints,
      token_multiplier: multiplierResult.multiplier,
      token_tier: multiplierResult.tier,
      rank: index + 1,
      category: category
    };
  });
} 