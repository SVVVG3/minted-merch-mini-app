/**
 * PHASE 2: Cryptographic User Authentication
 * 
 * Verifies JWT session tokens issued by /api/auth/session.
 * These tokens are cryptographically signed and cannot be forged.
 * 
 * Works for both:
 * - Mini App users (Quick Auth → Session JWT)
 * - Desktop users (AuthKit → Session JWT)
 */

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Get JWT secret as Uint8Array for jose library
function getJWTSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Extract and verify authenticated FID from JWT token
 * 
 * PHASE 2 IMPLEMENTATION:
 * Verifies JWT session token from Authorization header.
 * Token is cryptographically signed and contains verified FID.
 * 
 * For backward compatibility during migration, also checks legacy X-User-FID header.
 */
export async function getAuthenticatedFid(request) {
  try {
    // Primary: Check for JWT in Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const secret = getJWTSecret();
        const { payload } = await jwtVerify(token, secret, {
          issuer: 'mintedmerch'
        });
        
        if (payload.fid && typeof payload.fid === 'number') {
          console.log(`✅ Authenticated FID from JWT: ${payload.fid}`);
          return payload.fid;
        }
      } catch (error) {
        console.warn('⚠️ JWT verification failed:', error.message);
        // Fall through to legacy methods
      }
    }

    // LEGACY SUPPORT (Phase 1 - will be removed after migration)
    // Check for FID in custom header (sent by Phase 1 frontend)
    const fidHeader = request.headers.get('x-user-fid');
    if (fidHeader) {
      const fid = parseInt(fidHeader);
      if (!isNaN(fid) && fid > 0) {
        console.log(`⚠️ Authenticated FID from legacy header: ${fid} (update client to use JWT)`);
        return fid;
      }
    }

    // Check for FID in cookie (session-based)
    const cookies = request.cookies;
    const fidCookie = cookies.get('user_fid');
    if (fidCookie && fidCookie.value) {
      const fid = parseInt(fidCookie.value);
      if (!isNaN(fid) && fid > 0) {
        console.log(`⚠️ Authenticated FID from cookie: ${fid} (update client to use JWT)`);
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

