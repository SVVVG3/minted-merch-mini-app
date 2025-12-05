// API: Get staking details for authenticated user
// GET /api/staking/user?fid=<user_fid>
// 
// SECURITY: Users can only access their own staking data.
// Requires JWT authentication via Authorization header.

import { NextResponse } from 'next/server';
import { supabaseAdmin, supabase } from '@/lib/supabase';
import { getUserStakingDetails, getUserStakedBalance, getGlobalTotalStaked, getUserLifetimeClaimed } from '@/lib/stakingBalanceAPI';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

// Token contract address
const TOKEN_CONTRACT = '0x774EAeFE73Df7959496Ac92a77279A8D7d690b07';

// Addresses to exclude from circulating supply (LP + Community Wallets)
const EXCLUDED_ADDRESSES = [
  '0x498581fF718922c3f8e6A244956aF099B2652b2b', // LP
  '0xEDb90eF78C78681eE504b9E00950d84443a3E86B', // Community Wallet 1
  '0x11568faA781f577c05763F86Da03eFd85a36EB29', // Community Wallet 2
  '0x11f2ae4DD9575833D42d03662dA113Cd3c3D4176', // Community Wallet 3
  '0x57F7fd7C4c10B3582de565081f779ff0347f113e', // Community Wallet 4
  '0xb6BE309eb1697B6D061B380b0952df8aCFf6b394', // Community Wallet 5
  '0xcf965A96d55476e7345e948601921207549c0393', // Community Wallet 6
];

// Cache for circulating supply (refresh every 10 minutes)
let circulatingSupplyCache = { value: null, timestamp: 0 };
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// CORRECT circulating supply should be ~18.4B (100B - 81.6B excluded)
// If cached value is significantly different, invalidate it
const EXPECTED_CIRCULATING_MIN = 15_000_000_000; // 15B
const EXPECTED_CIRCULATING_MAX = 25_000_000_000; // 25B

/**
 * Get circulating supply = Total Supply - LP - Community Wallets
 */
async function getCirculatingSupply() {
  // Check cache - but invalidate if value seems wrong (was calculated when RPCs were failing)
  if (circulatingSupplyCache.value && (Date.now() - circulatingSupplyCache.timestamp) < CACHE_DURATION) {
    // SANITY CHECK: Circulating supply should be ~18.4B
    // If cached value is outside expected range, force recalculate
    if (circulatingSupplyCache.value < EXPECTED_CIRCULATING_MIN || circulatingSupplyCache.value > EXPECTED_CIRCULATING_MAX) {
      console.log(`⚠️ Cached circulating supply ${circulatingSupplyCache.value.toLocaleString()} is outside expected range, forcing recalculation`);
    } else {
      console.log(`📊 Using cached circulating supply: ${circulatingSupplyCache.value.toLocaleString()}`);
      return circulatingSupplyCache.value;
    }
  }

  try {
    // Try multiple RPC endpoints for reliability
    const rpcEndpoints = [
      process.env.ALCHEMY_BASE_RPC_URL,
      'https://base.llamarpc.com',
      'https://mainnet.base.org',
      'https://1rpc.io/base'
    ].filter(Boolean);
    
    let rpcUrl = rpcEndpoints[0];
    console.log(`📊 Using RPC endpoint: ${rpcUrl}`);
    
    // Get total supply
    const totalSupplyResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: TOKEN_CONTRACT, data: '0x18160ddd' }, 'latest'],
        id: 1
      })
    });
    const totalSupplyResult = await totalSupplyResponse.json();
    
    if (!totalSupplyResult.result) {
      console.error('❌ Failed to get total supply, using fallback');
      return 18_400_000_000;
    }
    
    const totalSupply = parseInt(totalSupplyResult.result, 16) / 1e18;
    console.log(`📊 Total supply: ${totalSupply.toLocaleString()}`);

    // Use known values for excluded addresses (verified on-chain)
    // These rarely change, so hardcoding is more reliable than failing RPC calls
    const KNOWN_EXCLUDED_BALANCES = {
      '0x498581fF718922c3f8e6A244956aF099B2652b2b': 52_802_358_262, // LP
      '0xEDb90eF78C78681eE504b9E00950d84443a3E86B': 8_550_000_000,  // Community 1
      '0x11568faA781f577c05763F86Da03eFd85a36EB29': 5_000_000_000,  // Community 2
      '0x11f2ae4DD9575833D42d03662dA113Cd3c3D4176': 5_000_000_000,  // Community 3
      '0x57F7fd7C4c10B3582de565081f779ff0347f113e': 5_000_000_000,  // Community 4
      '0xb6BE309eb1697B6D061B380b0952df8aCFf6b394': 5_000_000_000,  // Community 5
      '0xcf965A96d55476e7345e948601921207549c0393': 209_025_000,    // Community 6
    };
    
    // Sum known excluded balances
    let excludedBalance = Object.values(KNOWN_EXCLUDED_BALANCES).reduce((sum, bal) => sum + bal, 0);
    console.log(`📊 Using known excluded balance: ${excludedBalance.toLocaleString()}`);

    const circulatingSupply = totalSupply - excludedBalance;
    
    // Cache the result
    circulatingSupplyCache = { value: circulatingSupply, timestamp: Date.now() };
    
    console.log(`📊 Circulating supply calculated:`);
    console.log(`   Total Supply: ${totalSupply.toLocaleString()}`);
    console.log(`   Excluded: ${excludedBalance.toLocaleString()}`);
    console.log(`   Circulating: ${circulatingSupply.toLocaleString()}`);
    
    return circulatingSupply;
  } catch (error) {
    console.error('Error calculating circulating supply:', error);
    // Fallback: ~18.4B circulating (100B total - ~81.6B excluded)
    return 18_400_000_000;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedFid = searchParams.get('fid');

    if (!requestedFid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // SECURITY: Verify user is authenticated and requesting their own data
    const authenticatedFid = await getAuthenticatedFid(request);
    const authError = requireOwnFid(authenticatedFid, requestedFid);
    if (authError) {
      return authError; // Returns 401 or 403 response
    }

    const fid = requestedFid;
    console.log(`📊 Fetching staking data for authenticated FID ${fid}`);

    const client = supabaseAdmin || supabase;
    
    // Get user's profile and wallet addresses from database
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('fid, username, display_name, all_wallet_addresses, token_balance, wallet_balance, staked_balance, token_balance_updated_at, pfp_url')
      .eq('fid', fid)
      .single();

    if (profileError) {
      console.log(`ℹ️ No profile found for FID ${fid}, returning zero staking data`);
      // Still fetch global staked even for new users
      const globalTotalStaked = await getGlobalTotalStaked();
      const circulatingSupply = await getCirculatingSupply();
      const stakedPercentage = circulatingSupply > 0 ? ((globalTotalStaked / circulatingSupply) * 100).toFixed(0) : 0;
      const formatNumber = (num) => {
        if (num >= 1_000_000_000) {
          const formatted = (num / 1_000_000_000).toFixed(3);
          const trimmed = formatted.replace(/(\.\d{2})0+$/, '$1');
          return trimmed + 'B';
        }
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
        return num.toLocaleString();
      };
      const formatNumberFull = (num) => {
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
      };
      return NextResponse.json({
        success: true,
        user: {
          fid: parseInt(fid),
          username: null,
          display_name: null,
          pfp_url: null
        },
        staking: {
          total_staked: 0,
          total_staked_formatted: '0',
          global_total_staked: globalTotalStaked,
          global_total_staked_formatted: formatNumber(globalTotalStaked),
          global_total_staked_full: formatNumberFull(globalTotalStaked),
          circulating_supply: circulatingSupply,
          staked_percentage: stakedPercentage,
          is_staker: false,
          stake_count: 0
        },
        balances: {
          total: 0,
          wallet: 0,
          staked: 0
        }
      });
    }

    // Parse wallet addresses
    let walletAddresses = [];
    try {
      walletAddresses = Array.isArray(profile.all_wallet_addresses)
        ? profile.all_wallet_addresses
        : JSON.parse(profile.all_wallet_addresses || '[]');
    } catch (e) {
      console.error('Error parsing wallet addresses:', e);
      walletAddresses = [];
    }

    console.log(`📋 Found ${walletAddresses.length} wallet addresses for FID ${fid}`);

    // Get real-time staking details from the subgraph
    let stakingDetails = {
      totalStaked: 0,
      stakes: [],
      wallets: walletAddresses
    };
    
    if (walletAddresses.length > 0) {
      stakingDetails = await getUserStakingDetails(walletAddresses);
    }

    // Get global total staked across all users
    const globalTotalStaked = await getGlobalTotalStaked();
    
    // Get circulating supply and calculate staked percentage
    const circulatingSupply = await getCirculatingSupply();
    const stakedPercentage = circulatingSupply > 0 ? ((globalTotalStaked / circulatingSupply) * 100).toFixed(0) : 0;

    // Format numbers for display
    const formatNumber = (num) => {
      if (num >= 1_000_000_000) {
        // Use 3 decimal places for billions to show more precision (2.001B not 2.00B)
        const formatted = (num / 1_000_000_000).toFixed(3);
        // Remove trailing zeros but keep at least 2 decimal places
        const trimmed = formatted.replace(/(\.\d{2})0+$/, '$1');
        return trimmed + 'B';
      } else if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(2) + 'M';
      } else if (num >= 1_000) {
        return (num / 1_000).toFixed(2) + 'K';
      }
      return num.toLocaleString();
    };
    
    // Format number with full precision (comma-separated)
    const formatNumberFull = (num) => {
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
    };

    // Format response
    // IMPORTANT: Use ?? (nullish coalescing) instead of || to handle 0 correctly
    // When user unstakes everything, totalStaked is 0, not null/undefined
    const userStakedAmount = stakingDetails.totalStaked ?? profile.staked_balance ?? 0;
    
    // Use wallet_balance from DB (this is the unstaked amount in user's wallets)
    // Total = wallet_balance + staked (they are stored separately)
    const walletBalance = profile.wallet_balance || 0;
    const totalTokenBalance = walletBalance + userStakedAmount;
    
    // Get lifetime claimed rewards from GraphQL
    let lifetimeClaimed = 0;
    if (walletAddresses.length > 0) {
      lifetimeClaimed = await getUserLifetimeClaimed(walletAddresses);
    }
    
    console.log(`📊 Balance breakdown for FID ${fid}:`);
    console.log(`   Total tokens: ${totalTokenBalance.toLocaleString()}`);
    console.log(`   Staked: ${userStakedAmount.toLocaleString()}`);
    console.log(`   Wallet (unstaked): ${walletBalance.toLocaleString()}`);
    console.log(`   Lifetime claimed: ${lifetimeClaimed.toLocaleString()}`);
    console.log(`   Circulating supply: ${circulatingSupply.toLocaleString()}`);
    console.log(`   Global staked: ${globalTotalStaked.toLocaleString()}`);
    console.log(`   Staked %: ${stakedPercentage}%`);
    
    const response = {
      success: true,
      user: {
        fid: profile.fid,
        username: profile.username,
        display_name: profile.display_name,
        pfp_url: profile.pfp_url
      },
      staking: {
        total_staked: userStakedAmount,
        total_staked_formatted: formatNumber(userStakedAmount),
        total_staked_full: formatNumberFull(userStakedAmount),
        global_total_staked: globalTotalStaked,
        global_total_staked_formatted: formatNumber(globalTotalStaked),
        global_total_staked_full: formatNumberFull(globalTotalStaked),
        circulating_supply: circulatingSupply,
        staked_percentage: stakedPercentage,
        is_staker: userStakedAmount > 0,
        stake_count: stakingDetails.stakes?.length || 0,
        lifetime_claimed: lifetimeClaimed,
        lifetime_claimed_formatted: formatNumberFull(lifetimeClaimed)
      },
      balances: {
        total: totalTokenBalance,
        total_formatted: formatNumberFull(totalTokenBalance),
        wallet: walletBalance,
        wallet_formatted: formatNumberFull(walletBalance),
        staked: userStakedAmount,
        staked_formatted: formatNumberFull(userStakedAmount)
      }
    };

    console.log(`✅ Staking data retrieved for FID ${fid}: ${response.staking.total_staked_formatted} staked`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error in staking user endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

