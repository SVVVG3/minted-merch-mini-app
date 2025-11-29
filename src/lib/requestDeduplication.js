// Request deduplication system to prevent concurrent API calls
// This prevents multiple components from making the same API call simultaneously

const pendingRequests = new Map();
const requestResults = new Map();

/**
 * Deduplicate requests by key - if same request is in progress, wait for it
 * @param {string} key - Unique key for the request (e.g., "token-balance-466111")
 * @param {Function} requestFn - Function that makes the actual request
 * @param {number} cacheTtl - How long to cache the result (ms), default 30s
 * @returns {Promise} The result of the request
 */
export async function deduplicateRequest(key, requestFn, cacheTtl = 30000) {
  // Check if we have a cached result
  const cachedResult = requestResults.get(key);
  if (cachedResult && Date.now() - cachedResult.timestamp < cacheTtl) {
    return cachedResult.data;
  }
  
  // Check if request is already in progress
  if (pendingRequests.has(key)) {
    return await pendingRequests.get(key);
  }
  
  // Make the request and store the promise
  const requestPromise = (async () => {
    try {
      const result = await requestFn();
      
      // Cache the result
      requestResults.set(key, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error(`Request failed for ${key}:`, error);
      throw error;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(key);
    }
  })();
  
  // Store the promise so other requests can wait for it
  pendingRequests.set(key, requestPromise);
  
  return await requestPromise;
}

/**
 * Clear cached result for a specific key (useful when we know data has changed)
 * @param {string} key - The key to clear from cache
 */
export function clearCachedResult(key) {
  requestResults.delete(key);
  pendingRequests.delete(key);
}

/**
 * Clear all cached results (useful for testing)
 */
export function clearAllCachedResults() {
  requestResults.clear();
  pendingRequests.clear();
}