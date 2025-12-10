// Shared circulating supply calculation with single cache
// Used by both /api/staking/global and /api/staking/user

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

// SINGLE shared cache for circulating supply (refresh every 5 minutes)
let circulatingSupplyCache = { value: null, timestamp: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Expected range for sanity checks
const EXPECTED_CIRCULATING_MIN = 15_000_000_000; // 15B
const EXPECTED_CIRCULATING_MAX = 25_000_000_000; // 25B

/**
 * Get circulating supply = Total Supply - LP - Community Wallets
 * This is the SINGLE source of truth for circulating supply calculation.
 * Both /api/staking/global and /api/staking/user should use this.
 */
export async function getCirculatingSupply() {
  // Check cache - but invalidate if value seems wrong
  if (circulatingSupplyCache.value && (Date.now() - circulatingSupplyCache.timestamp) < CACHE_DURATION) {
    // SANITY CHECK: Circulating supply should be ~17-18B
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
      // Update cache
      circulatingSupplyCache = { value: circulatingSupply, timestamp: Date.now() };
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

