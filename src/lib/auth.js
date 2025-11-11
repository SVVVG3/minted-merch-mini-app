import { supabase } from './supabase';
import { jwtVerify } from 'jose';

/**
 * Verify a Farcaster session JWT token
 * Returns { authenticated: true, fid: number } if valid
 * Returns { authenticated: false, error: string } if invalid
 */
export async function verifyFarcasterUser(token) {
  if (!token) {
    return { authenticated: false, error: 'No token provided' };
  }
  
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('❌ JWT_SECRET not configured');
      return { authenticated: false, error: 'Server configuration error' };
    }
    
    const secretKey = new TextEncoder().encode(secret);
    
    // Verify the JWT signature and extract payload
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: 'mintedmerch',
      algorithms: ['HS256']
    });
    
    // Check if token has expired
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      console.warn('❌ JWT verification failed: token expired');
      return { authenticated: false, error: 'Token expired' };
    }
    
    // Extract FID from token
    const fid = payload.fid || (payload.sub ? parseInt(payload.sub) : null);
    
    if (!fid) {
      console.error('❌ JWT verification failed: no FID in token');
      return { authenticated: false, error: 'Invalid token: no FID' };
    }
    
    return {
      authenticated: true,
      fid: fid,
      username: payload.username || null
    };
    
  } catch (error) {
    console.error('❌ JWT verification failed:', error.message);
    
    if (error.code === 'ERR_JWT_EXPIRED') {
      return { authenticated: false, error: 'Token expired' };
    }
    if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      return { authenticated: false, error: 'Invalid signature' };
    }
    if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      return { authenticated: false, error: 'Invalid token claims' };
    }
    
    return { authenticated: false, error: `Token verification failed: ${error.message}` };
  }
}

/**
 * Set user context for RLS policies - SECURITY CRITICAL
 * Call this before any Supabase query that should be user-scoped
 */
export async function setUserContext(fid) {
  if (!fid) {
    throw new Error('FID is required for user context');
  }
  
  console.log(`🔒 Setting user context for FID: ${fid}`);
  
  await supabase.rpc('set_config', {
    parameter: 'app.user_fid', 
    value: fid.toString()
  });
}

/**
 * Set system admin context for operations that need access to multiple users' data
 * Use ONLY for legitimate admin/debug/system operations like:
 * - Debug endpoints (getAllProfiles)
 * - Discount validation across users
 * - System maintenance operations
 */
export async function setSystemContext() {
  console.log(`🔧 Setting system admin context for multi-user operations`);
  
  // Set system_admin context to match RLS policy
  await supabase.rpc('set_config', {
    parameter: 'app.user_fid', 
    value: 'system_admin'
  });
} 