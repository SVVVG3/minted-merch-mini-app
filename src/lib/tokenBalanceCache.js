// Token balance caching system for profiles table
import { supabaseAdmin } from './supabase';
import { checkTokenBalanceDirectly } from './blockchainAPI';

/**
 * Update user's token balance in profiles table
 * @param {number} fid - User's Farcaster ID
 * @param {Array} walletAddresses - User's wallet addresses
 * @param {number} tokenBalance - Token balance in wei (optional, will fetch if not provided)
 * @returns {Promise<Object>} Result with success status and balance
 */
export async function updateUserTokenBalance(fid, walletAddresses = [], tokenBalance = null) {
  try {
    console.log(`💰 Updating token balance for FID ${fid} with ${walletAddresses.length} wallets`);

    let finalBalance = tokenBalance;
    
    // If tokenBalance is provided, convert from tokens to wei for storage
    if (tokenBalance !== null) {
      // Convert to string to avoid scientific notation, then to BigInt for precision
      const tokensStr = tokenBalance.toString();
      const [integerPart, decimalPart = ''] = tokensStr.split('.');
      
      // Pad decimal part to 18 digits (wei precision)
      const paddedDecimal = (decimalPart + '000000000000000000').slice(0, 18);
      const weiStr = integerPart + paddedDecimal;
      
      finalBalance = weiStr;
      console.log(`🔄 Converting provided balance ${tokenBalance} tokens to ${finalBalance} wei`);
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
          const balanceResult = await checkTokenBalanceDirectly(
            ethAddresses,
            [mintedMerchContract],
            baseChainId
          );
        
        // The blockchain API returns balance in tokens (divided by 10^18)
        // We need to store it in wei (multiply by 10^18) for precision
        const tokensBalance = balanceResult.totalBalance || 0;
        
        // Convert to string to avoid scientific notation
        const tokensStr = tokensBalance.toString();
        const [integerPart, decimalPart = ''] = tokensStr.split('.');
        
        // Pad decimal part to 18 digits (wei precision)
        const paddedDecimal = (decimalPart + '000000000000000000').slice(0, 18);
        const weiStr = integerPart + paddedDecimal;
        
        finalBalance = weiStr;
          console.log(`✅ Fetched balance: ${finalBalance} wei (${tokensBalance} tokens)`);
        } catch (error) {
          console.error('❌ Error fetching token balance:', error);
          finalBalance = 0; // Default to 0 if fetch fails
        }
      }
    } else if (finalBalance === null) {
      finalBalance = 0; // No wallets, set to 0
    }

    // Update the profiles table
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        token_balance: finalBalance,
        token_balance_updated_at: new Date().toISOString()
      })
      .eq('fid', fid)
      .select('fid, token_balance, token_balance_updated_at')
      .single();

    if (error) {
      console.error(`❌ Error updating token balance for FID ${fid}:`, error);
      return {
        success: false,
        error: error.message,
        balance: finalBalance
      };
    }

    console.log(`✅ Updated token balance for FID ${fid}: ${finalBalance} tokens`);
    
    return {
      success: true,
      balance: finalBalance,
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
 * @param {Array} walletAddresses - User's wallet addresses
 * @returns {Promise<Object>} Result with balance and update status
 */
export async function refreshUserTokenBalance(fid, walletAddresses = []) {
  try {
    console.log(`🔄 Refreshing token balance for FID ${fid}`);

    // Get current cached balance
    const cachedResult = await getCachedTokenBalance(fid);
    
    // If cache is fresh (less than 10 minutes old), return cached value
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    if (cachedResult.success && cachedResult.updated_at) {
      const cacheTime = new Date(cachedResult.updated_at).getTime();
      if (cacheTime > tenMinutesAgo) {
        console.log(`💾 Using fresh cached balance for FID ${fid}: ${cachedResult.balance}`);
        return {
          success: true,
          balance: cachedResult.balance,
          fromCache: true,
          updated_at: cachedResult.updated_at
        };
      }
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
 * Format token balance for display (convert from wei to readable format)
 * @param {number|string} balance - Balance in wei (stored as BIGINT)
 * @returns {string} Formatted balance
 */
function formatTokenBalance(balance) {
  if (!balance || balance === 0) return '0';
  
  // Convert from wei (18 decimals) to readable format
  // Handle both number and string inputs (BIGINT comes as string from DB)
  const balanceWei = typeof balance === 'string' ? parseFloat(balance) : balance;
  const tokenAmount = balanceWei / Math.pow(10, 18);
  
  if (tokenAmount >= 1000000) {
    return `${(tokenAmount / 1000000).toFixed(1)}M`;
  } else if (tokenAmount >= 1000) {
    return `${(tokenAmount / 1000).toFixed(1)}K`;
  } else if (tokenAmount >= 1) {
    return tokenAmount.toFixed(2);
  } else {
    return tokenAmount.toFixed(6);
  }
}
