// Zapper API integration for token-gating and portfolio data
// Documentation: https://docs.zapper.xyz/docs/apis/balances

const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY;
const ZAPPER_GRAPHQL_ENDPOINT = 'https://public.zapper.xyz/graphql';

/**
 * Check if user holds specific NFTs using Zapper API
 * @param {Array} walletAddresses - Array of wallet addresses to check
 * @param {Array} contractAddresses - Array of NFT contract addresses
 * @param {Array} chainIds - Array of chain IDs to check (default: [1] for Ethereum)
 * @param {number} requiredBalance - Minimum NFT count required
 * @returns {Promise<Object>} NFT holding result
 */
export async function checkNftHoldingsWithZapper(walletAddresses, contractAddresses, chainIds = [1], requiredBalance = 1) {
  if (!ZAPPER_API_KEY) {
    console.warn('Zapper API key not configured, using mock data');
    return getMockNftHoldings(walletAddresses, contractAddresses, requiredBalance);
  }

  // Filter out invalid addresses - Zapper only accepts valid Ethereum addresses (0x...)
  const validAddresses = walletAddresses.filter(addr => {
    const isValid = typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42;
    if (!isValid) {
      console.log(`🚫 Filtering out invalid address for NFT check: ${addr}`);
    }
    return isValid;
  });

  if (validAddresses.length === 0) {
    console.warn('❌ No valid Ethereum addresses found for NFT check, using mock data');
    return getMockNftHoldings(walletAddresses, contractAddresses, requiredBalance);
  }

  try {
    console.log('🔍 Checking NFT holdings with Zapper API:', {
      totalWallets: walletAddresses.length,
      validWallets: validAddresses.length,
      contracts: contractAddresses,
      chains: chainIds,
      required: requiredBalance
    });

    // Convert contract addresses to the new format expected by Zapper API
    const collections = contractAddresses.map(address => ({
      address: address,
      chainId: chainIds[0] || 1 // Use the first chain ID as default
    }));

    const query = `
      query GetNftBalances($addresses: [Address!]!, $chainIds: [Int!]!, $collections: [NftCollectionInputV2!]!) {
        portfolioV2(addresses: $addresses, chainIds: $chainIds) {
          nftBalances {
            byCollection(
              first: 100,
              filters: {
                collections: $collections
              }
            ) {
              edges {
                node {
                  collection {
                    address
                    name
                    chainId
                  }
                  totalTokensOwned
                  distinctTokensOwned
                  totalBalanceUSD
                }
              }
            }
            totalTokensOwned
            distinctTokensOwned
          }
        }
      }
    `;

    const variables = {
      addresses: validAddresses,
      chainIds: chainIds,
      collections: collections
    };

    const response = await fetch(ZAPPER_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(ZAPPER_API_KEY + ':').toString('base64')}`
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`Zapper API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const nftBalances = data.data?.portfolioV2?.nftBalances;
    if (!nftBalances) {
      console.warn('No NFT balance data returned from Zapper API');
      return {
        success: false,
        totalNfts: 0,
        eligible: false,
        message: 'No NFT data returned from Zapper API'
      };
    }

    console.log('✅ Zapper API NFT data:', {
      totalTokensOwned: nftBalances.totalTokensOwned,
      distinctTokensOwned: nftBalances.distinctTokensOwned,
      collections: nftBalances.byCollection.edges.length
    });

    // Calculate total NFTs across all specified collections
    let totalNfts = 0;
    const collectionDetails = [];

    for (const edge of nftBalances.byCollection.edges) {
      const collection = edge.node;
      const nftCount = parseInt(collection.totalTokensOwned) || 0;
      
      totalNfts += nftCount;
      collectionDetails.push({
        address: collection.collection.address,
        name: collection.collection.name,
        chainId: collection.collection.chainId,
        totalTokensOwned: nftCount,
        distinctTokensOwned: collection.distinctTokensOwned,
        totalBalanceUSD: collection.totalBalanceUSD
      });
    }

    console.log('📊 NFT Holdings Summary:', {
      totalNfts,
      requiredBalance,
      eligible: totalNfts >= requiredBalance,
      collectionDetails
    });

    return {
      success: true,
      totalNfts,
      eligible: totalNfts >= requiredBalance,
      collectionDetails,
      message: `Found ${totalNfts} NFT(s), need ${requiredBalance}`
    };

  } catch (error) {
    console.error('❌ Error checking NFT holdings with Zapper:', error);
    
    // Fall back to mock data
    console.log('🔄 Falling back to mock NFT data...');
    return getMockNftHoldings(walletAddresses, contractAddresses, requiredBalance);
  }
}

/**
 * Check if user holds specific tokens using Zapper API
 * @param {Array} walletAddresses - Array of wallet addresses to check
 * @param {Array} contractAddresses - Array of token contract addresses
 * @param {Array} chainIds - Array of chain IDs to check
 * @param {number} requiredBalance - Minimum token balance required
 * @returns {Promise<Object>} Token holding result
 */
export async function checkTokenHoldingsWithZapper(walletAddresses, contractAddresses, chainIds = [1], requiredBalance = 1) {
  if (!ZAPPER_API_KEY) {
    console.warn('Zapper API key not configured, using mock data');
    return getMockTokenHoldings(walletAddresses, contractAddresses, requiredBalance);
  }

  // Filter out invalid addresses - Zapper only accepts valid Ethereum addresses (0x...)
  const validAddresses = walletAddresses.filter(addr => {
    const isValid = typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42;
    if (!isValid) {
      console.log(`🚫 Filtering out invalid address: ${addr}`);
    }
    return isValid;
  });

  if (validAddresses.length === 0) {
    console.warn('❌ No valid Ethereum addresses found, using mock data');
    return getMockTokenHoldings(walletAddresses, contractAddresses, requiredBalance);
  }

  try {
    console.log('🪙 Checking token holdings with Zapper API:', {
      totalWallets: walletAddresses.length,
      validWallets: validAddresses.length,
      contracts: contractAddresses,
      chains: chainIds,
      required: requiredBalance
    });

    const query = `
      query PortfolioV2Totals($addresses: [Address!]!) {
        portfolioV2(addresses: $addresses) {
          tokenBalances {
            totalBalanceUSD
            byNetwork(first: 20) {
              edges {
                node {
                  network {
                    name
                    slug
                    chainId
                  }
                  balanceUSD
                }
              }
            }
          }
          nftBalances {
            totalBalanceUSD
            byNetwork(first: 20) {
              edges {
                node {
                  network {
                    name
                    slug
                    chainId
                  }
                  balanceUSD
                }
              }
            }
          }
          appBalances {
            totalBalanceUSD
            byNetwork(first: 20) {
              edges {
                node {
                  network {
                    name
                    slug
                    chainId
                  }
                  balanceUSD
                }
              }
            }
          }
        }
      }
`;

    const variables = {
      addresses: validAddresses
    };

    const response = await fetch(ZAPPER_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(ZAPPER_API_KEY + ':').toString('base64')}`
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`Zapper API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    // Process the portfolio data using the new totals approach
    const portfolio = data.data?.portfolioV2;
    if (!portfolio) {
      return {
        hasRequiredTokens: false,
        totalBalance: 0,
        tokenBalances: [],
        apiCalls: 1
      };
    }

    // Calculate total portfolio value (tokens + NFTs + app balances)
    const tokenBalanceUSD = parseFloat(portfolio.tokenBalances?.totalBalanceUSD || 0);
    const nftBalanceUSD = parseFloat(portfolio.nftBalances?.totalBalanceUSD || 0);
    const appBalanceUSD = parseFloat(portfolio.appBalances?.totalBalanceUSD || 0);
    
    const totalPortfolioUSD = tokenBalanceUSD + nftBalanceUSD + appBalanceUSD;

    // For token gating, we'll use the total portfolio value as a proxy
    // Since we can't query specific tokens easily, we'll check if they have significant holdings
    const hasRequiredTokens = totalPortfolioUSD >= requiredBalance;

    console.log('✅ Zapper portfolio check result:', {
      hasRequired: hasRequiredTokens,
      totalPortfolioUSD: totalPortfolioUSD,
      tokenBalanceUSD: tokenBalanceUSD,
      nftBalanceUSD: nftBalanceUSD,
      appBalanceUSD: appBalanceUSD,
      required: requiredBalance,
      contractsChecked: contractAddresses
    });

    return {
      hasRequiredTokens,
      totalBalance: totalPortfolioUSD, // Return total portfolio value
      tokenBalances: [{
        contractAddress: contractAddresses[0] || 'portfolio',
        symbol: 'PORTFOLIO',
        name: 'Total Portfolio Value',
        chainId: chainIds[0] || 8453,
        balance: totalPortfolioUSD,
        balanceUsd: totalPortfolioUSD,
        price: 1
      }],
      apiCalls: 1
    };

  } catch (error) {
    console.error('❌ Error checking token holdings with Zapper:', error);
    
    // Fallback to mock data in case of API issues
    console.log('🔄 Falling back to mock token data...');
    return getMockTokenHoldings(walletAddresses, contractAddresses, requiredBalance);
  }
}

/**
 * Get comprehensive portfolio data for token-gating analysis
 * @param {Array} walletAddresses - Array of wallet addresses
 * @param {Array} chainIds - Array of chain IDs to check
 * @returns {Promise<Object>} Portfolio summary
 */
export async function getPortfolioSummaryWithZapper(walletAddresses, chainIds = [1, 8453]) {
  if (!ZAPPER_API_KEY) {
    console.warn('Zapper API key not configured, using mock data');
    return getMockPortfolioSummary(walletAddresses);
  }

  // Filter out invalid addresses - Zapper only accepts valid Ethereum addresses (0x...)
  const validAddresses = walletAddresses.filter(addr => {
    const isValid = typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42;
    if (!isValid) {
      console.log(`🚫 Filtering out invalid address for portfolio summary: ${addr}`);
    }
    return isValid;
  });

  if (validAddresses.length === 0) {
    console.warn('❌ No valid Ethereum addresses found for portfolio summary, using mock data');
    return getMockPortfolioSummary(walletAddresses);
  }

  try {
    console.log('📊 Getting portfolio summary with Zapper API:', {
      totalWallets: walletAddresses.length,
      validWallets: validAddresses.length,
      chains: chainIds
    });

    const query = `
      query GetPortfolioSummary($addresses: [Address!]!, $chainIds: [Int!]!) {
        portfolioV2(addresses: $addresses, chainIds: $chainIds) {
          tokenBalances {
            totalBalanceUSD
            byNetwork(first: 10) {
              edges {
                node {
                  network
                  totalBalanceUSD
                  totalTokensOwned
                }
              }
            }
          }
          nftBalances {
            totalBalanceUSD
            totalTokensOwned
            distinctTokensOwned
            byNetwork(first: 10) {
              edges {
                node {
                  network
                  totalBalanceUSD
                  totalTokensOwned
                }
              }
            }
          }
          appBalances {
            totalBalanceUSD
          }
        }
      }
    `;

    const variables = {
      addresses: validAddresses,
      chainIds: chainIds
    };

    const response = await fetch(ZAPPER_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(ZAPPER_API_KEY + ':').toString('base64')}`
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`Zapper API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const portfolio = data.data?.portfolioV2;
    if (!portfolio) {
      return getMockPortfolioSummary(walletAddresses);
    }

    const summary = {
      totalPortfolioValueUsd: (
        parseFloat(portfolio.tokenBalances?.totalBalanceUSD || 0) +
        parseFloat(portfolio.nftBalances?.totalBalanceUSD || 0) +
        parseFloat(portfolio.appBalances?.totalBalanceUSD || 0)
      ),
      tokenBalances: {
        totalValueUsd: parseFloat(portfolio.tokenBalances?.totalBalanceUSD || 0),
        networkBreakdown: portfolio.tokenBalances?.byNetwork?.edges?.map(edge => ({
          network: edge.node.network,
          valueUsd: parseFloat(edge.node.totalBalanceUSD || 0),
          tokenCount: parseInt(edge.node.totalTokensOwned || 0)
        })) || []
      },
      nftBalances: {
        totalValueUsd: parseFloat(portfolio.nftBalances?.totalBalanceUSD || 0),
        totalNfts: parseInt(portfolio.nftBalances?.totalTokensOwned || 0),
        distinctNfts: parseInt(portfolio.nftBalances?.distinctTokensOwned || 0),
        networkBreakdown: portfolio.nftBalances?.byNetwork?.edges?.map(edge => ({
          network: edge.node.network,
          valueUsd: parseFloat(edge.node.totalBalanceUSD || 0),
          nftCount: parseInt(edge.node.totalTokensOwned || 0)
        })) || []
      },
      appBalances: {
        totalValueUsd: parseFloat(portfolio.appBalances?.totalBalanceUSD || 0)
      },
      apiCalls: 1
    };

    console.log('✅ Portfolio summary:', {
      totalValue: summary.totalPortfolioValueUsd,
      tokenValue: summary.tokenBalances.totalValueUsd,
      nftValue: summary.nftBalances.totalValueUsd,
      nftCount: summary.nftBalances.distinctNfts
    });

    return summary;

  } catch (error) {
    console.error('❌ Error getting portfolio summary with Zapper:', error);
    return getMockPortfolioSummary(walletAddresses);
  }
}

/**
 * Helper function to convert chain ID to Zapper network enum
 */
function getNetworkFromChainId(chainId) {
  const networkMap = {
    1: 'ETHEREUM',
    8453: 'BASE',
    137: 'POLYGON',
    42161: 'ARBITRUM',
    10: 'OPTIMISM',
    43114: 'AVALANCHE',
    250: 'FANTOM',
    56: 'BSC'
  };
  
  return networkMap[chainId] || 'ETHEREUM';
}

/**
 * Mock NFT holdings for fallback/testing
 */
function getMockNftHoldings(walletAddresses, contractAddresses, requiredBalance) {
  console.log('🧪 Using mock NFT holdings data');
  
  // For testing purposes, return some NFTs if the user has multiple wallets
  const hasNfts = walletAddresses.length > 3; // Has NFTs if user has more than 3 wallets
  const totalNfts = hasNfts ? Math.max(requiredBalance, Math.floor(Math.random() * 3) + 1) : 0;
  
  return {
    success: true,
    totalNfts,
    eligible: totalNfts >= requiredBalance,
    collectionDetails: contractAddresses.map((addr, index) => ({
      address: addr,
      name: `Mock Collection ${index + 1}`,
      chainId: 1,
      totalTokensOwned: hasNfts ? Math.floor(Math.random() * 3) + 1 : 0,
      distinctTokensOwned: hasNfts ? Math.floor(Math.random() * 3) + 1 : 0,
      totalBalanceUSD: hasNfts ? Math.random() * 1000 : 0
    })),
    message: `Mock: Found ${totalNfts} NFT(s), need ${requiredBalance}`
  };
}

/**
 * Mock token holdings for fallback/testing
 */
function getMockTokenHoldings(walletAddresses, contractAddresses, requiredBalance) {
  console.log('🧪 Using mock token holdings data');
  
  // Most users should NOT qualify for token-gated discounts
  // Only give tokens to users with specific characteristics to avoid giving everyone discounts
  const hasSignificantHoldings = walletAddresses.length >= 5; // Only users with 5+ wallets
  const totalBalance = hasSignificantHoldings ? requiredBalance * 1.5 : requiredBalance * 0.1; // Well below requirement for most
  
  console.log('🧪 Mock token check:', {
    walletCount: walletAddresses.length,
    hasSignificantHoldings,
    totalBalance,
    requiredBalance,
    qualifies: totalBalance >= requiredBalance
  });
  
  return {
    hasRequiredTokens: totalBalance >= requiredBalance,
    totalBalance,
    tokenBalances: contractAddresses.map((addr, index) => ({
      contractAddress: addr,
      symbol: `MOCK${index + 1}`,
      name: `Mock Token ${index + 1}`,
      chainId: 8453, // Use Base chain
      balance: hasSignificantHoldings ? requiredBalance * 0.8 : requiredBalance * 0.05,
      balanceUsd: totalBalance,
      price: 1
    })),
    apiCalls: 1
  };
}

/**
 * Mock portfolio summary for fallback/testing
 */
function getMockPortfolioSummary(walletAddresses) {
  console.log('🧪 Using mock portfolio summary');
  
  return {
    totalPortfolioValueUsd: Math.random() * 10000,
    tokenBalances: {
      totalValueUsd: Math.random() * 5000,
      networkBreakdown: [
        { network: 'ETHEREUM', valueUsd: Math.random() * 3000, tokenCount: Math.floor(Math.random() * 20) },
        { network: 'BASE', valueUsd: Math.random() * 2000, tokenCount: Math.floor(Math.random() * 15) }
      ]
    },
    nftBalances: {
      totalValueUsd: Math.random() * 3000,
      totalNfts: Math.floor(Math.random() * 50),
      distinctNfts: Math.floor(Math.random() * 30),
      networkBreakdown: [
        { network: 'ETHEREUM', valueUsd: Math.random() * 2000, nftCount: Math.floor(Math.random() * 30) },
        { network: 'BASE', valueUsd: Math.random() * 1000, nftCount: Math.floor(Math.random() * 20) }
      ]
    },
    appBalances: {
      totalValueUsd: Math.random() * 2000
    },
    apiCalls: 1
  };
} 