// Token-gating utility functions for discount eligibility
import { supabase } from './supabase';

/**
 * Check if a user is eligible for a token-gated discount
 * @param {Object} discount - Discount object from database
 * @param {number} fid - User's Farcaster ID
 * @param {Array} userWalletAddresses - User's wallet addresses
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Eligibility result
 */
export async function checkTokenGatedEligibility(discount, fid, userWalletAddresses = [], options = {}) {
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
        result = await checkTokenBalance(discount, userWalletAddresses);
        blockchainCallsCount = result.blockchainCalls || 0;
        break;
        
      case 'combined':
        result = await checkCombinedGating(discount, fid, userWalletAddresses);
        blockchainCallsCount = result.blockchainCalls || 0;
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
  if (discount.max_uses_per_user) {
    const { data: userUsage, error } = await supabase
      .from('discount_codes')
      .select('id')
      .eq('fid', fid)
      .eq('code', discount.code)
      .eq('is_used', true);

    if (error) {
      console.error('Error checking user discount usage:', error);
    } else if (userUsage && userUsage.length >= discount.max_uses_per_user) {
      return {
        eligible: false,
        reason: 'User has reached maximum uses for this discount',
        details: { 
          max_uses_per_user: discount.max_uses_per_user,
          user_uses: userUsage.length
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
 * Check NFT holding eligibility using Zapper API
 * @param {Object} discount - Discount configuration
 * @param {Array} userWalletAddresses - User's wallet addresses
 */
async function checkNftHolding(discount, userWalletAddresses) {
  const contractAddresses = discount.contract_addresses || [];
  const requiredBalance = parseFloat(discount.required_balance) || 1;
  const chainIds = discount.chain_ids || [1]; // Default to Ethereum mainnet
  
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

  console.log('🔍 Checking NFT holdings for contracts:', contractAddresses);
  
  try {
    // Import Zapper API function dynamically to avoid circular imports
    const { checkNftHoldingsWithZapper } = await import('./zapperAPI.js');
    
    const zapperResult = await checkNftHoldingsWithZapper(
      userWalletAddresses, 
      contractAddresses, 
      chainIds,
      requiredBalance
    );

    const eligible = zapperResult.hasRequiredNfts;
    const totalFound = zapperResult.totalBalance;

    return {
      eligible,
      reason: eligible
        ? `Found ${totalFound} NFTs (required: ${requiredBalance})`
        : `Found ${totalFound} NFTs, need ${requiredBalance}`,
      details: {
        required_balance: requiredBalance,
        found_balance: totalFound,
        contracts_checked: contractAddresses,
        chains_checked: chainIds,
        collection_details: zapperResult.collectionBalances || [],
        zapper_result: zapperResult
      },
      blockchainCalls: zapperResult.apiCalls || 1
    };

  } catch (error) {
    console.error('❌ Error checking NFT holdings:', error);
    return {
      eligible: false,
      reason: `NFT check failed: ${error.message}`,
      details: { error: error.message },
      blockchainCalls: 0
    };
  }
}

/**
 * Check token balance eligibility using Zapper API
 */
async function checkTokenBalance(discount, userWalletAddresses) {
  const contractAddresses = discount.contract_addresses || [];
  const requiredBalance = parseFloat(discount.required_balance) || 1;
  const chainIds = discount.chain_ids || [1];
  
  if (contractAddresses.length === 0) {
    return {
      eligible: false,
      reason: 'No token contract addresses configured',
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

  console.log('🪙 Checking token balances for contracts:', contractAddresses);
  
  try {
    // Import Zapper API function dynamically to avoid circular imports
    const { checkTokenHoldingsWithZapper } = await import('./zapperAPI.js');
    
    const zapperResult = await checkTokenHoldingsWithZapper(
      userWalletAddresses,
      contractAddresses,
      chainIds,
      requiredBalance
    );

    const eligible = zapperResult.hasRequiredTokens;
    const totalFound = zapperResult.totalBalance;

    return {
      eligible,
      reason: eligible
        ? `Found ${totalFound} tokens (required: ${requiredBalance})`
        : `Found ${totalFound} tokens, need ${requiredBalance}`,
      details: {
        required_balance: requiredBalance,
        found_balance: totalFound,
        contracts_checked: contractAddresses,
        chains_checked: chainIds,
        token_details: zapperResult.tokenBalances || [],
        zapper_result: zapperResult
      },
      blockchainCalls: zapperResult.apiCalls || 1
    };

  } catch (error) {
    console.error('❌ Error checking token balances:', error);
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
    const tokenResult = await checkTokenBalance(discount, userWalletAddresses);
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
    const { error } = await supabase
      .from('discount_eligibility_checks')
      .insert({
        discount_code_id: discountCodeId,
        fid,
        wallet_address: walletAddress,
        is_eligible: result.eligible,
        eligibility_reason: result.reason,
        token_balance_found: result.details?.found_balance,
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
export async function getEligibleAutoApplyDiscounts(fid, userWalletAddresses = [], productScope = 'site_wide', productIds = []) {
  try {
    console.log('🎯 Getting eligible auto-apply discounts for FID:', fid);

    // Fetch auto-apply discounts that haven't expired
    const { data: autoApplyDiscounts, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('auto_apply', true)
      .eq('is_used', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('priority_level', { ascending: false }) // Higher priority first
      .order('discount_value', { ascending: false }); // Higher value first

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
      // Check scope matching
      if (!doesDiscountMatchScope(discount, productScope, productIds)) {
        continue;
      }

      // Check token-gating eligibility
      const eligibility = await checkTokenGatedEligibility(discount, fid, userWalletAddresses);
      
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
function doesDiscountMatchScope(discount, productScope, productIds = []) {
  // Site-wide discounts always match
  if (discount.discount_scope === 'site_wide') {
    return true;
  }

  // Product-specific discounts
  if (discount.discount_scope === 'product') {
    if (productScope !== 'product' || productIds.length === 0) {
      return false;
    }
    
    const targetProducts = discount.target_products || [];
    return productIds.some(productId => targetProducts.includes(productId));
  }

  // Collection-specific discounts
  if (discount.discount_scope === 'collection') {
    // Implementation depends on how you structure collections
    return false; // Placeholder
  }

  // Category-specific discounts  
  if (discount.discount_scope === 'category') {
    // Implementation depends on how you structure categories
    return false; // Placeholder
  }

  return false;
}

/**
 * Create example token-gated discounts (for testing/admin)
 */
export async function createExampleTokenGatedDiscounts() {
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
    }
  ];

  console.log('Creating example token-gated discounts...');
  
  for (const example of examples) {
    try {
      const { data, error } = await supabase
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