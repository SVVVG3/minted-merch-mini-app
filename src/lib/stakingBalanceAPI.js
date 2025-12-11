// Staking balance API for querying user's staked $MINTEDMERCH tokens
// Uses DIRECT RPC CALLS for real-time data (Total Staked, User Stake)
// Uses GraphQL only for historical aggregation (Lifetime Claimed)

// GraphQL endpoint - ONLY used for lifetime claimed (historical events)
const GOLDSKY_GRAPHQL_ENDPOINT = 'https://api.goldsky.com/api/public/project_cmhgzsg1lfhim01w4ah9rb5i5/subgraphs/betr-contracts-base/1.1/gn';

// Staking contract address on Base
const STAKING_CONTRACT = '0x38AE5d952FA83eD57c5b5dE59b6e36Ce975a9150';

// Use BigInt for precision with large wei values (exceed Number.MAX_SAFE_INTEGER)
const WEI_DIVISOR = BigInt(10 ** 18);

// Function signatures for staking contract
const FUNCTION_SIGS = {
  totalStaked: '0x817b1cd2',      // totalStaked()
  balanceOf: '0x70a08231',        // balanceOf(address) - standard ERC20-like
};

/**
 * Get RPC URL with Alchemy as primary
 */
function getRpcUrl() {
  return process.env.ALCHEMY_BASE_RPC_URL || 
         process.env.BASE_RPC_URL || 
         'https://mainnet.base.org';
}

/**
 * Make an eth_call to read from a contract
 * @param {string} to - Contract address
 * @param {string} data - Encoded function call
 * @returns {Promise<string>} Hex result
 */
async function ethCall(to, data) {
  const rpcUrl = getRpcUrl();
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
      id: 1
    })
  });
  const result = await response.json();
  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`);
  }
  return result.result;
}

/**
 * Convert wei string to token number with full precision using BigInt
 * @param {string} weiString - Balance in wei as string (hex or decimal)
 * @returns {number} Balance in tokens
 */
function weiToTokens(weiString) {
  try {
    // Handle hex strings from RPC
    const wei = weiString.startsWith('0x') 
      ? BigInt(weiString) 
      : BigInt(weiString);
    // Split into whole tokens and fractional part for precision
    return Number(wei / WEI_DIVISOR) + Number(wei % WEI_DIVISOR) / 1e18;
  } catch (e) {
    // Fallback for invalid input
    console.error('Error converting wei to tokens:', e);
    return 0;
  }
}

/**
 * Query user's staked token balance DIRECTLY from the staking contract via RPC
 * @param {Array<string>} walletAddresses - User's wallet addresses
 * @returns {Promise<number>} Total staked balance in tokens (not wei)
 */
export async function getUserStakedBalance(walletAddresses) {
  if (!walletAddresses || walletAddresses.length === 0) {
    console.log('📊 No wallet addresses provided for staking balance check');
    return 0;
  }

  // Normalize addresses
  const normalizedAddresses = walletAddresses
    .filter(addr => typeof addr === 'string' && addr.startsWith('0x'))
    .map(addr => addr.toLowerCase());

  if (normalizedAddresses.length === 0) {
    console.log('📊 No valid wallet addresses for staking balance check');
    return 0;
  }

  console.log(`📊 Querying staking balance via RPC for ${normalizedAddresses.length} wallet(s)`);

  try {
    let totalStaked = 0;
    
    // Query each wallet's staked balance directly from contract
    for (const address of normalizedAddresses) {
      // Encode balanceOf(address) call
      const data = FUNCTION_SIGS.balanceOf + address.slice(2).padStart(64, '0');
      
      try {
        const result = await ethCall(STAKING_CONTRACT, data);
        if (result && result !== '0x') {
          const balance = weiToTokens(result);
          totalStaked += balance;
          console.log(`📊 Wallet ${address.slice(0,8)}... staked: ${balance.toLocaleString()}`);
        }
      } catch (err) {
        console.warn(`📊 Failed to get stake for ${address}:`, err.message);
      }
    }

    console.log(`📊 Total staked balance: ${totalStaked.toLocaleString()} tokens across ${normalizedAddresses.length} wallet(s)`);
    return totalStaked;

  } catch (error) {
    console.error('📊 Error querying staking balance via RPC:', error);
    // Fallback to GraphQL if RPC fails
    console.log('📊 Falling back to GraphQL...');
    return getUserStakedBalanceGraphQL(walletAddresses);
  }
}

/**
 * GraphQL fallback for user staked balance (kept for reliability)
 */
async function getUserStakedBalanceGraphQL(walletAddresses) {
  const normalizedAddresses = walletAddresses
    .filter(addr => typeof addr === 'string' && addr.startsWith('0x'))
    .map(addr => addr.toLowerCase());

  try {
    const query = `
      query GetStakedBalances($addresses: [String!]!) {
        stakerBalances(where: { staker_in: $addresses }) {
          staker
          balance
          timestamp_
        }
      }
    `;

    const response = await fetch(GOLDSKY_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { addresses: normalizedAddresses } })
    });

    const result = await response.json();
    if (result.errors) throw new Error(JSON.stringify(result.errors));

    const stakerBalances = result.data?.stakerBalances || [];
    const latestBalancePerWallet = new Map();
    
    for (const entry of stakerBalances) {
      const wallet = entry.staker.toLowerCase();
      const timestamp = parseInt(entry.timestamp_);
      if (!latestBalancePerWallet.has(wallet) || timestamp > latestBalancePerWallet.get(wallet).timestamp) {
        latestBalancePerWallet.set(wallet, { balance: weiToTokens(entry.balance), timestamp });
      }
    }
    
    let totalStaked = 0;
    for (const { balance } of latestBalancePerWallet.values()) {
      totalStaked += balance;
    }

    console.log(`📊 [GraphQL fallback] Total staked: ${totalStaked.toLocaleString()} tokens`);
    return totalStaked;

  } catch (error) {
    console.error('📊 GraphQL fallback also failed:', error);
    return 0;
  }
}

/**
 * Get the global total staked DIRECTLY from the staking contract via RPC
 * This is the most reliable and real-time way to get total staked
 * @returns {Promise<number>} Total staked balance in tokens (not wei)
 */
export async function getGlobalTotalStaked() {
  try {
    console.log(`📊 Querying global total staked via RPC...`);
    
    // Call totalStaked() directly on the contract
    const result = await ethCall(STAKING_CONTRACT, FUNCTION_SIGS.totalStaked);
    
    if (!result || result === '0x') {
      console.warn('📊 RPC returned empty result for totalStaked, falling back to GraphQL');
      return getGlobalTotalStakedGraphQL();
    }
    
    const totalStaked = weiToTokens(result);
    console.log(`📊 Global total staked (RPC): ${totalStaked.toLocaleString()} tokens`);
    
    return totalStaked;

  } catch (error) {
    console.error('📊 Error querying global staked via RPC:', error);
    console.log('📊 Falling back to GraphQL...');
    return getGlobalTotalStakedGraphQL();
  }
}

/**
 * GraphQL fallback for global total staked
 */
async function getGlobalTotalStakedGraphQL() {
  try {
    const query = `
      query GetGlobalStaked {
        stakerBalances(first: 1000, orderBy: timestamp_, orderDirection: desc) {
          staker
          balance
          timestamp_
        }
      }
    `;

    const response = await fetch(GOLDSKY_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const result = await response.json();
    if (result.errors) throw new Error(JSON.stringify(result.errors));

    const stakerBalances = result.data?.stakerBalances || [];
    const latestBalancePerStaker = new Map();
    
    for (const entry of stakerBalances) {
      const staker = entry.staker.toLowerCase();
      if (!latestBalancePerStaker.has(staker)) {
        latestBalancePerStaker.set(staker, weiToTokens(entry.balance));
      }
    }
    
    let totalStaked = 0;
    for (const balance of latestBalancePerStaker.values()) {
      totalStaked += balance;
    }

    console.log(`📊 [GraphQL fallback] Global total staked: ${totalStaked.toLocaleString()} tokens`);
    return totalStaked;

  } catch (error) {
    console.error('📊 GraphQL fallback also failed:', error);
    return 0;
  }
}

/**
 * Get all staker balances as a map of wallet address -> balance
 * Used for enriching leaderboard data with live staking info
 * @returns {Promise<Map<string, number>>} Map of lowercase wallet address to staked balance
 */
export async function getAllStakerBalances() {
  try {
    const query = `
      query GetAllStakerBalances {
        stakerBalances(first: 1000, orderBy: timestamp_, orderDirection: desc) {
          staker
          balance
          timestamp_
        }
      }
    `;

    const response = await fetch(GOLDSKY_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const stakerBalances = result.data?.stakerBalances || [];
    
    // Get latest balance per staker
    const balanceMap = new Map();
    for (const entry of stakerBalances) {
      const staker = entry.staker.toLowerCase();
      if (!balanceMap.has(staker)) {
        balanceMap.set(staker, weiToTokens(entry.balance));
      }
    }

    console.log(`📊 Loaded ${balanceMap.size} staker balances from subgraph`);
    return balanceMap;

  } catch (error) {
    console.error('📊 Error fetching all staker balances:', error);
    return new Map();
  }
}

/**
 * Get staking statistics - total staked from RPC, unique stakers from GraphQL
 * @returns {Promise<{totalStaked: number, uniqueStakers: number}>}
 */
export async function getStakingStats() {
  try {
    // Get total staked from RPC (real-time)
    const totalStaked = await getGlobalTotalStaked();
    
    // Get unique staker count from GraphQL (need to enumerate)
    const query = `
      query GetStakingStats {
        stakerBalances(first: 1000, orderBy: timestamp_, orderDirection: desc) {
          staker
          balance
          timestamp_
        }
      }
    `;

    const response = await fetch(GOLDSKY_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const result = await response.json();
    
    // Count unique active stakers
    let uniqueStakers = 0;
    if (!result.errors && result.data?.stakerBalances) {
      const latestBalancePerStaker = new Map();
      for (const entry of result.data.stakerBalances) {
        const staker = entry.staker.toLowerCase();
        if (!latestBalancePerStaker.has(staker)) {
          latestBalancePerStaker.set(staker, weiToTokens(entry.balance));
        }
      }
      for (const balance of latestBalancePerStaker.values()) {
        if (balance > 0) uniqueStakers++;
      }
    }

    console.log(`📊 Staking stats: ${totalStaked.toLocaleString()} tokens across ${uniqueStakers} active stakers`);
    return { totalStaked, uniqueStakers };

  } catch (error) {
    console.error('📊 Error querying staking stats:', error);
    return { totalStaked: 0, uniqueStakers: 0 };
  }
}

/**
 * Get user's lifetime claimed rewards from the staking contract
 * @param {Array<string>} walletAddresses - User's wallet addresses (lowercase)
 * @returns {Promise<number>} Total claimed rewards in tokens (not wei)
 */
export async function getUserLifetimeClaimed(walletAddresses) {
  if (!walletAddresses || walletAddresses.length === 0) {
    return 0;
  }

  const normalizedAddresses = walletAddresses
    .filter(addr => typeof addr === 'string' && addr.startsWith('0x'))
    .map(addr => addr.toLowerCase());

  if (normalizedAddresses.length === 0) {
    return 0;
  }

  try {
    const query = `
      query GetLifetimeClaimed($addresses: [String!]!) {
        rewardClaimeds(where: { staker_in: $addresses }, first: 1000) {
          staker
          amount
          timestamp_
        }
      }
    `;

    const response = await fetch(GOLDSKY_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          addresses: normalizedAddresses
        }
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const claimEvents = result.data?.rewardClaimeds || [];
    
    // Sum all claimed rewards
    let totalClaimed = 0;
    for (const event of claimEvents) {
      totalClaimed += weiToTokens(event.amount);
    }

    console.log(`📊 Lifetime claimed: ${totalClaimed.toLocaleString()} tokens from ${claimEvents.length} claim events`);

    return totalClaimed;

  } catch (error) {
    console.error('📊 Error querying lifetime claimed:', error);
    return 0;
  }
}

/**
 * Get global total rewards claimed across ALL wallets from the staking contract
 * @returns {Promise<number>} Total claimed rewards in tokens (not wei)
 */
export async function getGlobalTotalClaimed() {
  try {
    const query = `
      query GetGlobalClaimed {
        rewardClaimeds(first: 1000) {
          staker
          amount
          timestamp_
        }
      }
    `;

    const response = await fetch(GOLDSKY_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const claimEvents = result.data?.rewardClaimeds || [];
    
    // Sum all claimed rewards across all wallets
    let totalClaimed = 0;
    for (const event of claimEvents) {
      totalClaimed += weiToTokens(event.amount);
    }

    console.log(`📊 Global total claimed: ${totalClaimed.toLocaleString()} tokens from ${claimEvents.length} claim events`);

    return totalClaimed;

  } catch (error) {
    console.error('📊 Error querying global total claimed:', error);
    return 0;
  }
}

/**
 * Get detailed staking info for a user - uses RPC for balances
 */
export async function getUserStakingDetails(walletAddresses) {
  if (!walletAddresses || walletAddresses.length === 0) {
    return { totalStaked: 0, stakes: [], wallets: [] };
  }

  const normalizedAddresses = walletAddresses
    .filter(addr => typeof addr === 'string' && addr.startsWith('0x'))
    .map(addr => addr.toLowerCase());

  try {
    const stakes = [];
    let totalStaked = 0;
    
    // Query each wallet's staked balance directly from contract
    for (const address of normalizedAddresses) {
      const data = FUNCTION_SIGS.balanceOf + address.slice(2).padStart(64, '0');
      
      try {
        const result = await ethCall(STAKING_CONTRACT, data);
        if (result && result !== '0x') {
          const balance = weiToTokens(result);
          if (balance > 0) {
            stakes.push({
              wallet: address,
              amount: balance,
              timestamp: new Date().toISOString()
            });
            totalStaked += balance;
          }
        }
      } catch (err) {
        console.warn(`📊 Failed to get stake for ${address}:`, err.message);
      }
    }

    console.log(`📊 User staked balance: ${totalStaked.toLocaleString()} tokens across ${stakes.length} wallet(s)`);

    return {
      totalStaked,
      stakes,
      wallets: normalizedAddresses
    };

  } catch (error) {
    console.error('📊 Error querying staking details:', error);
    return {
      totalStaked: 0,
      stakes: [],
      wallets: normalizedAddresses,
      error: error.message
    };
  }
}

