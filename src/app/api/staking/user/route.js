// API: Get staking details for authenticated user
// GET /api/staking/user?fid=<user_fid>
// 
// SECURITY: Users can only access their own staking data.
// Requires JWT authentication via Authorization header.

import { NextResponse } from 'next/server';
import { supabaseAdmin, supabase } from '@/lib/supabase';
import { getUserStakingDetails, getUserStakedBalance, getGlobalTotalStaked, getUserLifetimeClaimed } from '@/lib/stakingBalanceAPI';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';
import { getCirculatingSupply, calculateStakedPercentage } from '@/lib/circulatingSupply';

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
      const stakedPercentage = calculateStakedPercentage(globalTotalStaked, circulatingSupply);
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
    const userStakedAmount = stakingDetails.totalStaked ?? parseFloat(profile.staked_balance) ?? 0;
    
    // Use wallet_balance from DB (this is the UNSTAKED amount in user's wallets)
    // wallet_balance is calculated as: totalFromChain - stakedFromSubgraph
    const walletBalance = parseFloat(profile.wallet_balance) || 0;
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

