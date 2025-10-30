/**
 * Simple in-memory rate limiter for API endpoints
 * 
 * For production scale, consider upgrading to:
 * - Vercel Edge Config
 * - Upstash Redis
 * - Redis Cloud
 * 
 * This implementation uses an in-memory Map that resets on server restart,
 * which is acceptable for Vercel's serverless functions where each invocation
 * is isolated and rate limits are per-instance.
 */

const rateLimitStore = new Map();

/**
 * Clean up old entries to prevent memory leaks
 * Called periodically by the rate limiter
 */
function cleanupOldEntries() {
  const now = Date.now();
  const oneHourAgo = now - 3600000; // 1 hour
  
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetTime < oneHourAgo) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Rate limit an identifier (IP address, user ID, etc.)
 * 
 * @param {string} identifier - Unique identifier (IP, user ID, etc.)
 * @param {Object} options - Rate limit options
 * @param {number} options.maxRequests - Maximum requests allowed in window
 * @param {number} options.windowMs - Time window in milliseconds
 * @returns {Object} - { allowed: boolean, remaining: number, resetTime: number }
 */
export function rateLimit(identifier, { maxRequests = 10, windowMs = 60000 } = {}) {
  const now = Date.now();
  const key = identifier;
  
  // Periodically cleanup (every 100 checks)
  if (Math.random() < 0.01) {
    cleanupOldEntries();
  }
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  
  // Reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
      firstRequest: now
    };
    rateLimitStore.set(key, entry);
  }
  
  // Increment request count
  entry.count++;
  
  // Check if rate limit exceeded
  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
    retryAfter: Math.ceil((entry.resetTime - now) / 1000) // seconds until reset
  };
}

/**
 * Get client IP address from request headers
 * Works with Vercel's proxy headers
 * 
 * @param {Request} request - Next.js request object
 * @returns {string} - Client IP address
 */
export function getClientIp(request) {
  // Try Vercel's forwarded headers first
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  // Fallback to other common headers
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  
  // Last resort: use a placeholder
  return 'unknown';
}

/**
 * Create a rate limit response
 * 
 * @param {string} message - Error message
 * @param {Object} rateLimitInfo - Rate limit info from rateLimit()
 * @returns {Response} - Next.js Response object with rate limit headers
 */
export function rateLimitResponse(message, rateLimitInfo) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      retryAfter: rateLimitInfo.retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitInfo.remaining + 1),
        'X-RateLimit-Remaining': String(rateLimitInfo.remaining),
        'X-RateLimit-Reset': String(Math.floor(rateLimitInfo.resetTime / 1000)),
        'Retry-After': String(rateLimitInfo.retryAfter)
      }
    }
  );
}

/**
 * Preset rate limit configurations for common use cases
 */
export const RATE_LIMITS = {
  // Strict: For sensitive operations like discount validation
  STRICT: {
    maxRequests: 10,
    windowMs: 60000 // 10 requests per minute
  },
  
  // Moderate: For general API endpoints
  MODERATE: {
    maxRequests: 30,
    windowMs: 60000 // 30 requests per minute
  },
  
  // Generous: For public endpoints
  GENEROUS: {
    maxRequests: 100,
    windowMs: 60000 // 100 requests per minute
  },
  
  // Ultra-strict: For gift card validation
  ULTRA_STRICT: {
    maxRequests: 5,
    windowMs: 60000 // 5 requests per minute
  }
};

