// Staking balance API for querying user's staked $MINTEDMERCH tokens
// GraphQL endpoint: https://api.goldsky.com/api/public/project_cmhgzsg1lfhim01w4ah9rb5i5/subgraphs/betr-contracts-base/1.1/gn

const GOLDSKY_GRAPHQL_ENDPOINT = 'https://api.goldsky.com/api/public/project_cmhgzsg1lfhim01w4ah9rb5i5/subgraphs/betr-contracts-base/1.1/gn';

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
    // GraphQL query to get staked balances
    // Adjust this query based on the actual schema of the betr-contracts subgraph
    const query = `
      query GetStakedBalances($addresses: [String!]!) {
        stakes(where: { user_in: $addresses }) {
          user
          amount
          stakedAt
          active
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

    // Sum up all active stakes for the user's wallets
    const stakes = result.data?.stakes || [];
    const totalStaked = stakes
      .filter(stake => stake.active) // Only count active stakes
      .reduce((sum, stake) => {
        // Convert from wei to tokens (divide by 10^18)
        const stakeAmount = parseFloat(stake.amount) / Math.pow(10, 18);
        return sum + stakeAmount;
      }, 0);

    console.log(`📊 Total staked balance: ${totalStaked.toLocaleString()} tokens across ${stakes.length} stake(s)`);

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
        stakes(where: { user_in: $addresses }, orderBy: stakedAt, orderDirection: desc) {
          user
          amount
          stakedAt
          active
          unlockTime
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

    const stakes = result.data?.stakes || [];
    const formattedStakes = stakes.map(stake => ({
      wallet: stake.user,
      amount: parseFloat(stake.amount) / Math.pow(10, 18),
      stakedAt: new Date(parseInt(stake.stakedAt) * 1000).toISOString(),
      active: stake.active,
      unlockTime: stake.unlockTime ? new Date(parseInt(stake.unlockTime) * 1000).toISOString() : null
    }));

    const totalStaked = formattedStakes
      .filter(stake => stake.active)
      .reduce((sum, stake) => sum + stake.amount, 0);

    return {
      totalStaked,
      stakes: formattedStakes,
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

