// Merch Mogul helper functions
// Handles checking mogul eligibility (50M+ tokens) and related operations

import { supabaseAdmin } from './supabase';

const MOGUL_TOKEN_THRESHOLD = 50_000_000; // 50M tokens required

/**
 * Check if a user is a Merch Mogul (50M+ tokens including staked)
 * @param {number} fid - Farcaster ID
 * @returns {Promise<{isMogul: boolean, tokenBalance: number}>}
 */
export async function checkMogulStatus(fid) {
  try {
    console.log(`💎 Checking Merch Mogul status for FID: ${fid}`);

    // Get user's token balance from profiles table
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('token_balance, wallet_balance, staked_balance')
      .eq('fid', fid)
      .single();

    if (error || !profile) {
      console.log(`❌ Profile not found for FID ${fid}`);
      return { isMogul: false, tokenBalance: 0 };
    }

    // Total balance = wallet + staked
    const walletBalance = parseFloat(profile.wallet_balance) || 0;
    const stakedBalance = parseFloat(profile.staked_balance) || 0;
    const tokenBalance = walletBalance + stakedBalance;

    // Also check token_balance column as fallback
    const dbTokenBalance = parseFloat(profile.token_balance) || 0;
    const effectiveBalance = Math.max(tokenBalance, dbTokenBalance);

    const isMogul = effectiveBalance >= MOGUL_TOKEN_THRESHOLD;

    console.log(`💎 Mogul status for FID ${fid}: ${isMogul ? '✅ MOGUL' : '❌ NOT MOGUL'} (${effectiveBalance.toLocaleString()} tokens)`);

    return { 
      isMogul, 
      tokenBalance: effectiveBalance,
      walletBalance,
      stakedBalance
    };

  } catch (error) {
    console.error(`❌ Error checking mogul status for FID ${fid}:`, error);
    return { isMogul: false, tokenBalance: 0 };
  }
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
 * Get all Merch Moguls (users with 50M+ tokens)
 * Used for sending notifications
 * @returns {Promise<number[]>} Array of FIDs
 */
export async function getAllMerchMoguls() {
  try {
    console.log(`💎 Fetching all Merch Moguls (50M+ tokens)...`);

    // Get all users with 50M+ tokens
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

export { MOGUL_TOKEN_THRESHOLD };

