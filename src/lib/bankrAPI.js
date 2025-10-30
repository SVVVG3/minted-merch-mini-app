/**
 * Bankr API Integration Utilities
 * 
 * Provides functions to interact with the Bankr Wallet API for:
 * - Checking Bankr Club membership status
 * - Looking up user wallet addresses by Farcaster username or X username
 * - Rate limiting and error handling
 * 
 * API Details:
 * - Endpoint: GET https://api-staging.bankr.bot/public/wallet
 * - Rate Limit: 100 requests per 15 minutes per IP
 */

const BANKR_API_BASE_URL = 'https://api-staging.bankr.bot';
const BANKR_API_TIMEOUT = 10000; // 10 seconds

/**
 * In-memory rate limiting cache
 * Structure: { [key]: { count: number, resetTime: number } }
 */
const rateLimitCache = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 95; // Conservative limit (API allows 100)

/**
 * Check if we're within rate limits for the current IP/session
 */
function checkRateLimit(key = 'default') {
  const now = Date.now();
  const entry = rateLimitCache.get(key);

  if (!entry) {
    // First request for this key
    rateLimitCache.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (now > entry.resetTime) {
    // Reset window has passed
    rateLimitCache.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit exceeded
  }

  // Increment count
  entry.count++;
  rateLimitCache.set(key, entry);
  return true;
}

/**
 * Get rate limit status for debugging
 */
export function getRateLimitStatus(key = 'default') {
  const now = Date.now();
  const entry = rateLimitCache.get(key);

  if (!entry) {
    return {
      requestCount: 0,
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      resetTime: null,
      timeUntilReset: 0,
      canMakeRequest: true
    };
  }

  const timeUntilReset = Math.max(0, entry.resetTime - now);
  const canMakeRequest = now > entry.resetTime || entry.count < RATE_LIMIT_MAX_REQUESTS;

  return {
    requestCount: entry.count,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    resetTime: new Date(entry.resetTime).toISOString(),
    timeUntilReset: Math.ceil(timeUntilReset / 1000), // seconds
    canMakeRequest
  };
}

/**
 * Make a request to the Bankr API with proper error handling and rate limiting
 */
async function bankrAPIRequest(username, platform, options = {}) {
  const rateLimitKey = options.rateLimitKey || 'default';
  
  // Check rate limiting
  if (!checkRateLimit(rateLimitKey)) {
    const status = getRateLimitStatus(rateLimitKey);
    throw new Error(`Rate limit exceeded. Can make request again in ${status.timeUntilReset} seconds.`);
  }

  // Validate inputs
  if (!username || typeof username !== 'string') {
    throw new Error('Username is required and must be a string');
  }

  if (!platform || !['twitter', 'farcaster'].includes(platform)) {
    throw new Error('Platform must be either "twitter" or "farcaster"');
  }

  const url = new URL(`${BANKR_API_BASE_URL}/public/wallet`);
  url.searchParams.set('username', username);
  url.searchParams.set('platform', platform);

  console.log(`🏦 Making Bankr API request: ${platform}/${username}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BANKR_API_TIMEOUT);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MintedMerch-MiniApp/1.0',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          found: false,
          error: `${platform} username not found or invalid`,
          status: 404
        };
      }

      if (response.status === 429) {
        throw new Error('Bankr API rate limit exceeded (server-side)');
      }

      throw new Error(`Bankr API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('✅ Bankr API response received:', {
      username: data.username,
      platform: data.platform,
      bankrClub: data.bankrClub,
      hasWallets: !!(data.evmAddress || data.solanaAddress)
    });

    return {
      success: true,
      found: true,
      data: data,
      status: 200
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Bankr API request timed out');
      throw new Error('Bankr API request timed out');
    }

    console.error('Bankr API request failed:', error);
    throw error;
  }
}

/**
 * Check if a Farcaster user is a Bankr Club member
 * @param {string} farcasterUsername - The Farcaster username (without @)
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Membership status result
 */
export async function checkBankrClubMembership(farcasterUsername, options = {}) {
  try {
    console.log(`🎫 Checking Bankr Club membership for Farcaster user: ${farcasterUsername}`);

    const result = await bankrAPIRequest(farcasterUsername, 'farcaster', options);
    
    if (!result.success || !result.found) {
      return {
        success: true,
        isMember: false,
        found: false,
        reason: 'Farcaster username not found in Bankr system',
        data: null
      };
    }

    const isMember = result.data.bankrClub === true;
    
    return {
      success: true,
      isMember,
      found: true,
      accountId: result.data.accountId,
      evmAddress: result.data.evmAddress,
      solanaAddress: result.data.solanaAddress,
      data: result.data
    };

  } catch (error) {
    console.error('Error checking Bankr Club membership:', error);
    return {
      success: false,
      isMember: false,
      found: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Look up user info by X/Twitter username
 * @param {string} xUsername - The X/Twitter username (without @)
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} User lookup result
 */
export async function lookupUserByXUsername(xUsername, options = {}) {
  try {
    console.log(`🐦 Looking up X user: ${xUsername}`);

    const result = await bankrAPIRequest(xUsername, 'twitter', options);
    
    if (!result.success || !result.found) {
      return {
        success: true,
        found: false,
        reason: 'X username not found in Bankr system',
        data: null
      };
    }

    return {
      success: true,
      found: true,
      isBankrClubMember: result.data.bankrClub === true,
      accountId: result.data.accountId,
      evmAddress: result.data.evmAddress,
      solanaAddress: result.data.solanaAddress,
      data: result.data
    };

  } catch (error) {
    console.error('Error looking up X username:', error);
    return {
      success: false,
      found: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Check both Farcaster and X usernames for Bankr Club membership
 * @param {string} farcasterUsername - The Farcaster username
 * @param {string} xUsername - The X username (optional)
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Combined membership check result
 */
export async function checkCombinedBankrMembership(farcasterUsername, xUsername = null, options = {}) {
  try {
    console.log(`🔍 Checking combined Bankr membership: FC=${farcasterUsername}, X=${xUsername || 'none'}`);

    const results = {
      farcaster: null,
      x: null,
      isMemberAnywhere: false,
      combinedData: {
        addresses: new Set(),
        accounts: []
      }
    };

    // Check Farcaster username
    if (farcasterUsername) {
      results.farcaster = await checkBankrClubMembership(farcasterUsername, options);
      if (results.farcaster.isMember) {
        results.isMemberAnywhere = true;
      }
      if (results.farcaster.found) {
        if (results.farcaster.evmAddress) results.combinedData.addresses.add(results.farcaster.evmAddress);
        if (results.farcaster.solanaAddress) results.combinedData.addresses.add(results.farcaster.solanaAddress);
        results.combinedData.accounts.push({ platform: 'farcaster', data: results.farcaster.data });
      }
    }

    // Check X username if provided
    if (xUsername) {
      results.x = await lookupUserByXUsername(xUsername, options);
      if (results.x.found && results.x.isBankrClubMember) {
        results.isMemberAnywhere = true;
      }
      if (results.x.found) {
        if (results.x.evmAddress) results.combinedData.addresses.add(results.x.evmAddress);
        if (results.x.solanaAddress) results.combinedData.addresses.add(results.x.solanaAddress);
        results.combinedData.accounts.push({ platform: 'x', data: results.x.data });
      }
    }

    // Convert Set to Array
    results.combinedData.addresses = Array.from(results.combinedData.addresses);

    return {
      success: true,
      isMemberAnywhere: results.isMemberAnywhere,
      farcasterResult: results.farcaster,
      xResult: results.x,
      combinedData: results.combinedData
    };

  } catch (error) {
    console.error('Error in combined Bankr membership check:', error);
    return {
      success: false,
      isMemberAnywhere: false,
      error: error.message
    };
  }
}

/**
 * Enhanced Bankr wallet data fetching with full wallet address details
 * Uses direct fetch to get actual wallet addresses (evmAddress, solanaAddress)
 * @param {string} username - The username to lookup
 * @param {'twitter' | 'farcaster'} platform - The platform type
 * @returns {Promise<Object|null>} Full Bankr response with wallet addresses
 */
export async function getBankrWalletData(username, platform) {
  try {
    console.log(`💳 Fetching enhanced Bankr wallet data for ${platform}/${username}`);

    // Use direct fetch approach to get actual wallet addresses
    const response = await fetch(
      `https://api-staging.bankr.bot/public/wallet?username=${encodeURIComponent(username)}&platform=${platform}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MintedMerch/1.0'
        },
        timeout: BANKR_API_TIMEOUT
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`💳 No Bankr wallet data found for ${platform}/${username} (404)`);
        return null; // User not found, which is expected for many users
      }
      throw new Error(`Bankr API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Enhanced response structure matching your interface
    const walletData = {
      username: data.username || username,
      platform: data.platform || platform,
      accountId: data.accountId,
      evmAddress: data.evmAddress,
      solanaAddress: data.solanaAddress,
      bankrClub: data.bankrClub === true,
      hasWallets: !!(data.evmAddress || data.solanaAddress),
      // Additional fields that might be useful
      verified: data.verified || false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };

    console.log(`💳 Enhanced Bankr wallet data retrieved:`, {
      username: walletData.username,
      platform: walletData.platform,
      accountId: walletData.accountId,
      hasEVM: !!walletData.evmAddress,
      hasSolana: !!walletData.solanaAddress,
      bankrClub: walletData.bankrClub,
      hasWallets: walletData.hasWallets,
      evmAddress: walletData.evmAddress ? `${walletData.evmAddress.substring(0, 6)}...${walletData.evmAddress.substring(38)}` : null,
      solanaAddress: walletData.solanaAddress ? `${walletData.solanaAddress.substring(0, 6)}...${walletData.solanaAddress.substring(38)}` : null
    });

    return walletData;

  } catch (error) {
    console.error(`💳 Error fetching enhanced Bankr wallet data for ${platform}/${username}:`, error);
    return null;
  }
}

/**
 * Convenience function to get Bankr wallet data for Farcaster users
 * @param {string} username - The Farcaster username
 * @returns {Promise<Object|null>} Bankr wallet data or null
 */
export async function getBankrDataForFarcasterUser(username) {
  return getBankrWalletData(username, 'farcaster');
}

/**
 * Convenience function to get Bankr wallet data for X/Twitter users
 * @param {string} username - The X/Twitter username
 * @returns {Promise<Object|null>} Bankr wallet data or null
 */
export async function getBankrDataForXUser(username) {
  return getBankrWalletData(username, 'twitter');
}

/**
 * Test the Bankr API connection and rate limiting
 * @param {Object} options - Test configuration
 * @returns {Promise<Object>} Test results
 */
export async function testBankrAPI(options = {}) {
  const testResults = {
    timestamp: new Date().toISOString(),
    apiEndpoint: BANKR_API_BASE_URL,
    rateLimitStatus: getRateLimitStatus(),
    tests: []
  };

  try {
    // Test 1: Valid Farcaster username (if provided)
    if (options.testFarcasterUsername) {
      console.log('🧪 Testing Farcaster username lookup...');
      const fcResult = await checkBankrClubMembership(options.testFarcasterUsername);
      testResults.tests.push({
        test: 'Farcaster Username Lookup',
        username: options.testFarcasterUsername,
        result: fcResult
      });
    }

    // Test 2: Valid X username (if provided)  
    if (options.testXUsername) {
      console.log('🧪 Testing X username lookup...');
      const xResult = await lookupUserByXUsername(options.testXUsername);
      testResults.tests.push({
        test: 'X Username Lookup',
        username: options.testXUsername,
        result: xResult
      });
    }

    // Test 3: Invalid username
    console.log('🧪 Testing invalid username...');
    const invalidResult = await checkBankrClubMembership('this-username-should-not-exist-12345');
    testResults.tests.push({
      test: 'Invalid Username',
      username: 'this-username-should-not-exist-12345',
      result: invalidResult
    });

    testResults.success = true;
    testResults.finalRateLimitStatus = getRateLimitStatus();

  } catch (error) {
    testResults.success = false;
    testResults.error = error.message;
    testResults.finalRateLimitStatus = getRateLimitStatus();
  }

  return testResults;
} 