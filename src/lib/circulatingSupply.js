// Shared circulating supply calculation with Supabase-backed cache
// Used by both /api/staking/global and /api/staking/user
// Database cache ensures all serverless instances share the same value

import { supabaseAdmin } from './supabase';

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

// Cache duration - 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Expected range for sanity checks (circulating ~18.5B as of Dec 2024)
const EXPECTED_CIRCULATING_MIN = 15_000_000_000; // 15B
const EXPECTED_CIRCULATING_MAX = 25_000_000_000; // 25B

/**
 * Get cached value from Supabase
 */
async function getDbCache(key) {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_cache')
      .select('value, updated_at')
      .eq('key', key)
      .single();
    
    if (error || !data) return null;
    
    const cacheAge = Date.now() - new Date(data.updated_at).getTime();
    if (cacheAge > CACHE_DURATION_MS) {
      console.log(`📊 DB cache for ${key} is stale (${Math.round(cacheAge / 1000)}s old)`);
      return null;
    }
    
    return data.value;
  } catch (err) {
    console.error('Error reading DB cache:', err);
    return null;
  }
}

/**
 * Set cached value in Supabase
 */
async function setDbCache(key, value) {
  try {
    await supabaseAdmin
      .from('app_cache')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
  } catch (err) {
    console.error('Error writing DB cache:', err);
  }
}

/**
 * Get circulating supply = Total Supply - LP - Community Wallets
 * This is the SINGLE source of truth for circulating supply calculation.
 * Both /api/staking/global and /api/staking/user should use this.
 * Uses Supabase-backed cache for consistency across all serverless instances.
 */
export async function getCirculatingSupply() {
  // Check Supabase cache first (shared across all instances)
  const cached = await getDbCache('circulating_supply');
  if (cached?.value && cached.value >= EXPECTED_CIRCULATING_MIN && cached.value <= EXPECTED_CIRCULATING_MAX) {
    console.log(`📊 Using DB cached circulating supply: ${cached.value.toLocaleString()}`);
    return cached.value;
  }

  try {
    // Prioritize Alchemy for reliability, fall back to public RPCs
    const rpcUrl = process.env.ALCHEMY_BASE_RPC_URL || 
                   process.env.BASE_RPC_URL || 
                   'https://mainnet.base.org';
    
    const isAlchemy = rpcUrl.includes('alchemy');
    console.log(`📊 Using RPC endpoint: ${isAlchemy ? 'Alchemy' : rpcUrl}`);
    
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
      return 18_000_000_000; // Fallback
    }
    
    // Use BigInt for precision with large numbers (wei values exceed Number.MAX_SAFE_INTEGER)
    const WEI_DIVISOR = BigInt(10 ** 18);
    const totalSupplyWei = BigInt(totalSupplyResult.result);
    const totalSupply = Number(totalSupplyWei / WEI_DIVISOR) + Number(totalSupplyWei % WEI_DIVISOR) / 1e18;
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
        // Use BigInt for precision with large numbers
        const balanceWei = BigInt(balanceResult.result);
        const balance = Number(balanceWei / WEI_DIVISOR) + Number(balanceWei % WEI_DIVISOR) / 1e18;
        excludedTotal += balance;
      }
    }
    
    console.log(`📊 Excluded total: ${excludedTotal.toLocaleString()}`);
    const circulatingSupply = totalSupply - excludedTotal;
    console.log(`📊 Calculated circulating supply: ${circulatingSupply.toLocaleString()}`);
    
    // Sanity check before caching
    if (circulatingSupply >= EXPECTED_CIRCULATING_MIN && circulatingSupply <= EXPECTED_CIRCULATING_MAX) {
      // Update Supabase cache (shared across all instances)
      await setDbCache('circulating_supply', { value: circulatingSupply, calculated_at: new Date().toISOString() });
      console.log(`📊 Updated DB cache with circulating supply: ${circulatingSupply.toLocaleString()}`);
      return circulatingSupply;
    } else {
      console.warn(`⚠️ Calculated circulating supply ${circulatingSupply.toLocaleString()} is outside expected range, using fallback`);
      return 18_000_000_000; // Fallback
    }
  } catch (error) {
    console.error('Error calculating circulating supply:', error);
    return 18_000_000_000; // Fallback
  }
}

/**
 * Calculate staked percentage
 * @param {number} totalStaked - Total tokens staked
 * @param {number} circulatingSupply - Circulating supply
 * @returns {number} Percentage (integer)
 */
export function calculateStakedPercentage(totalStaked, circulatingSupply) {
  if (!circulatingSupply || circulatingSupply <= 0) return 0;
  return Math.round((totalStaked / circulatingSupply) * 100);
}

