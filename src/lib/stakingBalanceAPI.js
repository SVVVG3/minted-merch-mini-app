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

    // Sum up all staked balances for the user's wallets
    const stakerBalances = result.data?.stakerBalances || [];
    const totalStaked = stakerBalances.reduce((sum, stakerBalance) => {
      // Convert from wei to tokens (divide by 10^18)
      const balance = parseFloat(stakerBalance.balance) / Math.pow(10, 18);
      return sum + balance;
    }, 0);

    console.log(`📊 Total staked balance: ${totalStaked.toLocaleString()} tokens across ${stakerBalances.length} wallet(s)`);

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
    const formattedBalances = stakerBalances.map(balance => ({
      wallet: balance.staker,
      amount: parseFloat(balance.balance) / Math.pow(10, 18),
      timestamp: new Date(parseInt(balance.timestamp_) * 1000).toISOString(),
      id: balance.id
    }));

    const totalStaked = formattedBalances.reduce((sum, balance) => sum + balance.amount, 0);

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

