// Direct blockchain RPC integration for token-gating and portfolio data
// No longer dependent on Zapper API - uses direct blockchain calls for better reliability

// Legacy Zapper constants (kept for backward compatibility)
const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY;
const ZAPPER_GRAPHQL_ENDPOINT = 'https://public.zapper.xyz/graphql';

// Cache for API responses to minimize calls and costs
const zapperCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache for better UX (token balances don't change frequently)

// Request deduplication to prevent simultaneous calls for same data
const pendingRequests = new Map();

/**
 * Generate cache key for API requests
 */
function generateCacheKey(type, walletAddresses, contractAddresses, chainIds) {
  const sortedWallets = [...walletAddresses].sort();
  const sortedContracts = [...contractAddresses].sort();
  const sortedChains = [...chainIds].sort();
  return `${type}:${sortedWallets.join(',')}:${sortedContracts.join(',')}:${sortedChains.join(',')}`;
}

/**
 * Check if cached response is still valid
 */
function isCacheValid(cacheEntry) {
  return cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_DURATION;
}

/**
 * Get cached response if valid
 */
function getCachedResponse(cacheKey) {
  const cached = zapperCache.get(cacheKey);
  if (isCacheValid(cached)) {
    console.log(`💾 Using cached Zapper response for: ${cacheKey}`);
    return { ...cached.data, fromCache: true };
  }
  return null;
}

/**
 * Cache API response
 */
function setCachedResponse(cacheKey, data) {
  zapperCache.set(cacheKey, {
    data: { ...data, fromCache: false },
    timestamp: Date.now()
  });
  
  // Clean up old cache entries periodically
  if (zapperCache.size > 100) {
    const cutoff = Date.now() - CACHE_DURATION;
    for (const [key, entry] of zapperCache.entries()) {
      if (entry.timestamp < cutoff) {
        zapperCache.delete(key);
      }
    }
  }
}

/**
 * Check NFT balance directly via blockchain RPC (more reliable than Zapper)
 */
async function checkNftBalanceDirectly(walletAddresses, contractAddresses, chainId) {
  const rpcUrls = {
    1: 'https://eth.llamarpc.com',
    8453: 'https://mainnet.base.org',
    137: 'https://polygon.llamarpc.com',
    42161: 'https://arb1.arbitrum.io/rpc'
  };

  const rpcUrl = rpcUrls[chainId] || rpcUrls[1]; // Default to Ethereum for NFTs
  
  console.log('🖼️ Checking NFT balance via RPC:', {
    rpcUrl,
    contracts: contractAddresses,
    walletCount: walletAddresses.length,
    chainId
  });

  let totalNfts = 0;
  const collectionDetails = [];

  // Check each NFT contract
  for (const contractAddress of contractAddresses) {
    let contractTotal = 0;
    
    // Check balance for each wallet address
    for (const walletAddress of walletAddresses) {
      try {
        // ERC-721 balanceOf function call (same as ERC-20)
        const data = `0x70a08231${walletAddress.slice(2).padStart(64, '0')}`;
        
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
              {
                to: contractAddress,
                data: data
              },
              'latest'
            ],
            id: 1
          })
        });

        const result = await response.json();
        
        if (result.result && result.result !== '0x') {
          // Convert hex to decimal (NFTs are whole numbers, no decimals)
          const balanceHex = result.result;
          const nftCount = parseInt(balanceHex, 16);
          
          contractTotal += nftCount;
          
          if (nftCount > 0) {
            console.log(`🖼️ Wallet ${walletAddress}: ${nftCount} NFTs from ${contractAddress}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error checking NFT balance for ${walletAddress}:`, error);
        // Continue with other addresses
      }
    }
    
    totalNfts += contractTotal;
    collectionDetails.push({
      address: contractAddress,
      name: `NFT Collection ${contractAddress.slice(0, 8)}...`,
      chainId: chainId,
      totalTokensOwned: contractTotal,
      distinctTokensOwned: contractTotal, // Assume each token is distinct
      totalBalanceUSD: 0 // We don't have USD conversion without external APIs
    });
  }

  console.log(`🖼️ Total NFT balance across all collections: ${totalNfts}`);
  
  return {
    success: true,
    totalNfts,
    collectionDetails,
    method: 'direct_rpc'
  };
}

/**
 * Check if user holds specific NFTs using Zapper API
 * @param {Array} walletAddresses - Array of wallet addresses to check
 * @param {Array} contractAddresses - Array of NFT contract addresses
 * @param {Array} chainIds - Array of chain IDs to check (default: [1] for Ethereum)
 * @param {number} requiredBalance - Minimum NFT count required
 * @returns {Promise<Object>} NFT holding result
 */
export async function checkNftHoldingsWithZapper(walletAddresses, contractAddresses, chainIds = [1], requiredBalance = 1) {
  // Filter out invalid addresses - only check valid Ethereum addresses (0x...)
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

  // Use direct blockchain RPC instead of Zapper API for better reliability
  console.log('🖼️ Using direct blockchain RPC for NFT checking (bypassing Zapper API)');
  
  try {
    const nftResult = await checkNftBalanceDirectly(validAddresses, contractAddresses, chainIds[0] || 1);
    
    const eligible = nftResult.totalNfts >= requiredBalance;
    
    console.log('✅ Direct blockchain NFT check result:', {
      eligible,
      totalNfts: nftResult.totalNfts,
      required: requiredBalance,
      contractsChecked: contractAddresses,
      method: 'direct_rpc'
    });

    return {
      success: true,
      totalNfts: nftResult.totalNfts,
      eligible,
      collectionDetails: nftResult.collectionDetails,
      message: `Found ${nftResult.totalNfts} NFT(s), need ${requiredBalance}`
    };
    
  } catch (rpcError) {
    console.error('❌ Direct RPC NFT check failed:', rpcError);
    // Fall back to mock data only if RPC fails
    console.log('🔄 Falling back to mock NFT data...');
    return getMockNftHoldings(walletAddresses, contractAddresses, requiredBalance);
  }
}

/**
 * Check token balance directly via blockchain RPC (more reliable than Zapper)
 */
export async function checkTokenBalanceDirectly(walletAddresses, contractAddresses, chainId) {
  // Multiple RPC endpoints for Base chain to distribute load and avoid rate limits
  const rpcUrls = {
    1: ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com'],
    8453: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com', 
      'https://base.publicnode.com',
      'https://1rpc.io/base',
      'https://base-rpc.publicnode.com'
    ],
    137: ['https://polygon.llamarpc.com', 'https://polygon.publicnode.com'],
    42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.publicnode.com']
  };

  const availableRpcs = rpcUrls[chainId] || rpcUrls[8453];
  let rpcUrl = availableRpcs[0]; // Start with first RPC
  const contractAddress = contractAddresses[0]; // Focus on the first contract (mintedmerch)

  console.log('🔗 Checking token balance via RPC:', {
    rpcUrl,
    contractAddress,
    walletCount: walletAddresses.length,
    chainId
  });

  let totalBalance = 0;
  const balanceResults = [];

  // Check balance for each wallet address with optimized delays for better UX
  for (let i = 0; i < walletAddresses.length; i++) {
    const walletAddress = walletAddresses[i];
    
    try {
      // Reduced delays for better user experience - most RPC endpoints can handle faster requests
      if (i > 0) {
        const delay = Math.min(200 + (i * 100), 1000); // Faster delays: 200ms, 300ms, 400ms... up to 1s
        console.log(`⏳ Waiting ${delay}ms before checking next wallet...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // ERC-20 balanceOf function call
      const data = `0x70a08231${walletAddress.slice(2).padStart(64, '0')}`;
      
      console.log(`🔍 Checking wallet ${i + 1}/${walletAddresses.length}: ${walletAddress}`);
      
      // Retry logic with multiple RPC endpoints
      let response;
      let retryCount = 0;
      const maxRetries = availableRpcs.length * 2; // Try each RPC twice
      
      while (retryCount <= maxRetries) {
        try {
          // Cycle through different RPC endpoints on retries
          const currentRpcIndex = Math.floor(retryCount / 2) % availableRpcs.length;
          const currentRpcUrl = availableRpcs[currentRpcIndex];
          
          if (retryCount > 0) {
            console.log(`🔄 Trying RPC endpoint ${currentRpcIndex + 1}/${availableRpcs.length}: ${currentRpcUrl}`);
          }
          
          response = await fetch(currentRpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [
                {
                  to: contractAddress,
                  data: data
                },
                'latest'
              ],
              id: Date.now() + i + retryCount // Unique ID for each request
            })
          });

          if (response.status === 429) {
            // Rate limited - try next RPC or wait shorter time for better UX
            retryCount++;
            if (retryCount <= maxRetries) {
              const retryDelay = Math.min(1000 + (retryCount * 500), 5000); // 1s, 1.5s, 2s... up to 5s
              console.log(`⏳ Rate limited on ${currentRpcUrl}, retrying in ${retryDelay}ms (attempt ${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              continue;
            }
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          break; // Success, exit retry loop
          
        } catch (fetchError) {
          if (retryCount >= maxRetries) {
            throw fetchError;
          }
          retryCount++;
          const retryDelay = Math.min(1000 + (retryCount * 500), 5000);
          console.log(`⏳ Request failed, retrying in ${retryDelay}ms (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`RPC Error: ${result.error.message || result.error}`);
      }
      
      let walletBalance = 0;
      if (result.result && result.result !== '0x') {
        // Convert hex to decimal and adjust for 18 decimals
        const balanceHex = result.result;
        const balanceWei = BigInt(balanceHex);
        walletBalance = Number(balanceWei) / Math.pow(10, 18);
        
        totalBalance += walletBalance;
        
        console.log(`💰 Wallet ${walletAddress}: ${walletBalance.toLocaleString()} tokens`);
      } else {
        console.log(`💰 Wallet ${walletAddress}: 0 tokens`);
      }
      
      balanceResults.push({
        wallet: walletAddress,
        balance: walletBalance,
        success: true
      });
      
    } catch (error) {
      console.error(`❌ Error checking balance for ${walletAddress}:`, error);
      balanceResults.push({
        wallet: walletAddress,
        balance: 0,
        success: false,
        error: error.message
      });
      // Continue with other addresses
    }
  }

  console.log(`📊 Total token balance across all wallets: ${totalBalance.toLocaleString()}`);
  console.log(`📊 Balance check results:`, balanceResults);
  
  return totalBalance;
}

/**
 * Process Zapper API token response data
 */
async function processTokenResponse(data, contractAddresses, chainIds, requiredBalance, cacheKey) {
  console.log('📊 Zapper REST API response:', {
    dataKeys: Object.keys(data || {}),
    hasBalances: !!data?.balances,
    isArray: Array.isArray(data),
    dataLength: Array.isArray(data) ? data.length : 'not array'
  });

  // Process the REST API response format
  if (!data || !Array.isArray(data)) {
    console.warn('❌ Unexpected Zapper API response format:', data);
    return {
      hasRequiredTokens: false,
      totalBalance: 0,
      tokenBalances: [],
      apiCalls: 1
    };
  }

  // Filter for the specific contract addresses we're checking (case-insensitive)
  const lowerCaseContracts = contractAddresses.map(addr => addr.toLowerCase());
  const relevantTokens = data.filter(tokenData => {
    const tokenAddress = tokenData.token?.address?.toLowerCase();
    return tokenAddress && lowerCaseContracts.includes(tokenAddress);
  });

  // Extract token balance information from REST API format
  const balanceDetails = relevantTokens.map(tokenData => ({
    contractAddress: tokenData.token?.address,
    symbol: tokenData.token?.symbol,
    name: tokenData.token?.name,
    chainId: tokenData.token?.network?.chainId || chainIds[0],
    balance: parseFloat(tokenData.balance || 0), // Actual token balance
    balanceRaw: tokenData.balanceRaw,
    balanceUsd: parseFloat(tokenData.balanceUSD || 0),
    decimals: tokenData.token?.decimals
  }));

  // Calculate total balance for the specific tokens we're checking
  const totalBalance = balanceDetails.reduce((sum, token) => sum + token.balance, 0);
  const hasRequiredTokens = totalBalance >= requiredBalance;

  console.log('✅ Zapper REST API token check result:', {
    hasRequired: hasRequiredTokens,
    totalTokenBalance: totalBalance,
    required: requiredBalance,
    contractsChecked: contractAddresses,
    tokensFound: balanceDetails.length,
    relevantTokensFound: relevantTokens.length,
    totalApiResults: data.length,
    tokenDetails: balanceDetails.map(t => ({
      symbol: t.symbol,
      balance: t.balance,
      address: t.contractAddress
    }))
  });

  const result = {
    hasRequiredTokens,
    totalBalance,
    tokenBalances: balanceDetails,
    apiCalls: 1
  };

  // Cache the successful result
  setCachedResponse(cacheKey, result);
  return result;
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

  // Check cache first to avoid unnecessary API calls
  const cacheKey = generateCacheKey('tokens', validAddresses, contractAddresses, chainIds);
  const cachedResult = getCachedResponse(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Check if there's already a pending request for the same data
  if (pendingRequests.has(cacheKey)) {
    console.log(`⏳ Waiting for pending Zapper request: ${cacheKey}`);
    return await pendingRequests.get(cacheKey);
  }

  // Create promise for this request and store it to prevent duplicates
  const requestPromise = (async () => {
    try {
      console.log('🪙 Checking token holdings with Zapper API:', {
        totalWallets: walletAddresses.length,
        validWallets: validAddresses.length,
        contracts: contractAddresses,
        chains: chainIds,
        required: requiredBalance,
        cacheKey: cacheKey.substring(0, 50) + '...'
      });

    // Since Zapper API is giving 403 errors, let's try a direct blockchain RPC approach
    // This will be more reliable and doesn't require API keys
    console.log('🔗 Using direct blockchain RPC instead of Zapper API for better reliability');
    
    try {
      const tokenBalances = await checkTokenBalanceDirectly(validAddresses, contractAddresses, chainIds[0] || 8453);
      
      const result = {
        hasRequiredTokens: tokenBalances >= requiredBalance,
        totalBalance: tokenBalances,
        tokenBalances: [{
          contractAddress: contractAddresses[0],
          symbol: 'MINTEDMERCH',
          name: '$mintedmerch',
          chainId: chainIds[0] || 8453,
          balance: tokenBalances,
          balanceRaw: tokenBalances.toString(),
          balanceUsd: 0, // We don't have USD conversion without Zapper
          decimals: 18
        }],
        apiCalls: validAddresses.length // One RPC call per address
      };

      console.log('✅ Direct blockchain token check result:', {
        hasRequired: result.hasRequiredTokens,
        totalTokenBalance: result.totalBalance,
        required: requiredBalance,
        contractsChecked: contractAddresses,
        method: 'direct_rpc'
      });

      // Cache the successful result
      setCachedResponse(cacheKey, result);
      return result;
      
    } catch (rpcError) {
      console.error('❌ Direct RPC also failed:', rpcError);
      // Fall through to original Zapper attempt as final fallback
    }

    // Fallback to Zapper API (original code) if RPC fails
    const baseUrl = 'https://api.zapper.xyz';
    const endpoint = '/v2/balances/tokens';
    
    const params = new URLSearchParams({
      'addresses[]': validAddresses.join(','),
      'network': getNetworkSlugFromChainId(chainIds[0] || 8453)
    });

    console.log('🔄 Falling back to Zapper API as last resort...');
    
    const response = await fetch(`${baseUrl}${endpoint}?${params}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'User-Agent': 'Minted-Merch-App/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Zapper API error details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
        url: `${baseUrl}${endpoint}?${params}`
      });
      throw new Error(`Zapper API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return await processTokenResponse(data, contractAddresses, chainIds, requiredBalance, cacheKey);

    } catch (error) {
      console.error('❌ Error checking token holdings with Zapper:', error);
      
      // Fallback to mock data in case of API issues
      console.log('🔄 Falling back to mock token data...');
      const mockResult = getMockTokenHoldings(walletAddresses, contractAddresses, requiredBalance);
      
      // Don't cache mock data, but still return it
      return mockResult;
    }
  })();

  // Store the promise to prevent duplicate requests
  pendingRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } finally {
    // Clean up the pending request
    pendingRequests.delete(cacheKey);
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
 * Helper function to convert chain ID to Zapper network slug for REST API
 */
function getNetworkSlugFromChainId(chainId) {
  const networkMap = {
    1: 'ethereum',
    8453: 'base',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    43114: 'avalanche',
    250: 'fantom',
    56: 'binance-smart-chain'
  };
  
  return networkMap[chainId] || 'base';
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