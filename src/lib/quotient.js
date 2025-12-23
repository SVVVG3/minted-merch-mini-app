/**
 * Quotient Social API utilities
 * Fetches reputation/quality scores for Farcaster users
 * 
 * API Host: https://api.quotient.social
 * Docs: Quotient Score is a PageRank-based algorithm measuring momentum and relevance
 * 
 * Score Tiers:
 * - <0.5: Inactive (bots, farmers, inactive users)
 * - 0.5-0.6: Casual (occasional users, low engagement)
 * - 0.6-0.75: Active (regular contributors, solid engagement)
 * - 0.75-0.8: Influential (high-quality content, strong network)
 * - 0.8-0.89: Elite (top-tier creators, community leaders)
 * - 0.9+: Exceptional (platform superstars, maximum influence)
 */

const QUOTIENT_API_URL = 'https://api.quotient.social/v1/user-reputation';
const QUOTIENT_API_KEY = process.env.QUOTIENT_API_KEY;

/**
 * Get the quality tier label for a Quotient score
 * @param {number} score - Quotient score (0-1)
 * @returns {string} Tier label
 */
export function getQuotientTier(score) {
  if (score === null || score === undefined) return 'Unknown';
  if (score < 0.5) return 'Inactive';
  if (score < 0.6) return 'Casual';
  if (score < 0.75) return 'Active';
  if (score < 0.8) return 'Influential';
  if (score < 0.9) return 'Elite';
  return 'Exceptional';
}

/**
 * Get the color for a Quotient score tier
 * @param {number} score - Quotient score (0-1)
 * @returns {string} Tailwind color class
 */
export function getQuotientColor(score) {
  if (score === null || score === undefined) return 'text-gray-400';
  if (score < 0.5) return 'text-red-500';
  if (score < 0.6) return 'text-orange-500';
  if (score < 0.75) return 'text-yellow-500';
  if (score < 0.8) return 'text-green-500';
  if (score < 0.9) return 'text-blue-500';
  return 'text-purple-500';
}

/**
 * Fetch Quotient scores for one or more FIDs
 * @param {number|number[]} fids - Single FID or array of FIDs (max 1000)
 * @returns {Promise<Object|null>} Quotient data or null if unavailable
 */
export async function fetchQuotientScore(fids) {
  if (!QUOTIENT_API_KEY) {
    console.log('⚠️ Quotient API key not configured');
    return null;
  }

  // Normalize to array
  const fidArray = Array.isArray(fids) ? fids : [fids];
  
  if (fidArray.length === 0) {
    console.log('⚠️ No FIDs provided for Quotient lookup');
    return null;
  }

  if (fidArray.length > 1000) {
    console.log('⚠️ Too many FIDs for Quotient lookup (max 1000)');
    return null;
  }

  try {
    console.log(`🔍 Fetching Quotient scores for ${fidArray.length} FID(s):`, fidArray.slice(0, 5));

    const response = await fetch(QUOTIENT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fids: fidArray,
        api_key: QUOTIENT_API_KEY,
      }),
    });

    if (!response.ok) {
      console.error('❌ Quotient API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    
    console.log(`✅ Quotient API returned ${data.count} user(s)`);

    // If single FID requested, return just that user's data
    if (!Array.isArray(fids) && data.data?.length > 0) {
      const userData = data.data[0];
      console.log(`📊 Quotient score for FID ${fids}:`, {
        score: userData.quotientScore,
        rank: userData.quotientRank,
        tier: getQuotientTier(userData.quotientScore),
      });
      return userData;
    }

    // Return full response for batch requests
    return data;
  } catch (error) {
    console.error('❌ Error fetching Quotient score:', error);
    return null;
  }
}

/**
 * Extract just the normalized Quotient score from API response
 * @param {number} fid - Farcaster ID
 * @returns {Promise<number|null>} Quotient score (0-1) or null
 */
export async function getQuotientScoreForFid(fid) {
  const data = await fetchQuotientScore(fid);
  return data?.quotientScore ?? null;
}

