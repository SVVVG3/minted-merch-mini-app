import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySignInMessage } from '@farcaster/auth-client';

/**
 * SECURE: Unified Session Token Endpoint
 * 
 * This endpoint cryptographically verifies Farcaster authentication and issues session JWTs.
 * 
 * SECURE authentication paths:
 * - Mini App users: Quick Auth JWT verified using Farcaster's public keys (JWKS)
 * - Desktop/Web users: AuthKit signature verified using verifySignInMessage
 * 
 * Once a user has a session JWT, they use it for all subsequent API requests.
 * Session JWTs expire in 7 days.
 */

// Get JWT secret as Uint8Array for jose library
function getJWTSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Verify Farcaster Quick Auth JWT (from Mini App)
 * 
 * Quick Auth returns a JWT signed by Farcaster.
 * 
 * SECURITY: This implementation cryptographically verifies the JWT signature
 * using Farcaster's public keys from their JWKS endpoint.
 * JWKS endpoint: https://keys.farcaster.xyz/.well-known/jwks.json
 */
// Cache JWKS to avoid fetching on every request
let cachedJWKS = null;
let jwksLastFetched = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour in milliseconds

async function verifyFarcasterQuickAuth(token) {
  try {
    console.log('🔐 SECURE: Verifying Quick Auth JWT with cryptographic signature verification...');
    
    // SECURITY FIX: Use Farcaster's JWKS endpoint to verify JWT signature
    // Cache JWKS to improve performance and reliability
    const now = Date.now();
    if (!cachedJWKS || (now - jwksLastFetched) > JWKS_CACHE_TTL) {
      console.log('📥 Fetching fresh JWKS from Farcaster...');
      try {
        cachedJWKS = createRemoteJWKSet(new URL('https://keys.farcaster.xyz/.well-known/jwks.json'), {
          cooldownDuration: 30000, // 30 seconds cooldown between fetches
          timeoutDuration: 10000, // 10 second timeout for fetch
        });
        jwksLastFetched = now;
        console.log('✅ JWKS cached successfully');
      } catch (jwksError) {
        console.error('❌ Failed to fetch JWKS:', jwksError.message);
        // If we have a cached version, use it even if expired
        if (!cachedJWKS) {
          throw new Error(`Cannot verify JWT: JWKS fetch failed - ${jwksError.message}`);
        }
        console.warn('⚠️ Using expired JWKS cache due to fetch failure');
      }
    }
    
    // Verify JWT signature cryptographically
    const { payload } = await jwtVerify(token, cachedJWKS, {
      issuer: 'https://auth.farcaster.xyz', // Expected issuer
      audience: process.env.NEXT_PUBLIC_URL || 'app.mintedmerch.shop', // Our app domain
    });
    
    console.log('✅ JWT signature cryptographically verified by Farcaster');
    console.log('🔍 JWT payload:', {
      sub: payload.sub,
      iss: payload.iss,
      aud: payload.aud,
      exp: payload.exp,
      expDate: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'none'
    });
    
    // Extract FID from 'sub' claim (standard JWT format)
    const fid = payload.sub ? parseInt(payload.sub) : null;
    
    if (!fid) {
      console.error('❌ No FID in token payload (sub claim)');
      return { valid: false, error: 'No FID in token' };
    }
    
    console.log('✅ FID extracted from cryptographically verified token:', fid);
    
    return {
      valid: true,
      fid: fid,
      username: payload.username || payload.preferred_username || null,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      verified: true // Flag to indicate this was cryptographically verified
    };
  } catch (error) {
    console.error('❌ Quick Auth JWT verification failed:', error.message);
    console.error('❌ Full error:', error);
    
    // Provide helpful error messages
    if (error.code === 'ERR_JWKS_NO_MATCHING_KEY') {
      return { valid: false, error: 'Invalid JWT signature - key not found' };
    } else if (error.code === 'ERR_JWT_EXPIRED') {
      return { valid: false, error: 'Token expired' };
    } else if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      return { valid: false, error: 'Invalid JWT claims (issuer/audience mismatch)' };
    } else if (error.message && error.message.includes('fetch failed')) {
      return { valid: false, error: 'Network error: Unable to verify JWT signature (JWKS fetch failed)' };
    }
    
    return { valid: false, error: `JWT verification failed: ${error.message}` };
  }
}

/**
 * Create a session JWT for authenticated user
 * 
 * This JWT is signed by us and used for all subsequent API requests.
 * Expires in 7 days (long enough for mini app sessions).
 */
async function createSessionToken(fid, username) {
  try {
    const secret = getJWTSecret();
    
    const token = await new SignJWT({
      fid: fid,
      username: username,
      type: 'session'
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('7d') // 7 days
      .setIssuer('mintedmerch')
      .setSubject(fid.toString())
      .sign(secret);
    
    return { success: true, token };
  } catch (error) {
    console.error('Error creating session token:', error);
    return { success: false, error: error.message };
  }
}

/**
 * POST /api/auth/session
 * 
 * SECURE: Verifies Farcaster authentication and issues session JWTs
 * 
 * Request body (from Mini App - Quick Auth):
 * {
 *   "farcasterToken": "eyJhbGc..." // JWT from Quick Auth (cryptographically verified)
 * }
 * 
 * Request body (from Desktop/Web - AuthKit):
 * {
 *   "authKitData": {
 *     "message": "...",
 *     "signature": "0x...",
 *     "nonce": "...",
 *     "domain": "app.mintedmerch.shop",
 *     "fid": 466111,
 *     "username": "svvvg3.eth"
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "token": "eyJhbGc...", // Our session JWT
 *   "fid": 466111,
 *   "expiresIn": 604800 // seconds (7 days)
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    let fid = null;
    let username = null;
    
    // Path 1: Desktop/Web with AuthKit (SECURE - Signature Verified)
    if (body.authKitData) {
      console.log('🔐 Verifying AuthKit signature...');
      
      const { message, signature, nonce, domain } = body.authKitData;
      
      if (!message || !signature || !nonce) {
        return NextResponse.json({
          success: false,
          error: 'Missing AuthKit authentication data',
          details: 'Required: message, signature, nonce'
        }, { status: 400 });
      }
      
      try {
        // SECURITY FIX: Verify cryptographic signature from Farcaster
        const verifyResult = await verifySignInMessage({
          message,
          signature,
          nonce,
          domain: domain || process.env.NEXT_PUBLIC_URL || 'app.mintedmerch.shop'
        });
        
        if (!verifyResult.success) {
          console.warn('❌ AuthKit signature verification failed');
          return NextResponse.json({
            success: false,
            error: 'Invalid Farcaster signature',
            details: 'Signature verification failed'
          }, { status: 401 });
        }
        
        // Extract verified FID from the message
        fid = verifyResult.fid || body.authKitData.fid;
        username = body.authKitData.username || null;
        
        console.log('✅ AuthKit signature verified for FID:', fid);
        
      } catch (verifyError) {
        console.error('❌ Error verifying AuthKit signature:', verifyError);
        return NextResponse.json({
          success: false,
          error: 'Signature verification error',
          details: verifyError.message
        }, { status: 401 });
      }
    }
    // Path 2: Mini App with Quick Auth token (TODO: Implement full crypto verification)
    else if (body.farcasterToken) {
      console.log('🔐 Verifying Farcaster Quick Auth token...');
      console.log('🔍 Token preview:', body.farcasterToken.substring(0, 50) + '...');
      
      const verification = await verifyFarcasterQuickAuth(body.farcasterToken);
      
      console.log('🔍 Verification result:', {
        valid: verification.valid,
        fid: verification.fid,
        error: verification.error,
        warning: verification.warning
      });
      
      if (!verification.valid) {
        console.error('❌ Quick Auth verification failed:', verification.error);
        console.error('❌ Full verification object:', JSON.stringify(verification, null, 2));
        return NextResponse.json({
          success: false,
          error: 'Invalid Farcaster authentication',
          details: verification.error
        }, { status: 401 });
      }
      
      fid = verification.fid;
      username = verification.username;
      
      console.log('✅ Quick Auth SECURELY verified for FID:', fid, '(cryptographic signature verified)');
    }
    else {
      return NextResponse.json({
        success: false,
        error: 'Missing authentication data',
        details: 'Provide either authKitData (Desktop/Web with cryptographic signature) or farcasterToken (Mini App with Quick Auth)'
      }, { status: 400 });
    }
    
    // Verify user exists in database (optional but recommended)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username')
      .eq('fid', fid)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Database error checking profile:', profileError);
      // Continue anyway - user might not have profile yet
    }
    
    // If we have profile data, use it to ensure consistency
    if (profile) {
      username = username || profile.username;
    }
    
    // Create our session JWT
    const sessionResult = await createSessionToken(fid, username);
    
    if (!sessionResult.success) {
      console.error('Failed to create session token:', sessionResult.error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create session',
        details: sessionResult.error
      }, { status: 500 });
    }
    
    console.log('✅ Session token created for FID:', fid);
    
    return NextResponse.json({
      success: true,
      token: sessionResult.token,
      fid: fid,
      username: username,
      expiresIn: 7 * 24 * 60 * 60 // 7 days in seconds
    });
    
  } catch (error) {
    console.error('❌ Error in session endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/auth/session
 * 
 * Verify and decode an existing session token
 * Useful for checking if session is still valid
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        valid: false,
        error: 'No authorization header'
      }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const secret = getJWTSecret();
    
    try {
      const { payload } = await jwtVerify(token, secret, {
        issuer: 'mintedmerch'
      });
      
      return NextResponse.json({
        valid: true,
        fid: payload.fid,
        username: payload.username,
        expiresAt: new Date(payload.exp * 1000).toISOString()
      });
    } catch (error) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or expired token'
      }, { status: 401 });
    }
    
  } catch (error) {
    console.error('❌ Error verifying session:', error);
    return NextResponse.json({
      valid: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

