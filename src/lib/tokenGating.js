// Token-gating utility functions for discount eligibility
import { supabaseAdmin } from './supabase';

/**
 * Convert Shopify product IDs to Supabase products table IDs
 */
async function convertShopifyIdsToSupabaseIds(shopifyIds) {
  if (!shopifyIds || shopifyIds.length === 0) {
    return [];
  }

  if (!supabaseAdmin) {
    console.warn('⚠️ Supabase not available, cannot convert product IDs');
    return [];
  }

  try {
    // Convert Shopify product IDs to a format we can search for
    const cleanIds = shopifyIds.map(id => {
      if (typeof id === 'string' && id.includes('gid://shopify/Product/')) {
        return id.split('/').pop(); // Extract the numeric ID
      }
      return id.toString();
    });

    console.log(`🔄 Converting Shopify IDs to Supabase IDs: ${JSON.stringify(cleanIds)}`);
    
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, shopify_id')
      .in('shopify_id', cleanIds);

    if (error) {
      throw error;
    }

    const supabaseIds = (products || []).map(p => p.id);
    console.log(`✅ Converted to Supabase IDs: ${JSON.stringify(supabaseIds)}`);
    
    return supabaseIds;
  } catch (error) {
    console.error('❌ Error in convertShopifyIdsToSupabaseIds:', error);
    return [];
  }
}

/**
 * Get Supabase product ID by handle (for easy discount creation)
 */
export async function getProductIdByHandle(handle) {
  if (!supabaseAdmin) {
    console.warn('⚠️ Supabase not available, cannot get product ID');
    return null;
  }

  try {
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('handle', handle)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.warn(`Product not found for handle: ${handle}`);
        return null;
      }
      throw error;
    }

    return product?.id || null;
  } catch (error) {
    console.error(`Error getting product ID for handle ${handle}:`, error);
    return null;
  }
}

/**
 * Check if a user is eligible for a token-gated discount
 * @param {Object} discount - Discount object from database
 * @param {number} fid - User's Farcaster ID
 * @param {Array} userWalletAddresses - User's wallet addresses
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Eligibility result
 */
export async function checkTokenGatedEligibility(discount, fid, userWalletAddresses = [], options = {}, useCacheOnly = false) {
  const startTime = Date.now();
  let blockchainCallsCount = 0;
  
  try {
    console.log('🎫 Checking token-gated eligibility:', {
      discount_code: discount.code,
      gating_type: discount.gating_type,
      fid,
      wallet_count: userWalletAddresses.length
    });

    // If no gating, automatically eligible
    if (!discount.gating_type || discount.gating_type === 'none') {
      return {
        eligible: true,
        reason: 'No token-gating required',
        details: {}
      };
    }

    // Check basic discount validity first
    const basicEligibility = await checkBasicDiscountEligibility(discount, fid);
    if (!basicEligibility.eligible) {
      return basicEligibility;
    }

    // Route to specific gating check based on type
    let result;
    switch (discount.gating_type) {
      case 'whitelist_fid':
        result = await checkFidWhitelist(discount, fid);
        break;
        
      case 'whitelist_wallet':
        result = await checkWalletWhitelist(discount, userWalletAddresses);
        break;
        
      case 'nft_holding':
        result = await checkNftHolding(discount, userWalletAddresses);
        blockchainCallsCount = result.blockchainCalls || 0;
        break;
        
      case 'token_balance':
        result = await checkTokenBalance(discount, userWalletAddresses, fid, useCacheOnly);
        blockchainCallsCount = result.blockchainCalls || 0;
        break;
        
      case 'combined':
        result = await checkCombinedGating(discount, fid, userWalletAddresses);
        blockchainCallsCount = result.blockchainCalls || 0;
        break;
        
      case 'bankr_club':
        result = await checkBankrClubGating(discount, fid);
        break;
        
      default:
        result = {
          eligible: false,
          reason: `Unknown gating type: ${discount.gating_type}`,
          details: {}
        };
    }

    // Log the eligibility check for analytics
    await logEligibilityCheck(discount.id, fid, userWalletAddresses[0], result, {
      duration: Date.now() - startTime,
      blockchainCalls: blockchainCallsCount,
      userAgent: options.userAgent,
      ipAddress: options.ipAddress
    });

    return result;

  } catch (error) {
    console.error('❌ Error checking token-gated eligibility:', error);
    
    // Log failed check
    await logEligibilityCheck(discount.id, fid, userWalletAddresses[0], {
      eligible: false,
      reason: `Check failed: ${error.message}`,
      details: { error: error.message }
    }, {
      duration: Date.now() - startTime,
      blockchainCalls: blockchainCallsCount
    });

    return {
      eligible: false,
      reason: 'Eligibility check failed',
      details: { error: error.message }
    };
  }
}

/**
 * Check basic discount eligibility (usage limits, expiration, etc.)
 */
async function checkBasicDiscountEligibility(discount, fid) {
  // Check if discount is expired
  if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
    return {
      eligible: false,
      reason: 'Discount has expired',
      details: { expires_at: discount.expires_at }
    };
  }

  // Check if discount has reached max total uses
  if (discount.max_uses_total && discount.current_total_uses >= discount.max_uses_total) {
    return {
      eligible: false,
      reason: 'Discount has reached maximum total uses',
      details: { 
        max_uses: discount.max_uses_total,
        current_uses: discount.current_total_uses
      }
    };
  }

  // Check user-specific usage limits
  if (discount.max_uses_per_user && supabaseAdmin) {
    let userUsageCount = 0;
    
    if (discount.is_shared_code) {
      // For shared codes, check usage in discount_code_usage table
      const { data: sharedUsage, error } = await supabaseAdmin
        .from('discount_code_usage')
        .select('id')
        .eq('discount_code_id', discount.id)
        .eq('fid', fid);

      if (error) {
        console.error('Error checking shared discount usage:', error);
      } else {
        userUsageCount = sharedUsage ? sharedUsage.length : 0;
      }
    } else {
      // For user-specific codes, check usage in discount_codes table
      const { data: userUsage, error } = await supabaseAdmin
        .from('discount_codes')
        .select('id')
        .eq('fid', fid)
        .eq('code', discount.code)
        .eq('is_used', true);

      if (error) {
        console.error('Error checking user discount usage:', error);
      } else {
        userUsageCount = userUsage ? userUsage.length : 0;
      }
    }

    if (userUsageCount >= discount.max_uses_per_user) {
      return {
        eligible: false,
        reason: 'User has reached maximum uses for this discount',
        details: { 
          max_uses_per_user: discount.max_uses_per_user,
          user_uses: userUsageCount,
          is_shared_code: discount.is_shared_code
        }
      };
    }
  }

  return {
    eligible: true,
    reason: 'Basic eligibility checks passed',
    details: {}
  };
}

/**
 * Check FID whitelist eligibility
 */
async function checkFidWhitelist(discount, fid) {
  const whitelistedFids = discount.whitelisted_fids || [];
  const eligible = whitelistedFids.includes(fid);
  
  return {
    eligible,
    reason: eligible 
      ? 'FID found in whitelist' 
      : 'FID not found in whitelist',
    details: {
      fid,
      whitelisted_fids_count: whitelistedFids.length,
      is_whitelisted: eligible
    }
  };
}

/**
 * Check wallet address whitelist eligibility
 */
async function checkWalletWhitelist(discount, userWalletAddresses) {
  const whitelistedWallets = (discount.whitelisted_wallets || []).map(addr => addr.toLowerCase());
  
  // Check if any user wallet is in the whitelist
  const matchingWallet = userWalletAddresses.find(userAddr => 
    whitelistedWallets.includes(userAddr.toLowerCase())
  );
  
  const eligible = !!matchingWallet;
  
  return {
    eligible,
    reason: eligible 
      ? `Wallet ${matchingWallet} found in whitelist`
      : 'No user wallets found in whitelist',
    details: {
      user_wallets_count: userWalletAddresses.length,
      whitelisted_wallets_count: whitelistedWallets.length,
      matching_wallet: matchingWallet
    }
  };
}

/**
 * Check NFT holding eligibility - supports both ERC-721 and ERC-1155
 * @param {Object} discount - Discount configuration
 * @param {Array} userWalletAddresses - User's wallet addresses
 */
async function checkNftHolding(discount, userWalletAddresses) {
  const contractAddresses = discount.contract_addresses || [];
  const requiredBalance = parseFloat(discount.required_balance) || 1;
  const chainIds = discount.chain_ids || [1]; // Default to Ethereum mainnet
  const nftType = discount.nft_type || 'erc721'; // Default to ERC-721 for backwards compatibility
  const tokenIds = discount.token_ids || []; // For ERC-1155 only
  
  if (contractAddresses.length === 0) {
    return {
      eligible: false,
      reason: 'No NFT contract addresses configured',
      details: {}
    };
  }

  if (userWalletAddresses.length === 0) {
    return {
      eligible: false,
      reason: 'No wallet addresses provided',
      details: {}
    };
  }

  console.log(`🔍 Checking ${nftType.toUpperCase()} NFT holdings for contracts:`, contractAddresses);
  
  try {
    // ERC-1155 NFT check
    if (nftType === 'erc1155') {
      if (tokenIds.length === 0) {
        return {
          eligible: false,
          reason: 'ERC-1155 requires token IDs to be specified',
          details: { nft_type: nftType }
        };
      }

      // Import the ERC-1155 check function
      const { checkERC1155Balance } = await import('./blockchainAPI.js');
      
      let totalNfts = 0;
      const collectionDetails = [];
      const chainId = chainIds[0] || 8453; // Default to Base for ERC-1155

      // Check each contract + token ID combination
      for (const contractAddress of contractAddresses) {
        for (const tokenId of tokenIds) {
          console.log(`🎫 Checking ERC-1155: contract ${contractAddress}, token ID ${tokenId}`);
          
          const result = await checkERC1155Balance(
            userWalletAddresses,
            contractAddress,
            tokenId,
            chainId
          );

          if (result.success) {
            totalNfts += result.totalBalance;
            collectionDetails.push({
              contractAddress,
              tokenId,
              balance: result.totalBalance,
              chainId
            });

            console.log(`✅ Found ${result.totalBalance} of token ID ${tokenId}`);
          } else {
            console.warn(`⚠️ ERC-1155 check failed for token ${tokenId}:`, result.error);
          }
        }
      }

      const eligible = totalNfts >= requiredBalance;

      return {
        eligible,
        reason: eligible
          ? `Found ${totalNfts} ERC-1155 NFTs (required: ${requiredBalance})`
          : `Found ${totalNfts} ERC-1155 NFTs, need ${requiredBalance}`,
        details: {
          nft_type: 'erc1155',
          required_balance: requiredBalance,
          found_balance: totalNfts,
          contracts_checked: contractAddresses,
          token_ids_checked: tokenIds,
          chains_checked: chainIds,
          collection_details: collectionDetails
        },
        blockchainCalls: contractAddresses.length * tokenIds.length
      };
    }

    // ERC-721 NFT check (existing logic)
    const { checkNftHoldingsWithZapper } = await import('./blockchainAPI.js');
    
    const zapperResult = await checkNftHoldingsWithZapper(
      userWalletAddresses, 
      contractAddresses, 
      chainIds,
      requiredBalance
    );

    const eligible = zapperResult.eligible;
    const totalFound = zapperResult.totalNfts;

    return {
      eligible,
      reason: eligible
        ? `Found ${totalFound} ERC-721 NFTs (required: ${requiredBalance})`
        : `Found ${totalFound} ERC-721 NFTs, need ${requiredBalance}`,
      details: {
        nft_type: 'erc721',
        required_balance: requiredBalance,
        found_balance: totalFound,
        contracts_checked: contractAddresses,
        chains_checked: chainIds,
        collection_details: zapperResult.collectionDetails || [],
        zapper_result: zapperResult
      },
      blockchainCalls: 1
    };

  } catch (error) {
    console.error('❌ Error checking NFT holdings:', error);
    return {
      eligible: false,
      reason: `NFT check failed: ${error.message}`,
      details: { error: error.message, nft_type: nftType },
      blockchainCalls: 0
    };
  }
}

/**
 * Check token balance eligibility using cached balance from profiles table
 */
async function checkTokenBalance(discount, userWalletAddresses, fid = null, useCacheOnly = false) {
  const contractAddresses = discount.contract_addresses || [];
  const requiredBalance = parseFloat(discount.required_balance) || 1;
  
  // Fix chain ID for mintedmerch token - it's on Base, not Ethereum
  let chainIds = discount.chain_ids || [1];
  if (contractAddresses.includes('0x774EAeFE73Df7959496Ac92a77279A8D7d690b07')) {
    chainIds = [8453]; // Force Base chain for mintedmerch token
    console.log('🔧 Corrected chain ID to Base (8453) for mintedmerch token');
  }
  
  if (contractAddresses.length === 0) {
    return {
      eligible: false,
      reason: 'No token contract addresses configured',
      details: {}
    };
  }

  if (userWalletAddresses.length === 0 && !fid) {
    return {
      eligible: false,
      reason: 'No wallet addresses or FID provided - cannot check token balance',
      details: {}
    };
  }

  console.log('🪙 Checking token balances for contracts:', contractAddresses);
  
  try {
    // 🔗 USE CACHED BALANCE FROM PROFILES TABLE FOR BETTER PERFORMANCE
    console.log('💾 Using cached token balance from profiles table for better UX');
    
    // Import token balance cache functions
    const { refreshUserTokenBalance, getCachedTokenBalance } = await import('./tokenBalanceCache.js');
    
    // Filter valid Ethereum addresses (if any provided)
    const validAddresses = userWalletAddresses.filter(addr => 
      typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42
    );

    // If no valid addresses and no FID, we can't check anything
    if (validAddresses.length === 0 && !fid) {
      return {
        eligible: false,
        reason: 'No valid wallet addresses or FID found',
        details: { provided_addresses: userWalletAddresses },
        blockchainCalls: 0
      };
    }

    // If FID is provided but no wallet addresses, refreshUserTokenBalance will fetch them from database
    if (validAddresses.length === 0 && fid) {
      console.log(`📋 No wallet addresses provided, but FID ${fid} available - will fetch from database`);
    }
    
    let totalBalance = 0;
    let blockchainCalls = 0;
    let method = 'cached';

    // Check if this is the $MINTEDMERCH token (which we cache in profiles table)
    const mintedMerchContract = '0x774EAeFE73Df7959496Ac92a77279A8D7d690b07';
    const isMintedMerchToken = contractAddresses.some(addr => 
      addr.toLowerCase() === mintedMerchContract.toLowerCase()
    );

    // If FID is provided AND checking $MINTEDMERCH token, try to get cached balance
    if (fid && isMintedMerchToken) {
      console.log(`💾 Checking cached balance for FID ${fid} ($MINTEDMERCH token)${useCacheOnly ? ' (cache-only mode)' : ''}`);
      const balanceResult = await refreshUserTokenBalance(fid, validAddresses, false, useCacheOnly);
      
      if (balanceResult.success) {
        totalBalance = balanceResult.balance || 0;
        method = balanceResult.fromCache ? 'cached' : 'fresh_fetch';
        blockchainCalls = balanceResult.fromCache ? 0 : validAddresses.length;
        
        console.log(`💰 Token balance for FID ${fid}: ${totalBalance} (${method})`);
      } else if (useCacheOnly) {
        console.log(`🏪 Cache-only mode: No cached balance found for FID ${fid}, returning 0`);
        totalBalance = 0;
        method = 'cache_only_miss';
        blockchainCalls = 0;
      } else {
        console.warn(`⚠️ Failed to get cached balance for FID ${fid}, falling back to direct RPC`);
        // Fall back to direct RPC check
        const { checkTokenBalanceDirectly } = await import('./blockchainAPI.js');
        totalBalance = await checkTokenBalanceDirectly(
          validAddresses,
          contractAddresses,
          chainIds[0] || 8453
        );
        method = 'direct_rpc_fallback';
        blockchainCalls = validAddresses.length;
      }
    } else if (!isMintedMerchToken) {
      // For non-$MINTEDMERCH tokens, always use direct RPC (no cache available)
      console.log(`🔗 Checking balance for non-$MINTEDMERCH token (${contractAddresses.join(', ')}) - using direct RPC`);
      const { checkTokenBalanceDirectly } = await import('./blockchainAPI.js');
      totalBalance = await checkTokenBalanceDirectly(
        validAddresses,
        contractAddresses,
        chainIds[0] || 8453
      );
      method = 'direct_rpc';
      blockchainCalls = validAddresses.length;
    } else {
      // No FID provided, use direct RPC check
      console.log('🔗 No FID provided, using direct RPC check');
      const { checkTokenBalanceDirectly } = await import('./blockchainAPI.js');
      totalBalance = await checkTokenBalanceDirectly(
        validAddresses,
        contractAddresses,
        chainIds[0] || 8453
      );
      method = 'direct_rpc';
      blockchainCalls = validAddresses.length;
    }

    // All balance sources already return token values (not wei):
    // - checkTokenBalanceDirectly converts wei to tokens internally
    // - Database cache stores tokens (not wei)
    // - refreshUserTokenBalance returns tokens
    const totalBalanceInTokens = totalBalance;
    
    const eligible = totalBalanceInTokens >= requiredBalance;

    console.log('🪙 Token balance eligibility result:', {
      eligible,
      totalBalance,
      totalBalanceInTokens,
      requiredBalance,
      contractAddresses,
      chainId: chainIds[0] || 8453,
      walletCount: validAddresses.length,
      method,
      fid
    });

    return {
      eligible,
      reason: eligible
        ? `Found ${totalBalanceInTokens.toLocaleString()} tokens (required: ${requiredBalance.toLocaleString()})`
        : `Found ${totalBalanceInTokens.toLocaleString()} tokens, need ${requiredBalance.toLocaleString()}`,
      details: {
        required_balance: requiredBalance,
        found_balance: totalBalanceInTokens,
        found_balance_wei: totalBalance,
        contracts_checked: contractAddresses,
        chains_checked: chainIds,
        valid_addresses: validAddresses,
        method,
        fid
      },
      blockchainCalls
    };

  } catch (error) {
    console.error('❌ Error checking token balances via direct RPC:', error);
    return {
      eligible: false,
      reason: `Token balance check failed: ${error.message}`,
      details: { error: error.message },
      blockchainCalls: 0
    };
  }
}

/**
 * Check combined gating (multiple requirements)
 */
async function checkCombinedGating(discount, fid, userWalletAddresses) {
  const gatingConfig = discount.gating_config || {};
  const results = [];
  let totalBlockchainCalls = 0;

  // This would implement complex logic for combining multiple gating types
  // For now, we'll implement a simple AND logic
  
  if (gatingConfig.require_fid_whitelist) {
    const fidResult = await checkFidWhitelist(discount, fid);
    results.push(fidResult);
  }

  if (gatingConfig.require_wallet_whitelist) {
    const walletResult = await checkWalletWhitelist(discount, userWalletAddresses);
    results.push(walletResult);
  }

  if (gatingConfig.require_nft_holding) {
    const nftResult = await checkNftHolding(discount, userWalletAddresses);
    results.push(nftResult);
    totalBlockchainCalls += nftResult.blockchainCalls || 0;
  }

  if (gatingConfig.require_token_balance) {
    const tokenResult = await checkTokenBalance(discount, userWalletAddresses, fid);
    results.push(tokenResult);
    totalBlockchainCalls += tokenResult.blockchainCalls || 0;
  }

  // Check if all requirements pass (AND logic)
  const allPassed = results.every(result => result.eligible);
  const failedChecks = results.filter(result => !result.eligible);

  return {
    eligible: allPassed,
    reason: allPassed 
      ? 'All combined gating requirements met'
      : `Failed requirements: ${failedChecks.map(r => r.reason).join(', ')}`,
    details: {
      total_checks: results.length,
      passed_checks: results.filter(r => r.eligible).length,
      failed_checks: failedChecks.length,
      individual_results: results
    },
    blockchainCalls: totalBlockchainCalls
  };
}

/**
 * Check Bankr Club membership eligibility
 */
async function checkBankrClubGating(discount, fid) {
  try {
    console.log('🏛️ Checking Bankr Club membership eligibility for FID:', fid);
    
    if (!supabaseAdmin) {
      console.warn('⚠️ Supabase not available for Bankr Club check');
      return {
        eligible: false,
        reason: 'Cannot verify Bankr Club membership - database unavailable',
        details: { error: 'Supabase not available' }
      };
    }

    if (!fid) {
      return {
        eligible: false,
        reason: 'FID required for Bankr Club membership check',
        details: { fid: null }
      };
    }

    // 🔒 Set user context for RLS policies
    const { setUserContext } = await import('./auth.js');
    await setUserContext(fid);

    // Fetch user profile to check Bankr Club membership status
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('bankr_club_member, x_username, bankr_membership_updated_at')
      .eq('fid', fid)
      .maybeSingle(); // Use maybeSingle() to avoid PGRST116 error for new users

    if (error) {
      console.error('❌ Error fetching profile for Bankr Club check:', error);
      return {
        eligible: false,
        reason: 'Failed to check Bankr Club membership status',
        details: { error: error.message, fid }
      };
    }

    if (!profile) {
      return {
        eligible: false,
        reason: 'User profile not found for Bankr Club check',
        details: { fid }
      };
    }

    const isBankrClubMember = profile.bankr_club_member === true;
    const membershipUpdatedAt = profile.bankr_membership_updated_at;
    const xUsername = profile.x_username;

    // Check if membership data is recent (within last 7 days)
    const isRecentCheck = membershipUpdatedAt && 
      (new Date() - new Date(membershipUpdatedAt)) < (7 * 24 * 60 * 60 * 1000);

    console.log('🏛️ Bankr Club membership check result:', {
      fid,
      isBankrClubMember,
      isRecentCheck,
      membershipUpdatedAt,
      xUsername
    });

    return {
      eligible: isBankrClubMember,
      reason: isBankrClubMember 
        ? 'User is a verified Bankr Club member'
        : 'User is not a Bankr Club member',
      details: {
        fid,
        bankr_club_member: isBankrClubMember,
        x_username: xUsername,
        membership_updated_at: membershipUpdatedAt,
        is_recent_check: isRecentCheck,
        check_age_days: membershipUpdatedAt ? 
          Math.floor((new Date() - new Date(membershipUpdatedAt)) / (24 * 60 * 60 * 1000)) : null
      }
    };

  } catch (error) {
    console.error('❌ Error in checkBankrClubGating:', error);
    return {
      eligible: false,
      reason: `Bankr Club check failed: ${error.message}`,
      details: { error: error.message, fid }
    };
  }
}

/**
 * Placeholder function for NFT balance checking
 * In production, integrate with Alchemy, Moralis, or direct blockchain calls
 */
async function checkNftBalancePlaceholder(walletAddresses, contractAddresses, chainIds, requiredBalance) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Mock response - in production this would make real blockchain calls
  return {
    totalBalance: Math.random() > 0.7 ? requiredBalance : 0, // 30% chance of having NFTs
    contractBalances: contractAddresses.map(contract => ({
      contract,
      balance: Math.random() > 0.7 ? 1 : 0
    })),
    apiCalls: contractAddresses.length * walletAddresses.length
  };
}

/**
 * Placeholder function for token balance checking
 */
async function checkTokenBalancePlaceholder(walletAddresses, contractAddresses, chainIds, requiredBalance) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Mock response
  return {
    totalBalance: Math.random() > 0.6 ? requiredBalance * 2 : requiredBalance * 0.5, // 40% chance of having enough
    contractBalances: contractAddresses.map(contract => ({
      contract,
      balance: Math.random() * requiredBalance * 2
    })),
    apiCalls: contractAddresses.length * walletAddresses.length
  };
}

/**
 * Log eligibility check for analytics and debugging
 */
async function logEligibilityCheck(discountCodeId, fid, walletAddress, result, metadata) {
  try {
    const { error } = await supabaseAdmin
      .from('discount_eligibility_checks')
      .insert({
        discount_code_id: discountCodeId,
        fid,
        wallet_address: walletAddress,
        is_eligible: result.eligible,
        eligibility_reason: result.reason,
        token_balance_found: result.details?.found_balance ? 
          (typeof result.details.found_balance === 'string' && result.details.found_balance.length > 18 ? 
            Number(result.details.found_balance) / Math.pow(10, 18) : 
            result.details.found_balance) : null,
        contracts_checked: result.details?.contracts_checked || [],
        check_duration_ms: metadata.duration,
        blockchain_calls_made: metadata.blockchainCalls || 0,
        user_agent: metadata.userAgent,
        ip_address: metadata.ipAddress
      });

    if (error) {
      console.error('Error logging eligibility check:', error);
    }
  } catch (error) {
    console.error('Error in logEligibilityCheck:', error);
  }
}

/**
 * Get all auto-apply discounts that a user is eligible for
 * @param {number} fid - User's Farcaster ID  
 * @param {Array} userWalletAddresses - User's wallet addresses
 * @param {string} productScope - 'site_wide', 'product', etc.
 * @param {Array} productIds - Product IDs for product-specific discounts
 * @returns {Promise<Array>} Array of eligible auto-apply discounts
 */
export async function getEligibleAutoApplyDiscounts(fid, userWalletAddresses = [], productScope = 'site_wide', productIds = [], useCacheOnly = false) {
  try {
    console.log('🎯 Getting eligible auto-apply discounts for FID:', fid);

    if (!supabaseAdmin) {
      console.log('⚠️ Supabase not available, using mock data');
      return [];
    }

    // Build query to fetch auto-apply discounts that haven't expired
    let query = supabaseAdmin
      .from('discount_codes')
      .select('*')
      .eq('auto_apply', true)
      .eq('is_used', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      
    // Filter by scope if specified
    if (productScope === 'site_wide') {
      query = query.eq('discount_scope', 'site_wide');
      console.log('🌐 Filtering for site-wide discounts only');
    } else if (productScope === 'product') {
      query = query.eq('discount_scope', 'product');
      console.log('🎯 Filtering for product-specific discounts only');
    } else if (productScope === 'all') {
      console.log('🔍 Checking all discount scopes (site-wide + product-specific)');
      // No additional filter - get all auto-apply discounts regardless of scope
    }
    
    const { data: autoApplyDiscounts, error } = await query
      .order('priority_level', { ascending: false }) // Higher priority first
      .order('discount_value', { ascending: false });

    if (error) {
      console.error('Error fetching auto-apply discounts:', error);
      return [];
    }

    if (!autoApplyDiscounts || autoApplyDiscounts.length === 0) {
      console.log('No auto-apply discounts found');
      return [];
    }

    console.log(`Found ${autoApplyDiscounts.length} potential auto-apply discounts`);

    // Check eligibility for each discount
    const eligibleDiscounts = [];
    
    for (const discount of autoApplyDiscounts) {
      // Check scope matching (now async)
      const scopeMatches = await doesDiscountMatchScope(discount, productScope, productIds);
      if (!scopeMatches) {
        console.log('❌ Scope mismatch for discount:', discount.code);
        continue;
      }

      // Check token-gating eligibility
      const eligibility = await checkTokenGatedEligibility(discount, fid, userWalletAddresses, {}, useCacheOnly);
      
      if (eligibility.eligible) {
        eligibleDiscounts.push({
          ...discount,
          eligibility_details: eligibility
        });
        
        console.log('✅ User eligible for auto-apply discount:', discount.code);
      } else {
        console.log('❌ User not eligible for discount:', discount.code, '-', eligibility.reason);
      }
    }

    console.log(`User eligible for ${eligibleDiscounts.length} auto-apply discounts`);
    return eligibleDiscounts;

  } catch (error) {
    console.error('Error getting eligible auto-apply discounts:', error);
    return [];
  }
}

/**
 * Check if a discount matches the current scope (product, collection, etc.)
 */
async function doesDiscountMatchScope(discount, productScope, productIds = []) {
  console.log(`🔍 Scope check for discount ${discount.code}:`);
  console.log(`  - Discount scope: ${discount.discount_scope}`);
  console.log(`  - Requested scope: ${productScope}`);
  console.log(`  - Product IDs (Shopify): ${JSON.stringify(productIds)}`);
  console.log(`  - Target products (legacy): ${JSON.stringify(discount.target_products)}`);
  console.log(`  - Target product IDs (new): ${JSON.stringify(discount.target_product_ids)}`);
  
  // If requesting all scopes, we still need to check product matching for product-specific discounts
  if (productScope === 'all') {
    console.log(`  🔍 All scopes requested - still need to check product matching for product-specific discounts`);
    // Don't return true immediately - continue with the scope checks below
  }
  
  // Site-wide discounts always match
  if (discount.discount_scope === 'site_wide') {
    console.log(`  ✅ Site-wide discount matches`);
    return true;
  }

  // Product-specific discounts
  if (discount.discount_scope === 'product') {
    if (productScope !== 'product' && productScope !== 'all') {
      console.log(`  ❌ Product-specific discount but scope is ${productScope}`);
      return false;
    }
    
    if (productIds.length === 0) {
      console.log(`  ❌ Product-specific discount but no product IDs provided`);
      return false;
    }
    
    // Try new products table approach first
    if (discount.target_product_ids && discount.target_product_ids.length > 0) {
      console.log(`  🆕 Using new products table for matching`);
      
      try {
        // Check if productIds are already Supabase IDs (numbers) or Shopify IDs (strings with gid://)
        let supabaseProductIds = [];
        
        if (productIds.length > 0 && typeof productIds[0] === 'number') {
          // These are already Supabase product IDs
          supabaseProductIds = productIds;
          console.log(`  - Product IDs are already Supabase IDs: ${JSON.stringify(supabaseProductIds)}`);
        } else {
          // These are Shopify product IDs, convert them
          supabaseProductIds = await convertShopifyIdsToSupabaseIds(productIds);
          console.log(`  - Converted Shopify IDs to Supabase IDs: ${JSON.stringify(supabaseProductIds)}`);
        }
        
        const matches = supabaseProductIds.some(productId => 
          discount.target_product_ids.includes(productId)
        );
        
        console.log(`  ${matches ? '✅' : '❌'} Product match result (new table): ${matches}`);
        return matches;
      } catch (error) {
        console.error('  ❌ Error converting product IDs, falling back to legacy:', error);
      }
    }
    
    // Fall back to legacy target_products (handles)
    if (discount.target_products && discount.target_products.length > 0) {
      console.log(`  🔄 Using legacy target_products for matching`);
      
      try {
        // Convert Supabase product IDs to handles for legacy comparison
        const { data: products, error } = await supabaseAdmin
          .from('products')
          .select('id, handle')
          .in('id', productIds);
        
        if (error) throw error;
        
        const productHandles = (products || []).map(p => p.handle);
        console.log(`  - Current product handles: ${JSON.stringify(productHandles)}`);
        console.log(`  - Target product handles: ${JSON.stringify(discount.target_products)}`);
        
        const matches = productHandles.some(handle => 
          discount.target_products.includes(handle)
        );
        
        console.log(`  ${matches ? '✅' : '❌'} Product match result (legacy): ${matches}`);
        return matches;
      } catch (error) {
        console.error('  ❌ Error converting Supabase IDs to handles for legacy comparison:', error);
        return false;
      }
    }
    
    console.log(`  ❌ No target products defined for product-specific discount`);
    return false;
  }

  // Collection-specific discounts
  if (discount.discount_scope === 'collection') {
    console.log(`  ❌ Collection scope not implemented yet`);
    return false; // Placeholder
  }

  // Category-specific discounts  
  if (discount.discount_scope === 'category') {
    console.log(`  ❌ Category scope not implemented yet`);
    return false; // Placeholder
  }

  console.log(`  ❌ Unknown scope: ${discount.discount_scope}`);
  return false;
}

/**
 * Create example token-gated discounts (for testing/admin)
 */
export async function createExampleTokenGatedDiscounts() {
  if (!supabaseAdmin) {
    console.log('⚠️ Supabase not available, cannot create example discounts');
    return [];
  }

  const examples = [
    {
      code: 'NOUNS20',
      discount_type: 'percentage',
      discount_value: 20,
      discount_scope: 'site_wide',
      gating_type: 'nft_holding',
      contract_addresses: ['0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03'], // Nouns NFT
      required_balance: 1,
      chain_ids: [1], // Ethereum
      auto_apply: true,
      priority_level: 10,
      discount_description: '20% off for Nouns NFT holders',
      campaign_id: 'nft_holders_2025',
      code_type: 'promotional'
    },
    {
      code: 'WHALETOKEN10',
      discount_type: 'percentage', 
      discount_value: 10,
      discount_scope: 'site_wide',
      gating_type: 'token_balance',
      contract_addresses: ['0xA0b86a33E6441e6cD5E5B9a5FD70b2F3E4b4b23e'], // Example token
      required_balance: 1000, // Need 1000+ tokens
      chain_ids: [1],
      auto_apply: true,
      priority_level: 5,
      discount_description: '10% off for whale token holders',
      campaign_id: 'token_holders_2025',
      code_type: 'promotional'
    },
    {
      code: 'VIP50',
      discount_type: 'percentage',
      discount_value: 50,
      discount_scope: 'site_wide', 
      gating_type: 'whitelist_fid',
      whitelisted_fids: [466111, 194, 3], // Example FIDs
      auto_apply: true,
      priority_level: 15,
      max_uses_total: 100,
      discount_description: 'VIP 50% discount for special users',
      campaign_id: 'vip_users_2025',
      code_type: 'promotional'
    },
    {
      code: 'BANKRCLUB15',
      discount_type: 'percentage',
      discount_value: 15,
      discount_scope: 'site_wide',
      gating_type: 'bankr_club',
      auto_apply: true,
      priority_level: 12,
      discount_description: '15% off for Bankr Club members',
      campaign_id: 'bankr_club_members_2025',
      code_type: 'promotional'
    }
  ];

  console.log('Creating example token-gated discounts...');
  
  for (const example of examples) {
    try {
      const { data, error } = await supabaseAdmin
        .from('discount_codes')
        .insert({
          ...example,
          fid: 466111, // Default to your FID for creation
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating example discount:', example.code, error);
      } else {
        console.log('✅ Created example discount:', data.code);
      }
    } catch (error) {
      console.error('Error in createExampleTokenGatedDiscounts:', error);
    }
  }
} 