// Staking balance API for querying user's staked $MINTEDMERCH tokens
// GraphQL endpoint: https://api.goldsky.com/api/public/project_cmhgzsg1lfhim01w4ah9rb5i5/subgraphs/betr-contracts-base/1.1/gn

const GOLDSKY_GRAPHQL_ENDPOINT = 'https://api.goldsky.com/api/public/project_cmhgzsg1lfhim01w4ah9rb5i5/subgraphs/betr-contracts-base/1.1/gn';

// Use BigInt for precision with large wei values (exceed Number.MAX_SAFE_INTEGER)
const WEI_DIVISOR = BigInt(10 ** 18);

/**
 * Convert wei string to token number with full precision using BigInt
 * @param {string} weiString - Balance in wei as string
 * @returns {number} Balance in tokens
 */
function weiToTokens(weiString) {
  try {
    const wei = BigInt(weiString);
    // Split into whole tokens and fractional part for precision
    return Number(wei / WEI_DIVISOR) + Number(wei % WEI_DIVISOR) / 1e18;
  } catch (e) {
    // Fallback for invalid input
    return parseFloat(weiString) / 1e18;
  }
}

/**
 * Query user's staked token balance from the staking contract
 * @param {Array<string>} walletAddresses - User's wallet addresses (lowercase)
 * @returns {Promise<number>} Total staked balance in tokens (not wei)
 */
export async function getUserStakedBalance(walletAddresses) {
  if (!walletAddresses || walletAddresses.length === 0) {
    console.log('📊 No wallet addresses provided for staking balance check');
    return 0;
  }

  // Normalize addresses to lowercase for GraphQL query
  const normalizedAddresses = walletAddresses
    .filter(addr => typeof addr === 'string' && addr.startsWith('0x'))
    .map(addr => addr.toLowerCase());

  if (normalizedAddresses.length === 0) {
    console.log('📊 No valid wallet addresses for staking balance check');
    return 0;
  }

  console.log(`📊 Querying staking balance for ${normalizedAddresses.length} wallet(s)`);

  try {
    // GraphQL query to get staked balances using the correct schema
    // Schema has 'stakerBalances' (not 'stakes')
    const query = `
      query GetStakedBalances($addresses: [String!]!) {
        stakerBalances(where: { staker_in: $addresses }) {
          id
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
      body: JSON.stringify({
        query,
        variables: {
          addresses: normalizedAddresses
        }
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('📊 GraphQL errors:', result.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    // IMPORTANT: Only use the LATEST balance per wallet (subgraph stores historical entries)
    const stakerBalances = result.data?.stakerBalances || [];
    const latestBalancePerWallet = new Map();
    
    for (const entry of stakerBalances) {
      const wallet = entry.staker.toLowerCase();
      const timestamp = parseInt(entry.timestamp_);
      // Keep only the entry with the highest timestamp for each wallet
      if (!latestBalancePerWallet.has(wallet) || timestamp > latestBalancePerWallet.get(wallet).timestamp) {
        latestBalancePerWallet.set(wallet, {
          balance: weiToTokens(entry.balance),
          timestamp: timestamp
        });
      }
    }
    
    // Sum up latest balances only
    let totalStaked = 0;
    for (const { balance } of latestBalancePerWallet.values()) {
      totalStaked += balance;
    }

    console.log(`📊 Total staked balance: ${totalStaked.toLocaleString()} tokens across ${latestBalancePerWallet.size} wallet(s)`);

    return totalStaked;

  } catch (error) {
    console.error('📊 Error querying staking balance:', error);
    console.warn('📊 Continuing with 0 staked balance due to error');
    // Return 0 instead of throwing - staking balance is additive, so failure shouldn't break token checks
    return 0;
  }
}

/**
 * Get detailed staking information for a user (for display/debugging)
 * @param {Array<string>} walletAddresses - User's wallet addresses
 * @returns {Promise<Object>} Detailed staking info
 */
/**
 * Get the global total staked across all users
 * @returns {Promise<number>} Total staked balance in tokens (not wei)
 */
export async function getGlobalTotalStaked() {
  try {
    // Query all staker balances - need to get staker address to dedupe
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
    
    // IMPORTANT: Only use the LATEST balance per staker (subgraph stores historical entries)
    const latestBalancePerStaker = new Map();
    for (const entry of stakerBalances) {
      const staker = entry.staker.toLowerCase();
      // Since ordered by timestamp desc, first entry per staker is the latest
      if (!latestBalancePerStaker.has(staker)) {
        latestBalancePerStaker.set(staker, weiToTokens(entry.balance));
      }
    }
    
    // Sum up latest balances
    let totalStaked = 0;
    for (const balance of latestBalancePerStaker.values()) {
      totalStaked += balance;
    }

    console.log(`📊 Global total staked: ${totalStaked.toLocaleString()} tokens across ${latestBalancePerStaker.size} unique stakers`);

    return totalStaked;

  } catch (error) {
    console.error('📊 Error querying global staked balance:', error);
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
 * Get staking statistics (total staked and unique staker count) from live subgraph
 * @returns {Promise<{totalStaked: number, uniqueStakers: number}>}
 */
export async function getStakingStats() {
  try {
    // Query all staker balances
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
    
    // Get latest balance per staker (since subgraph stores historical entries)
    const latestBalancePerStaker = new Map();
    for (const entry of stakerBalances) {
      const staker = entry.staker.toLowerCase();
      // Since ordered by timestamp desc, first entry per staker is the latest
      if (!latestBalancePerStaker.has(staker)) {
        latestBalancePerStaker.set(staker, weiToTokens(entry.balance));
      }
    }
    
    // Sum up latest balances and count active stakers (balance > 0)
    let totalStaked = 0;
    let uniqueStakers = 0;
    for (const balance of latestBalancePerStaker.values()) {
      if (balance > 0) {
        totalStaked += balance;
        uniqueStakers++;
      }
    }

    console.log(`📊 Staking stats from subgraph: ${totalStaked.toLocaleString()} tokens across ${uniqueStakers} active stakers`);

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

export async function getUserStakingDetails(walletAddresses) {
  if (!walletAddresses || walletAddresses.length === 0) {
    return {
      totalStaked: 0,
      stakes: [],
      wallets: []
    };
  }

  const normalizedAddresses = walletAddresses
    .filter(addr => typeof addr === 'string' && addr.startsWith('0x'))
    .map(addr => addr.toLowerCase());

  try {
    const query = `
      query GetStakingDetails($addresses: [String!]!) {
        stakerBalances(where: { staker_in: $addresses }, orderBy: timestamp_, orderDirection: desc) {
          id
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

    const stakerBalances = result.data?.stakerBalances || [];
    
    // IMPORTANT: Only use the LATEST balance per wallet (subgraph stores historical entries)
    // Since results are ordered by timestamp desc, first entry per wallet is the latest
    const latestBalancePerWallet = new Map();
    for (const entry of stakerBalances) {
      const wallet = entry.staker.toLowerCase();
      if (!latestBalancePerWallet.has(wallet)) {
        latestBalancePerWallet.set(wallet, {
          wallet: wallet,
          amount: weiToTokens(entry.balance),
          timestamp: new Date(parseInt(entry.timestamp_) * 1000).toISOString(),
          id: entry.id
        });
      }
    }
    
    const formattedBalances = Array.from(latestBalancePerWallet.values());
    const totalStaked = formattedBalances.reduce((sum, balance) => sum + balance.amount, 0);

    console.log(`📊 User staked balance: ${totalStaked.toLocaleString()} tokens across ${formattedBalances.length} wallet(s)`);

    return {
      totalStaked,
      stakes: formattedBalances,
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

