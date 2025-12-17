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
 * Check if mogul has exceeded rate limit for submissions
 * Uses ambassador_fid instead of ambassador_id for moguls
 * @param {number} fid - Mogul's FID
 * @param {number} maxAttempts - Maximum attempts allowed in time window (default: 20)
 * @param {number} windowMinutes - Time window in minutes (default: 60)
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: Date}>}
 */
export async function checkMogulSubmissionRateLimit(fid, maxAttempts = 20, windowMinutes = 60) {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    // Count submissions by FID in the time window
    const { count, error } = await supabaseAdmin
      .from('bounty_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('ambassador_fid', fid)
      .is('ambassador_id', null) // Only count mogul submissions (not ambassador submissions)
      .gte('submitted_at', windowStart.toISOString());

    if (error) {
      console.error('❌ Error checking mogul rate limit:', error);
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

    console.log(`🚦 Rate limit check for mogul FID ${fid}:`, {
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
    console.error('❌ Error in checkMogulSubmissionRateLimit:', error);
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

// In-memory rate limiter for IP-based limits (simple implementation)
// For production: Use Redis or Cloudflare rate limiting
const rateLimitStore = new Map();

/**
 * Simple IP-based rate limiter using in-memory storage
 * @param {string} ip - IP address
 * @param {string} endpoint - Endpoint identifier
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMinutes - Time window in minutes
 * @returns {{allowed: boolean, remaining: number, resetAt: Date}}
 */
export function checkIPRateLimit(ip, endpoint, maxRequests = 30, windowMinutes = 1) {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetAt) {
    // Create new window
    entry = {
      count: 1,
      resetAt: now + windowMs
    };
    rateLimitStore.set(key, entry);
    
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(entry.resetAt)
    };
  }
  
  // Increment count
  entry.count++;
  
  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);
  
  console.log(`🚦 IP Rate limit check for ${ip} on ${endpoint}:`, {
    count: entry.count,
    maxRequests,
    remaining,
    allowed
  });
  
  return {
    allowed,
    remaining,
    resetAt: new Date(entry.resetAt)
  };
}

// Cleanup old entries periodically (run every hour)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // 1 hour

// ============================================
// Rate Limit Presets and Helpers
// ============================================

/**
 * Rate limit presets for different use cases
 */
export const RATE_LIMITS = {
  // Standard: 60 requests per minute
  STANDARD: { maxRequests: 60, windowMinutes: 1 },
  // Strict: 10 requests per minute
  STRICT: { maxRequests: 10, windowMinutes: 1 },
  // Ultra strict: 5 requests per minute (for sensitive operations like gift cards)
  ULTRA_STRICT: { maxRequests: 5, windowMinutes: 1 },
  // Lenient: 120 requests per minute
  LENIENT: { maxRequests: 120, windowMinutes: 1 }
};

/**
 * Get client IP from request headers
 * Works with Vercel, Cloudflare, and standard proxies
 * @param {Request} request - The incoming request
 * @returns {string} - Client IP address or 'unknown'
 */
export function getClientIp(request) {
  // Vercel
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Standard proxy
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }
  
  return 'unknown';
}

/**
 * Simple rate limiter using in-memory storage
 * @param {string} identifier - Unique identifier (IP, user ID, etc.)
 * @param {object} limits - Rate limit config { maxRequests, windowMinutes }
 * @returns {{allowed: boolean, remaining: number, resetAt: Date}}
 */
export function rateLimit(identifier, limits = RATE_LIMITS.STANDARD) {
  const { maxRequests, windowMinutes } = limits;
  return checkIPRateLimit(identifier, 'generic', maxRequests, windowMinutes);
}

/**
 * Generate a rate limit exceeded response
 * @param {string} message - Error message
 * @param {object} rateLimitResult - Result from rateLimit()
 * @returns {Response} - JSON response with 429 status
 */
export function rateLimitResponse(message, rateLimitResult) {
  const { NextResponse } = require('next/server');
  return NextResponse.json({
    success: false,
    error: message,
    retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
  }, { 
    status: 429,
    headers: {
      'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString()
    }
  });
}
