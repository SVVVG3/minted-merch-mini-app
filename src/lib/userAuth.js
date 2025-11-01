/**
 * EMERGENCY SECURITY FIX: User Authentication
 * 
 * This is a temporary authentication system to stop critical PII leaks.
 * It will be replaced with proper Farcaster Frame authentication in Phase 2.
 * 
 * For now, we require that requests to sensitive endpoints include:
 * 1. A valid session FID (stored in cookie/header)
 * 2. The FID matches the requested resource
 */

import { NextResponse } from 'next/server';

/**
 * Extract authenticated FID from request
 * 
 * TEMPORARY IMPLEMENTATION:
 * For emergency fix, we check for FID in multiple locations:
 * 1. X-User-FID header (sent by frontend)
 * 2. Cookie-based session
 * 
 * NOTE: This is NOT cryptographically secure authentication.
 * It stops casual curl exploits but not determined attackers.
 * Will be replaced with Farcaster Frame signatures in Phase 2.
 */
export function getAuthenticatedFid(request) {
  try {
    // Check for FID in custom header (sent by our frontend)
    const fidHeader = request.headers.get('x-user-fid');
    if (fidHeader) {
      const fid = parseInt(fidHeader);
      if (!isNaN(fid) && fid > 0) {
        console.log(`✅ Authenticated FID from header: ${fid}`);
        return fid;
      }
    }

    // Check for FID in cookie (session-based)
    const cookies = request.cookies;
    const fidCookie = cookies.get('user_fid');
    if (fidCookie && fidCookie.value) {
      const fid = parseInt(fidCookie.value);
      if (!isNaN(fid) && fid > 0) {
        console.log(`✅ Authenticated FID from cookie: ${fid}`);
        return fid;
      }
    }

    console.log('❌ No authenticated FID found in request');
    return null;
  } catch (error) {
    console.error('❌ Error extracting authenticated FID:', error);
    return null;
  }
}

/**
 * Verify that authenticated FID matches requested FID
 * Returns error response if mismatch, null if OK
 */
export function requireOwnFid(authenticatedFid, requestedFid) {
  const requested = parseInt(requestedFid);
  
  if (!authenticatedFid) {
    console.warn(`🚫 Authentication required - no authenticated FID`);
    return NextResponse.json(
      { 
        error: 'Authentication required',
        message: 'You must be signed in to access this resource',
        code: 'AUTH_REQUIRED'
      },
      { status: 401 }
    );
  }

  if (authenticatedFid !== requested) {
    console.warn(`🚫 Authorization failed - FID ${authenticatedFid} attempted to access FID ${requested}`);
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'You can only access your own data',
        code: 'FID_MISMATCH'
      },
      { status: 403 }
    );
  }

  // Success - authenticated FID matches requested FID
  return null;
}

/**
 * Middleware wrapper for protecting API routes (emergency version)
 * 
 * Usage:
 *   export const GET = requireUserAuth(async function(request) { ... });
 */
export function requireUserAuth(handler) {
  return async function(request, ...args) {
    const authenticatedFid = getAuthenticatedFid(request);
    
    if (!authenticatedFid) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'You must be signed in to access this endpoint',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }

    // Attach authenticated FID to request for use in handler
    request.authenticatedFid = authenticatedFid;

    return handler(request, ...args);
  };
}

