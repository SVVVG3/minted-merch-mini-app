// Minted Merch Missions helper functions
// Handles checking missions eligibility:
// - Merch Moguls: 50M+ tokens (wallet + staked)
// - Stakers: 1M+ tokens staked
// Both groups can access missions, complete bounties, and earn payouts

import { supabaseAdmin } from './supabase';

const MOGUL_TOKEN_THRESHOLD = 50_000_000; // 50M tokens required for Merch Mogul status
const STAKER_TOKEN_THRESHOLD = 10_000_000; // 10M staked tokens required for interaction missions
const CUSTOM_BOUNTY_STAKED_THRESHOLD = 50_000_000; // 50M staked required for custom bounties

/**
 * Check if a user is eligible for Minted Merch Missions
 * Eligible if: 50M+ tokens (Merch Mogul) OR 10M+ staked tokens
 * @param {number} fid - Farcaster ID
 * @returns {Promise<{isEligible: boolean, isMogul: boolean, isStaker: boolean, tokenBalance: number, stakedBalance: number}>}
 */
export async function checkMissionsEligibility(fid) {
  try {
    console.log(`🎯 Checking missions eligibility for FID: ${fid}`);

    // Get user's token balance from profiles table
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('token_balance, wallet_balance, staked_balance')
      .eq('fid', fid)
      .single();

    if (error || !profile) {
      console.log(`❌ Profile not found for FID ${fid}`);
      return { isEligible: false, isMogul: false, isStaker: false, tokenBalance: 0, stakedBalance: 0 };
    }

    // Total balance = wallet + staked
    const walletBalance = parseFloat(profile.wallet_balance) || 0;
    const stakedBalance = parseFloat(profile.staked_balance) || 0;
    const tokenBalance = walletBalance + stakedBalance;

    // Also check token_balance column as fallback
    const dbTokenBalance = parseFloat(profile.token_balance) || 0;
    const effectiveBalance = Math.max(tokenBalance, dbTokenBalance);

    // Check if Merch Mogul (50M+ total tokens)
    const isMogul = effectiveBalance >= MOGUL_TOKEN_THRESHOLD;
    
    // Check if Staker (1M+ staked)
    const isStaker = stakedBalance >= STAKER_TOKEN_THRESHOLD;
    
    // Eligible if either condition is met
    const isEligible = isMogul || isStaker;

    const statusText = isMogul ? '✅ MOGUL' : isStaker ? '✅ STAKER' : '❌ NOT ELIGIBLE';
    console.log(`🎯 Missions eligibility for FID ${fid}: ${statusText} (${effectiveBalance.toLocaleString()} tokens, ${stakedBalance.toLocaleString()} staked)`);

    return { 
      isEligible,
      isMogul, 
      isStaker,
      tokenBalance: effectiveBalance,
      walletBalance,
      stakedBalance
    };

  } catch (error) {
    console.error(`❌ Error checking missions eligibility for FID ${fid}:`, error);
    return { isEligible: false, isMogul: false, isStaker: false, tokenBalance: 0, stakedBalance: 0 };
  }
}

/**
 * Legacy function - Check if a user is a Merch Mogul (50M+ tokens)
 * @deprecated Use checkMissionsEligibility instead
 * @param {number} fid - Farcaster ID
 * @returns {Promise<{isMogul: boolean, tokenBalance: number}>}
 */
export async function checkMogulStatus(fid) {
  const result = await checkMissionsEligibility(fid);
  return {
    isMogul: result.isMogul,
    tokenBalance: result.tokenBalance,
    walletBalance: result.walletBalance,
    stakedBalance: result.stakedBalance
  };
}

/**
 * Get submission count for a mogul on a specific bounty
 * Uses fid instead of ambassador_id since moguls aren't in ambassadors table
 * @param {number} fid - Farcaster ID
 * @param {string} bountyId - Bounty UUID
 * @returns {Promise<number>} Submission count
 */
export async function getMogulSubmissionCount(fid, bountyId) {
  try {
    const { count, error } = await supabaseAdmin
      .from('bounty_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('bounty_id', bountyId)
      .eq('ambassador_fid', fid); // We use ambassador_fid for moguls too

    if (error) {
      console.error(`❌ Error getting mogul submission count:`, error);
      return 0;
    }

    return count || 0;

  } catch (error) {
    console.error(`❌ Error in getMogulSubmissionCount:`, error);
    return 0;
  }
}

/**
 * Get all users eligible for Minted Merch Missions
 * Includes: Merch Moguls (50M+ tokens) AND Stakers (1M+ staked)
 * Used for sending notifications
 * @returns {Promise<number[]>} Array of FIDs
 */
export async function getAllMissionsEligibleUsers() {
  try {
    console.log(`🎯 Fetching all missions-eligible users (50M+ tokens OR 1M+ staked)...`);

    // Get all users with 50M+ tokens (Merch Moguls)
    const { data: moguls, error: mogulsError } = await supabaseAdmin
      .from('profiles')
      .select('fid')
      .gte('token_balance', MOGUL_TOKEN_THRESHOLD);

    if (mogulsError) {
      console.error('❌ Error fetching Merch Moguls:', mogulsError);
    }

    // Get all users with 1M+ staked tokens (Stakers)
    const { data: stakers, error: stakersError } = await supabaseAdmin
      .from('profiles')
      .select('fid')
      .gte('staked_balance', STAKER_TOKEN_THRESHOLD);

    if (stakersError) {
      console.error('❌ Error fetching Stakers:', stakersError);
    }

    // Combine and deduplicate FIDs
    const mogulFids = (moguls || []).map(p => p.fid);
    const stakerFids = (stakers || []).map(p => p.fid);
    const allFids = [...new Set([...mogulFids, ...stakerFids])];

    console.log(`🎯 Found ${allFids.length} missions-eligible users (${mogulFids.length} moguls, ${stakerFids.length} stakers)`);

    return allFids;

  } catch (error) {
    console.error('❌ Error in getAllMissionsEligibleUsers:', error);
    return [];
  }
}

/**
 * Legacy function - Get all Merch Moguls (users with 50M+ tokens)
 * @deprecated Use getAllMissionsEligibleUsers instead for notifications
 * @returns {Promise<number[]>} Array of FIDs
 */
export async function getAllMerchMoguls() {
  try {
    console.log(`💎 Fetching all Merch Moguls (50M+ tokens)...`);

    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('fid, token_balance')
      .gte('token_balance', MOGUL_TOKEN_THRESHOLD);

    if (error) {
      console.error('❌ Error fetching Merch Moguls:', error);
      return [];
    }

    const fids = profiles.map(p => p.fid);
    console.log(`💎 Found ${fids.length} Merch Moguls`);

    return fids;

  } catch (error) {
    console.error('❌ Error in getAllMerchMoguls:', error);
    return [];
  }
}

/**
 * Get mogul profile/stats
 * @param {number} fid - Farcaster ID
 * @returns {Promise<object>} Mogul profile data
 */
export async function getMogulProfile(fid) {
  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, pfp_url, token_balance, wallet_balance, staked_balance')
      .eq('fid', fid)
      .single();

    if (profileError || !profile) {
      return null;
    }

    // Get submission stats for this mogul (interaction bounties only)
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from('bounty_submissions')
      .select('id, status, bounty:bounties!inner(reward_tokens, bounty_type)')
      .eq('ambassador_fid', fid)
      .in('bounty.bounty_type', ['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_like_recast', 'farcaster_engagement']);

    const completedBounties = submissions?.filter(s => s.status === 'approved').length || 0;
    const pendingBounties = submissions?.filter(s => s.status === 'pending').length || 0;
    const totalEarned = submissions
      ?.filter(s => s.status === 'approved')
      .reduce((sum, s) => sum + (s.bounty?.reward_tokens || 0), 0) || 0;

    return {
      fid: profile.fid,
      username: profile.username,
      displayName: profile.display_name,
      pfpUrl: profile.pfp_url,
      tokenBalance: parseFloat(profile.token_balance) || 0,
      walletBalance: parseFloat(profile.wallet_balance) || 0,
      stakedBalance: parseFloat(profile.staked_balance) || 0,
      stats: {
        completedBounties,
        pendingBounties,
        totalEarned
      }
    };

  } catch (error) {
    console.error(`❌ Error getting mogul profile for FID ${fid}:`, error);
    return null;
  }
}

/**
 * Check if a user is eligible for custom bounties (50M+ staked)
 * Custom bounties require staking commitment, unlike interaction bounties
 * @param {number} fid - Farcaster ID
 * @param {number[]} targetFids - Optional array of targeted FIDs (bypass stake requirement)
 * @returns {Promise<{isEligible: boolean, stakedBalance: number, reason: string}>}
 */
export async function checkCustomBountyEligibility(fid, targetFids = []) {
  try {
    // If user is in target list, they're eligible regardless of stake
    if (targetFids && targetFids.length > 0 && targetFids.includes(fid)) {
      console.log(`🎯 FID ${fid} is in custom bounty target list - eligible`);
      return { isEligible: true, stakedBalance: 0, reason: 'targeted' };
    }

    // Get user's staked balance
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('staked_balance')
      .eq('fid', fid)
      .single();

    if (error || !profile) {
      console.log(`❌ Profile not found for FID ${fid}`);
      return { isEligible: false, stakedBalance: 0, reason: 'profile_not_found' };
    }

    const stakedBalance = parseFloat(profile.staked_balance) || 0;
    const isEligible = stakedBalance >= CUSTOM_BOUNTY_STAKED_THRESHOLD;

    const statusText = isEligible ? '✅ ELIGIBLE' : '❌ NOT ELIGIBLE';
    console.log(`🎯 Custom bounty eligibility for FID ${fid}: ${statusText} (${stakedBalance.toLocaleString()} staked, need ${CUSTOM_BOUNTY_STAKED_THRESHOLD.toLocaleString()})`);

    return { 
      isEligible,
      stakedBalance,
      reason: isEligible ? 'staked_50m' : 'insufficient_stake'
    };

  } catch (error) {
    console.error(`❌ Error checking custom bounty eligibility for FID ${fid}:`, error);
    return { isEligible: false, stakedBalance: 0, reason: 'error' };
  }
}

/**
 * Get all users eligible for custom bounties (50M+ staked)
 * Used for sending notifications about new custom bounties
 * @returns {Promise<number[]>} Array of FIDs
 */
export async function getAllCustomBountyEligibleUsers() {
  try {
    console.log(`🎯 Fetching all custom bounty eligible users (50M+ staked)...`);

    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('fid')
      .gte('staked_balance', CUSTOM_BOUNTY_STAKED_THRESHOLD);

    if (error) {
      console.error('❌ Error fetching custom bounty eligible users:', error);
      return [];
    }

    const fids = (profiles || []).map(p => p.fid);
    console.log(`🎯 Found ${fids.length} users eligible for custom bounties (50M+ staked)`);

    return fids;

  } catch (error) {
    console.error('❌ Error in getAllCustomBountyEligibleUsers:', error);
    return [];
  }
}

export { MOGUL_TOKEN_THRESHOLD, STAKER_TOKEN_THRESHOLD, CUSTOM_BOUNTY_STAKED_THRESHOLD };

