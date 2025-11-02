import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySignInMessage } from '@farcaster/auth-client';

/**
 * PHASE 2: Unified Session Token Endpoint
 * 
 * This endpoint verifies Farcaster authentication and issues session JWTs.
 * Works for both:
 * - Mini App users (Quick Auth)
 * - Desktop users (AuthKit)
 * 
 * Once a user has a session JWT, they use it for all API requests.
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
 * SECURITY NOTE: This implementation verifies the JWT structure and expiry,
 * but does not yet verify the cryptographic signature from Farcaster.
 * 
 * TODO: Implement full signature verification using Farcaster's public key
 * from their JWKS endpoint: https://keys.farcaster.xyz/.well-known/jwks.json
 */
async function verifyFarcasterQuickAuth(token) {
  try {
    console.log('🔍 verifyFarcasterQuickAuth: Starting verification...');
    
    const parts = token.split('.');
    console.log('🔍 JWT parts count:', parts.length);
    
    if (parts.length !== 3) {
      console.error('❌ Invalid JWT format: expected 3 parts, got', parts.length);
      return { valid: false, error: 'Invalid JWT format' };
    }
    
    // Decode header to check algorithm
    const header = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString('utf-8')
    );
    console.log('🔍 JWT header:', header);
    
    if (!header.alg || !['RS256', 'ES256'].includes(header.alg)) {
      console.error('❌ Unsupported algorithm:', header.alg);
      return { valid: false, error: `Unsupported JWT algorithm: ${header.alg}` };
    }
    
    // Decode payload
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    console.log('🔍 JWT payload:', {
      fid: payload.fid,
      username: payload.username,
      iss: payload.iss,
      exp: payload.exp,
      expDate: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'none',
      now: new Date().toISOString()
    });
    
    // Verify required claims
    if (!payload.fid) {
      console.error('❌ No FID in token payload');
      return { valid: false, error: 'No FID in token' };
    }
    
    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      console.error('❌ Token expired. Exp:', new Date(payload.exp * 1000).toISOString(), 'Now:', new Date().toISOString());
      return { valid: false, error: 'Token expired' };
    }
    
    // Check issuer (should be from Farcaster)
    if (payload.iss && !payload.iss.includes('farcaster')) {
      console.warn('⚠️ Quick Auth token from unexpected issuer:', payload.iss);
    }
    
    console.log('⚠️ Quick Auth token structure verified (signature NOT verified)');
    console.log('⚠️ This is a security risk - implement full cryptographic verification');
    
    return {
      valid: true,
      fid: payload.fid,
      username: payload.username || null,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      warning: 'Signature not verified - structural validation only'
    };
  } catch (error) {
    console.error('❌ Error verifying Farcaster Quick Auth token:', error);
    console.error('❌ Error stack:', error.stack);
    return { valid: false, error: error.message };
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
 * Request body (from Mini App - Quick Auth):
 * {
 *   "farcasterToken": "eyJhbGc..." // JWT from Quick Auth
 * }
 * 
 * Request body (from Desktop - AuthKit):
 * {
 *   "fid": 466111,
 *   "username": "svvvg3.eth",
 *   "authKitSession": true
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
      
      console.log('✅ Quick Auth verified for FID:', fid, '(warning: signature not cryptographically verified yet)');
    }
    // Path 3: INSECURE fallback (WILL BE REMOVED)
    else if (body.fid || body.authKitSession) {
      console.warn('⚠️ INSECURE: Legacy session creation without signature verification');
      console.warn('⚠️ This path is deprecated and will be removed');
      
      // TEMPORARY: Still allow for migration period, but log warning
      fid = body.fid;
      username = body.username || null;
      
      console.log('⚠️ Legacy session for FID:', fid, '(NO SIGNATURE VERIFICATION)');
    }
    else {
      return NextResponse.json({
        success: false,
        error: 'Missing authentication data',
        details: 'Provide either authKitData (Desktop) or farcasterToken (Mini App)'
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

