// API: Get global staking stats (public - no auth required)
// GET /api/staking/global

import { NextResponse } from 'next/server';
import { getGlobalTotalStaked } from '@/lib/stakingBalanceAPI';

// Token contract address
const TOKEN_CONTRACT = '0x774EAeFE73Df7959496Ac92a77279A8D7d690b07';

// Addresses to exclude from circulating supply
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
 */
async function getCirculatingSupply() {
  // Check cache
  if (circulatingSupplyCache.value && (Date.now() - circulatingSupplyCache.timestamp) < CACHE_DURATION) {
    return circulatingSupplyCache.value;
  }

  try {
    const rpcEndpoints = [
      process.env.ALCHEMY_BASE_RPC_URL,
      'https://base.llamarpc.com',
      'https://mainnet.base.org'
    ].filter(Boolean);
    
    let rpcUrl = rpcEndpoints[0];
    
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
      return 18_400_000_000; // Fallback
    }
    
    const totalSupply = parseInt(totalSupplyResult.result, 16) / 1e18;
    
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
        excludedTotal += parseInt(balanceResult.result, 16) / 1e18;
      }
    }
    
    const circulatingSupply = totalSupply - excludedTotal;
    
    // Update cache
    circulatingSupplyCache = { value: circulatingSupply, timestamp: Date.now() };
    
    return circulatingSupply;
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
    
    // Calculate staked percentage
    const stakedPercentage = circulatingSupply > 0 
      ? Math.round((globalTotalStaked / circulatingSupply) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      global_total_staked: globalTotalStaked,
      global_total_staked_formatted: formatNumberFull(globalTotalStaked),
      circulating_supply: circulatingSupply,
      staked_percentage: stakedPercentage
    });

  } catch (error) {
    console.error('Error fetching global staking stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch global staking stats' },
      { status: 500 }
    );
  }
}

