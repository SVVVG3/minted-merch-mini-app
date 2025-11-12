// Rate Limiting Helper Functions
// Protects against spam and abuse

import { supabaseAdmin } from './supabase';

/**
 * Check if ambassador has exceeded rate limit for submissions
 * @param {string} ambassadorId - Ambassador UUID
 * @param {number} maxAttempts - Maximum attempts allowed in time window (default: 10)
 * @param {number} windowMinutes - Time window in minutes (default: 60)
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: Date}>}
 */
export async function checkSubmissionRateLimit(ambassadorId, maxAttempts = 10, windowMinutes = 60) {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    // Count submissions in the time window (all statuses - we're counting attempts)
    const { count, error } = await supabaseAdmin
      .from('bounty_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('ambassador_id', ambassadorId)
      .gte('submitted_at', windowStart.toISOString());

    if (error) {
      console.error('❌ Error checking rate limit:', error);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: maxAttempts,
        resetAt: new Date(Date.now() + windowMinutes * 60 * 1000)
      };
    }

    const attempts = count || 0;
    const remaining = Math.max(0, maxAttempts - attempts);
    const allowed = attempts < maxAttempts;

    // Calculate reset time (end of current window)
    const resetAt = new Date(Date.now() + windowMinutes * 60 * 1000);

    console.log(`🚦 Rate limit check for ambassador ${ambassadorId}:`, {
      attempts,
      maxAttempts,
      remaining,
      allowed,
      windowMinutes
    });

    return {
      allowed,
      remaining,
      resetAt,
      attempts
    };

  } catch (error) {
    console.error('❌ Error in checkSubmissionRateLimit:', error);
    // Fail open on errors
    return {
      allowed: true,
      remaining: maxAttempts,
      resetAt: new Date(Date.now() + windowMinutes * 60 * 1000)
    };
  }
}

/**
 * Generic rate limiter for any action
 * Can be extended for other endpoints in the future
 * @param {string} key - Unique identifier (e.g., `ambassador:${ambassadorId}:action`)
 * @param {number} maxAttempts - Maximum attempts
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
export async function checkRateLimit(key, maxAttempts, windowSeconds) {
  // Future enhancement: Use Redis or in-memory cache for more granular rate limiting
  // For now, submission rate limiting via database is sufficient
  return {
    allowed: true,
    remaining: maxAttempts
  };
}
