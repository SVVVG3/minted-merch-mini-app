// Token balance caching system for profiles table
import { supabaseAdmin } from './supabase';
import { checkTokenBalanceDirectly } from './blockchainAPI';
import { updateChatMemberBalance } from './chatMemberDatabase';
import { deduplicateRequest } from './requestDeduplication';

/**
 * Update user's token balance in profiles table
 * @param {number} fid - User's Farcaster ID
 * @param {Array} walletAddresses - User's wallet addresses
 * @param {number} tokenBalance - Token balance in wei (optional, will fetch if not provided)
 * @returns {Promise<Object>} Result with success status and balance
 */
export async function updateUserTokenBalance(fid, walletAddresses = [], tokenBalance = null) {
  // Use request deduplication to prevent concurrent balance updates for same user
  const deduplicationKey = `update-token-balance-${fid}`;
  
  return await deduplicateRequest(
    deduplicationKey,
    async () => {
      try {
        console.log(`💰 Updating token balance for FID ${fid} with ${walletAddresses.length} wallets`);

    let finalBalance = tokenBalance;
    let walletBalance; // For breakdown tracking
    let stakedBalance; // For breakdown tracking
    
    // If tokenBalance is provided, use it directly (already in tokens)
    if (tokenBalance !== null) {
      finalBalance = tokenBalance;
      console.log(`🔄 Using provided balance: ${tokenBalance} tokens`);
    }

    // If balance not provided, fetch it from blockchain
    if (finalBalance === null && walletAddresses.length > 0) {
      console.log('🔍 Fetching token balance from blockchain...');
      
      // Filter to only Ethereum addresses (0x format, 42 chars)
      const ethAddresses = walletAddresses.filter(addr => 
        typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42
      );
      
      console.log(`🔗 Filtered ${walletAddresses.length} addresses to ${ethAddresses.length} Ethereum addresses`);
      
      if (ethAddresses.length === 0) {
        console.log('❌ No valid Ethereum addresses found');
        finalBalance = 0;
      } else {
        const mintedMerchContract = '0x774EAeFE73Df7959496Ac92a77279A8D7d690b07';
        const baseChainId = 8453;
        
        try {
          // Fetch wallet balance from blockchain
          const balanceResult = await checkTokenBalanceDirectly(
            ethAddresses,
            [mintedMerchContract],
            baseChainId
          );
        
        // The blockchain API returns balance in tokens (already divided by 10^18)
        walletBalance = balanceResult || 0;
        console.log(`✅ Fetched wallet balance: ${walletBalance} tokens`);
        
        // Fetch staked balance from subgraph
        stakedBalance = 0;
        try {
          const { getUserStakedBalance } = await import('./stakingBalanceAPI.js');
          stakedBalance = await getUserStakedBalance(ethAddresses);
          console.log(`📊 Fetched staked balance: ${stakedBalance} tokens`);
        } catch (stakingError) {
          console.warn('⚠️ Could not fetch staked balance:', stakingError.message);
          console.log('📊 Continuing with wallet balance only');
          // Continue with just wallet balance if staking query fails
        }
        
        // Combine wallet + staked balance for total holdings
        const tokensBalance = walletBalance + stakedBalance;
        console.log(`💰 Total balance (wallet + staked): ${tokensBalance} tokens`);
        
        finalBalance = tokensBalance;
        } catch (error) {
          console.error('❌ CRITICAL: Token balance fetch failed:', error);
          
          // Check if this is a fail-safe error (too many wallet failures)
          if (error.message.includes('Failure rate too high')) {
            console.error('🚨 FAIL-SAFE: Cannot make reliable eligibility decisions');
            // Re-throw the error to prevent using unreliable data
            throw new Error(`Token balance check unreliable: ${error.message}`);
          }
          
          // For other errors (network issues, etc.), try to use cached balance
          console.log('🔄 Attempting to use cached balance as fallback...');
          try {
            const cachedResult = await getCachedTokenBalance(fid);
            if (cachedResult.success && cachedResult.balance > 0) {
              finalBalance = cachedResult.balance;
              console.log(`✅ Using cached balance: ${finalBalance} wei`);
            } else {
              console.warn('❌ No cached balance available, defaulting to 0');
              finalBalance = 0;
            }
          } catch (cacheError) {
            console.error('❌ Cache fallback also failed:', cacheError);
            finalBalance = 0;
          }
        }
      }
    } else if (finalBalance === null) {
      finalBalance = 0; // No wallets, set to 0
    }

    // finalBalance is already in tokens, no conversion needed
    const tokensBalance = typeof finalBalance === 'string' ?
      parseFloat(finalBalance) :
      finalBalance;

    // Update the profiles table with total and breakdown (if available)
    const updateData = {
      token_balance: tokensBalance,
      token_balance_updated_at: new Date().toISOString()
    };
    
    // If we have the breakdown from the fetch above, store it
    // This is optional - for backward compatibility, token_balance is still the total
    if (typeof walletBalance !== 'undefined' && typeof stakedBalance !== 'undefined') {
      updateData.wallet_balance = walletBalance;
      updateData.staked_balance = stakedBalance;
      console.log(`💾 Storing balance breakdown: ${walletBalance} wallet + ${stakedBalance} staked = ${tokensBalance} total`);
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('fid', fid)
      .select('fid, token_balance, wallet_balance, staked_balance, token_balance_updated_at')
      .maybeSingle(); // Use maybeSingle() to avoid PGRST116 error for new users

    if (error) {
      console.error(`❌ Error updating token balance for FID ${fid}:`, error);
      return {
        success: false,
        error: error.message,
        balance: tokensBalance
      };
    }

    console.log(`✅ Updated token balance for FID ${fid}: ${tokensBalance} tokens`);
    console.log(`📅 Cache timestamp: ${data.token_balance_updated_at}`);
    
    // Only update chat member database if user is actually a chat member
    // This prevents errors for users who aren't in the chat_members table
    
    const CHAT_ELIGIBILITY_THRESHOLD = 50000000; // 50M tokens required for chat
    
    try {
      // First check if user is a chat member before attempting to update
      const { data: chatMember, error: chatMemberError } = await supabaseAdmin
        .from('chat_members')
        .select('fid')
        .eq('fid', fid)
        .single();
      
      if (chatMemberError && chatMemberError.code === 'PGRST116') {
        // User is not a chat member - this is normal, don't log as error
        console.log(`ℹ️ FID ${fid} is not a chat member - skipping chat balance update`);
      } else if (chatMemberError) {
        // Other database error
        console.warn(`⚠️ Error checking chat member status for FID ${fid}:`, chatMemberError.message);
      } else {
        // User is a chat member, proceed with balance update
        await updateChatMemberBalance(fid, tokensBalance, 'success');
        if (tokensBalance >= CHAT_ELIGIBILITY_THRESHOLD) {
          console.log(`💬 Updated chat member balance for FID ${fid}: ${tokensBalance} tokens (eligible)`);
        } else {
          console.log(`💬 Updated chat member balance for FID ${fid}: ${tokensBalance} tokens (ineligible - will be marked inactive)`);
        }
      }
    } catch (chatError) {
      // Log warning for any update failures
      console.warn(`⚠️ Could not update chat member balance for FID ${fid}:`, chatError.message);
    }
    
    return {
      success: true,
      balance: tokensBalance,
      updated_at: data.token_balance_updated_at,
      data
    };

      } catch (error) {
        console.error(`❌ Error in updateUserTokenBalance for FID ${fid}:`, error);
        return {
          success: false,
          error: error.message,
          balance: 0
        };
      }
    },
    10000 // Cache for 10 seconds to prevent rapid duplicate calls
  );
}

/**
 * Get user's cached token balance from profiles table
 * @param {number} fid - User's Farcaster ID
 * @returns {Promise<Object>} Result with balance and cache info
 */
export async function getCachedTokenBalance(fid) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('fid, token_balance, token_balance_updated_at')
      .eq('fid', fid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // User not found
        return {
          success: false,
          error: 'User not found',
          balance: 0,
          cached: false
        };
      }
      throw error;
    }

    const balance = data.token_balance || 0;
    const updatedAt = data.token_balance_updated_at;
    const isCached = !!updatedAt;
    
    // Check if cache is stale (older than 1 hour)
    const isStale = updatedAt ? 
      (Date.now() - new Date(updatedAt).getTime()) > (60 * 60 * 1000) : 
      true;

    return {
      success: true,
      balance,
      updated_at: updatedAt,
      cached: isCached,
      stale: isStale,
      data
    };

  } catch (error) {
    console.error(`❌ Error getting cached token balance for FID ${fid}:`, error);
    return {
      success: false,
      error: error.message,
      balance: 0,
      cached: false
    };
  }
}

/**
 * Update token balance for user when they open the app
 * @param {number} fid - User's Farcaster ID
 * @param {Array} walletAddresses - User's wallet addresses (optional - will fetch from DB if not provided)
 * @returns {Promise<Object>} Result with balance and update status
 */
export async function refreshUserTokenBalance(fid, walletAddresses = [], forceRefresh = false, cacheOnly = false) {
  try {
    console.log(`🔄 Refreshing token balance for FID ${fid}${cacheOnly ? ' (cache-only mode)' : ''}`);

    // Get current cached balance
    const cachedResult = await getCachedTokenBalance(fid);
    console.log(`🔍 Cache lookup result for FID ${fid}:`, {
      success: cachedResult.success,
      balance: cachedResult.balance,
      updated_at: cachedResult.updated_at,
      age_seconds: cachedResult.updated_at ? Math.round((Date.now() - new Date(cachedResult.updated_at).getTime()) / 1000) : 'never'
    });
    
    // If cache-only mode, return cached result (even if stale) or failure
    if (cacheOnly) {
      if (cachedResult.success && cachedResult.balance !== null) {
        console.log(`🏪 Cache-only mode: Returning cached balance for FID ${fid}: ${cachedResult.balance}`);
        return {
          success: true,
          balance: cachedResult.balance,
          fromCache: true,
          updated_at: cachedResult.updated_at
        };
      } else {
        console.log(`🏪 Cache-only mode: No cached balance found for FID ${fid}`);
        return {
          success: false,
          error: 'No cached balance available',
          fromCache: true
        };
      }
    }
    
    // Skip cache if force refresh is requested (e.g., when user opens app)
    if (forceRefresh) {
      console.log(`🔄 Force refresh requested for FID ${fid} - skipping cache`);
    } else {
      // If cache is fresh (less than 5 minutes old), return cached value regardless of amount
      // Extended window for production scale - token balances don't change frequently
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      if (cachedResult.success && cachedResult.updated_at) {
        const cacheTime = new Date(cachedResult.updated_at).getTime();
        if (cacheTime > fiveMinutesAgo) {
          console.log(`💾 Using cached balance for FID ${fid}: ${cachedResult.balance} (updated ${Math.round((Date.now() - cacheTime) / 1000)}s ago, within 5min window)`);
          return {
            success: true,
            balance: cachedResult.balance,
            fromCache: true,
            updated_at: cachedResult.updated_at
          };
        } else {
          console.log(`⏰ Cache is ${Math.round((Date.now() - cacheTime) / 1000)}s old (older than 5min) - will fetch fresh`);
        }
      }
    }
    
    // For older cache, trust non-zero balances for longer (2 minutes)
    const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
    if (cachedResult.success && cachedResult.updated_at && cachedResult.balance > 0) {
      const cacheTime = new Date(cachedResult.updated_at).getTime();
      if (cacheTime > twoMinutesAgo) {
        console.log(`💾 Using cached non-zero balance for FID ${fid}: ${cachedResult.balance} (${Math.round((Date.now() - cacheTime) / 1000)}s old)`);
        return {
          success: true,
          balance: cachedResult.balance,
          fromCache: true,
          updated_at: cachedResult.updated_at
        };
      }
    }
    
    // If cached balance is 0 and older than 2 minutes, do a fresh check to avoid false negatives
    if (cachedResult.success && (cachedResult.balance === 0 || cachedResult.balance === '0')) {
      const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
      const cacheTime = new Date(cachedResult.updated_at).getTime();
      
      if (cacheTime < twoMinutesAgo) {
        console.log(`🔄 Cached balance is 0 for FID ${fid} and older than 2min - forcing fresh check to avoid false negatives`);
        // Continue to fresh fetch below
      } else {
        console.log(`💾 Using cached 0 balance for FID ${fid} (updated ${Math.round((Date.now() - cacheTime) / 1000)}s ago, within 2min window)`);
        return {
          success: true,
          balance: 0,
          fromCache: true,
          updated_at: cachedResult.updated_at
        };
      }
    }

    // Always fetch wallet addresses from database to ensure we have ALL addresses (including Bankr)
    // This prevents issues where only filtered addresses are passed from token gating calls
    console.log(`📋 Fetching ALL wallet addresses from database for FID ${fid} (passed: ${walletAddresses.length})`);
    try {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('all_wallet_addresses')
        .eq('fid', fid)
        .maybeSingle(); // Use maybeSingle() to avoid PGRST116 error for new users
      
      if (error) {
        console.error(`❌ Error fetching wallet addresses for FID ${fid}:`, error);
        // Fall back to passed addresses if database fetch fails
        console.log(`🔄 Falling back to ${walletAddresses.length} passed addresses`);
      } else {
        const dbAddresses = Array.isArray(profile.all_wallet_addresses) 
          ? profile.all_wallet_addresses 
          : JSON.parse(profile.all_wallet_addresses || '[]');
        console.log(`📋 Database has ${dbAddresses.length} addresses, passed had ${walletAddresses.length} addresses`);
        
        // 🚨 CRITICAL: Handle new users with no wallet addresses in database yet
        if (dbAddresses.length === 0 && walletAddresses.length === 0) {
          console.log(`🆕 NEW USER: No wallet addresses in database for FID ${fid}, fetching from Neynar...`);
          try {
            const { fetchUserWalletData } = await import('./walletUtils.js');
            const freshWalletData = await fetchUserWalletData(fid);
            if (freshWalletData && freshWalletData.all_wallet_addresses) {
              walletAddresses = freshWalletData.all_wallet_addresses;
              console.log(`✅ Fetched ${walletAddresses.length} wallet addresses from Neynar for new user`);
            } else {
              console.log(`❌ Could not fetch wallet addresses from Neynar for FID ${fid}`);
              walletAddresses = [];
            }
          } catch (neynarError) {
            console.error(`❌ Error fetching wallet addresses from Neynar for FID ${fid}:`, neynarError);
            walletAddresses = [];
          }
        } else {
          // Use database addresses as they include ALL addresses (Neynar + Bankr)
          walletAddresses = dbAddresses;
          console.log(`✅ Using ${walletAddresses.length} wallet addresses from database for comprehensive token check`);
        }
      }
    } catch (error) {
      console.error(`❌ Error parsing wallet addresses for FID ${fid}:`, error);
      console.log(`🔄 Falling back to ${walletAddresses.length} passed addresses`);
    }

    // Cache is stale or doesn't exist, fetch fresh balance
    console.log(`🔍 Cache stale or missing, fetching fresh balance for FID ${fid}`);
    const updateResult = await updateUserTokenBalance(fid, walletAddresses);
    
    return {
      success: updateResult.success,
      balance: updateResult.balance,
      fromCache: false,
      updated_at: updateResult.updated_at,
      error: updateResult.error
    };

  } catch (error) {
    console.error(`❌ Error refreshing token balance for FID ${fid}:`, error);
    return {
      success: false,
      error: error.message,
      balance: 0,
      fromCache: false
    };
  }
}

/**
 * Get token holders leaderboard from profiles table
 * @param {number} limit - Number of top holders to return
 * @returns {Promise<Object>} Leaderboard data
 */
export async function getTokenHoldersLeaderboard(limit = 50) {
  try {
    console.log(`📊 Fetching token holders leaderboard (top ${limit})`);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        fid,
        username,
        display_name,
        pfp_url,
        token_balance,
        token_balance_updated_at
      `)
      .gt('token_balance', 0) // Only users with tokens
      .order('token_balance', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    // Format the data for display
    const leaderboard = data.map((user, index) => ({
      rank: index + 1,
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      pfp_url: user.pfp_url,
      token_balance: user.token_balance,
      token_balance_formatted: formatTokenBalance(user.token_balance),
      last_updated: user.token_balance_updated_at
    }));

    console.log(`✅ Retrieved ${leaderboard.length} token holders`);

    return {
      success: true,
      leaderboard,
      total_holders: leaderboard.length
    };

  } catch (error) {
    console.error('❌ Error fetching token holders leaderboard:', error);
    return {
      success: false,
      error: error.message,
      leaderboard: [],
      total_holders: 0
    };
  }
}

/**
 * Get user's position in token holders leaderboard
 * @param {number} userFid - User's Farcaster ID
 * @returns {Promise<Object|null>} User's position data or null if not found
 */
export async function getUserTokenHoldersPosition(userFid) {
  try {
    console.log(`📊 Getting token holders position for FID ${userFid}`);

    // First, get the user's token balance
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, pfp_url, token_balance, token_balance_updated_at')
      .eq('fid', userFid)
      .single();

    if (userError || !userData || !userData.token_balance || userData.token_balance <= 0) {
      console.log(`⚠️ User ${userFid} not found or has no tokens`);
      return null;
    }

    // Count how many users have more tokens than this user
    const { count, error: countError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gt('token_balance', userData.token_balance);

    if (countError) {
      throw countError;
    }

    const position = (count || 0) + 1;

    console.log(`🔍 DEBUG Token Holders Position: User ${userFid} has ${userData.token_balance} tokens`);
    console.log(`🔍 DEBUG Token Holders Position: ${count} users have more tokens`);
    console.log(`🔍 DEBUG Token Holders Position: Calculated position: ${position}`);
    console.log(`✅ User ${userFid} is ranked #${position} in token holders`);

    return {
      position,
      fid: userData.fid,
      username: userData.username,
      display_name: userData.display_name,
      pfp_url: userData.pfp_url,
      token_balance: userData.token_balance,
      token_balance_formatted: formatTokenBalance(userData.token_balance),
      last_updated: userData.token_balance_updated_at
    };

  } catch (error) {
    console.error('❌ Error getting user token holders position:', error);
    return null;
  }
}

/**
 * Format token balance for display (balance is now stored in tokens, not wei)
 * @param {number|string} balance - Balance in tokens (stored as NUMERIC)
 * @returns {string} Formatted balance
 */
function formatTokenBalance(balance) {
  if (!balance || balance === 0) return '0';
  
  // Balance is now stored in tokens (not wei), so no conversion needed
  // Handle both number and string inputs
  const tokenAmount = typeof balance === 'string' ? parseFloat(balance) : balance;
  
  if (tokenAmount >= 1000000000) {
    // Show billions (B) for amounts >= 1 billion
    return `${(tokenAmount / 1000000000).toFixed(3)}B`;
  } else if (tokenAmount >= 1000000) {
    // Show millions (M) for amounts >= 1 million
    return `${(tokenAmount / 1000000).toFixed(1)}M`;
  } else if (tokenAmount >= 1000) {
    // Show thousands (K) for amounts >= 1 thousand
    return `${(tokenAmount / 1000).toFixed(1)}K`;
  } else if (tokenAmount >= 1) {
    return tokenAmount.toFixed(2);
  } else {
    return tokenAmount.toFixed(6);
  }
}
