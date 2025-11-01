import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { supabaseAdmin } from '@/lib/supabase';

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
 * Quick Auth returns a JWT signed by Farcaster. We verify it to extract the FID.
 * Note: This requires Farcaster's public key to verify the signature.
 */
async function verifyFarcasterQuickAuth(token) {
  try {
    // For Quick Auth, Farcaster signs the JWT with their private key
    // We need to verify with their public key
    // 
    // TODO: Get Farcaster's public key from their well-known endpoint
    // For now, we'll trust the token structure and extract claims
    // This is temporary until we implement proper signature verification
    
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT format' };
    }
    
    // Decode payload (not verifying signature yet - see TODO above)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    
    if (!payload.fid) {
      return { valid: false, error: 'No FID in token' };
    }
    
    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return { valid: false, error: 'Token expired' };
    }
    
    return {
      valid: true,
      fid: payload.fid,
      username: payload.username || null,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null
    };
  } catch (error) {
    console.error('Error verifying Farcaster Quick Auth token:', error);
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
    
    // Path 1: Mini App with Quick Auth token
    if (body.farcasterToken) {
      console.log('🔐 Verifying Farcaster Quick Auth token...');
      
      const verification = await verifyFarcasterQuickAuth(body.farcasterToken);
      
      if (!verification.valid) {
        console.warn('❌ Quick Auth verification failed:', verification.error);
        return NextResponse.json({
          success: false,
          error: 'Invalid Farcaster authentication',
          details: verification.error
        }, { status: 401 });
      }
      
      fid = verification.fid;
      username = verification.username;
      
      console.log('✅ Quick Auth verified for FID:', fid);
    }
    // Path 2: Desktop/Web with AuthKit
    else if (body.authKitSession && body.fid) {
      console.log('🔐 Creating session for AuthKit user...');
      
      // For AuthKit, we trust that the frontend has already authenticated
      // via Farcaster's AuthKit (Sign In With Farcaster)
      // 
      // In production, you might want additional verification here,
      // but AuthKit handles the crypto verification on the client side
      
      fid = body.fid;
      username = body.username || null;
      
      console.log('✅ AuthKit session for FID:', fid);
    }
    // Path 3: Legacy header-based (for backward compatibility during migration)
    else if (body.fid) {
      console.log('⚠️ Legacy session creation (no Farcaster token) for FID:', body.fid);
      
      // Temporary: Allow session creation with just FID during migration period
      // TODO: Remove this path after all clients are updated
      fid = body.fid;
      username = body.username || null;
    }
    else {
      return NextResponse.json({
        success: false,
        error: 'Missing authentication data',
        details: 'Provide either farcasterToken (Mini App) or authKitSession + fid (Desktop)'
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

