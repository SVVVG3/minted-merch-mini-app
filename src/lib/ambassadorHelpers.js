// Ambassador Helper Functions
// Utilities for ambassador system

import { supabaseAdmin } from './supabase';

/**
 * Get wallet address for an ambassador from profiles/connected_wallets
 * @param {number} fid - Farcaster ID
 * @returns {Promise<string|null>} Wallet address or null
 */
export async function getAmbassadorWalletAddress(fid) {
  try {
    // First check primary_eth_address from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('primary_eth_address, custody_address, verified_eth_addresses')
      .eq('fid', fid)
      .single();

    if (profileError) {
      console.error(`❌ Error fetching profile for FID ${fid}:`, profileError);
      return null;
    }

    // Priority order:
    // 1. Primary ETH address (most reliable)
    if (profile?.primary_eth_address) {
      console.log(`✅ Found primary_eth_address for FID ${fid}:`, profile.primary_eth_address);
      return profile.primary_eth_address;
    }

    // 2. First verified ETH address
    if (profile?.verified_eth_addresses && Array.isArray(profile.verified_eth_addresses) && profile.verified_eth_addresses.length > 0) {
      const firstVerified = profile.verified_eth_addresses[0];
      console.log(`✅ Found verified_eth_address for FID ${fid}:`, firstVerified);
      return firstVerified;
    }

    // 3. Custody address (fallback)
    if (profile?.custody_address) {
      console.log(`✅ Found custody_address for FID ${fid}:`, profile.custody_address);
      return profile.custody_address;
    }

    console.warn(`⚠️ No wallet address found for FID ${fid}`);
    return null;

  } catch (error) {
    console.error(`❌ Error in getAmbassadorWalletAddress for FID ${fid}:`, error);
    return null;
  }
}

/**
 * Validate proof URL for supported platforms
 * @param {string} url - URL to validate
 * @returns {Promise<{valid: boolean, platform: string|null, error: string|null}>}
 */
export async function validateProofUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, platform: null, error: 'URL is required' };
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Supported platforms
    const platforms = {
      farcaster: ['farcaster.xyz', 'www.farcaster.xyz', 'warpcast.com', 'www.warpcast.com'], // farcaster.xyz is preferred, warpcast.com for backward compatibility
      x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
      tiktok: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
      instagram: ['instagram.com', 'www.instagram.com', 'instagr.am']
    };

    for (const [platform, domains] of Object.entries(platforms)) {
      if (domains.includes(hostname)) {
        return { valid: true, platform, error: null };
      }
    }

    return {
      valid: false,
      platform: null,
      error: 'URL must be from Farcaster, X, TikTok, or Instagram'
    };

  } catch (error) {
    return { valid: false, platform: null, error: 'Invalid URL format' };
  }
}

/**
 * Check if FID is an active ambassador
 * @param {number} fid - Farcaster ID
 * @returns {Promise<{isAmbassador: boolean, ambassadorId: string|null}>}
 */
export async function checkAmbassadorStatus(fid) {
  try {
    const { data: ambassador, error } = await supabaseAdmin
      .from('ambassadors')
      .select('id, is_active')
      .eq('fid', fid)
      .single();

    if (error || !ambassador) {
      return { isAmbassador: false, ambassadorId: null };
    }

    return {
      isAmbassador: ambassador.is_active === true,
      ambassadorId: ambassador.is_active ? ambassador.id : null
    };

  } catch (error) {
    console.error(`❌ Error checking ambassador status for FID ${fid}:`, error);
    return { isAmbassador: false, ambassadorId: null };
  }
}

/**
 * Get ambassador's current submission count for a specific bounty
 * @param {string} ambassadorId - Ambassador UUID
 * @param {string} bountyId - Bounty UUID
 * @returns {Promise<number>} Number of submissions (regardless of status)
 */
export async function getAmbassadorSubmissionCount(ambassadorId, bountyId) {
  try {
    const { count, error } = await supabaseAdmin
      .from('bounty_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('ambassador_id', ambassadorId)
      .eq('bounty_id', bountyId);

    if (error) {
      console.error(`❌ Error counting submissions:`, error);
      return 0;
    }

    return count || 0;

  } catch (error) {
    console.error(`❌ Error in getAmbassadorSubmissionCount:`, error);
    return 0;
  }
}

