// API: Get global staking stats (public - no auth required)
// GET /api/staking/global

import { NextResponse } from 'next/server';
import { getGlobalTotalStaked } from '@/lib/stakingBalanceAPI';

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

// Helper to format numbers with commas
function formatNumberFull(num) {
  if (!num && num !== 0) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(num);
}

/**
 * Get circulating supply = Total Supply - LP - Community Wallets
 * Uses same logic as /api/staking/user for consistency
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
    
    // Get excluded balances
    let excludedTotal = 0;
    for (const address of EXCLUDED_ADDRESSES) {
      const balanceData = '0x70a08231' + address.slice(2).padStart(64, '0');
      const balanceResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: TOKEN_CONTRACT, data: balanceData }, 'latest'],
          id: 1
        })
      });
      const balanceResult = await balanceResponse.json();
      if (balanceResult.result) {
        const balance = parseInt(balanceResult.result, 16) / 1e18;
        excludedTotal += balance;
      }
    }
    
    console.log(`📊 Excluded total: ${excludedTotal.toLocaleString()}`);
    const circulatingSupply = totalSupply - excludedTotal;
    console.log(`📊 Calculated circulating supply: ${circulatingSupply.toLocaleString()}`);
    
    // Sanity check before caching
    if (circulatingSupply >= EXPECTED_CIRCULATING_MIN && circulatingSupply <= EXPECTED_CIRCULATING_MAX) {
      // Update cache
      circulatingSupplyCache = { value: circulatingSupply, timestamp: Date.now() };
      return circulatingSupply;
    } else {
      console.warn(`⚠️ Calculated circulating supply ${circulatingSupply.toLocaleString()} is outside expected range, using fallback`);
      return 18_400_000_000;
    }
  } catch (error) {
    console.error('Error calculating circulating supply:', error);
    return 18_400_000_000; // Fallback
  }
}

export async function GET() {
  try {
    // Get global total staked from subgraph
    const globalTotalStaked = await getGlobalTotalStaked();
    
    // Get circulating supply for percentage calculation
    const circulatingSupply = await getCirculatingSupply();
    
    // Calculate staked percentage - use same formula as user route
    const stakedPercentage = circulatingSupply > 0 
      ? ((globalTotalStaked / circulatingSupply) * 100).toFixed(0)
      : 0;

    return NextResponse.json({
      success: true,
      global_total_staked: globalTotalStaked,
      global_total_staked_formatted: formatNumberFull(globalTotalStaked),
      circulating_supply: circulatingSupply,
      staked_percentage: parseInt(stakedPercentage)
    });

  } catch (error) {
    console.error('Error fetching global staking stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch global staking stats' },
      { status: 500 }
    );
  }
}
