/**
 * Admin Authentication Middleware
 * 
 * CRITICAL SECURITY: This middleware validates JWT tokens for all admin routes.
 * 
 * Usage in API routes:
 * import { withAdminAuth } from '@/lib/adminAuth';
 * 
 * export const GET = withAdminAuth(async (request) => {
 *   // Your protected handler code
 * });
 */

import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Get JWT secret from environment
 * CRITICAL: This must be set in environment variables
 */
function getJWTSecret() {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  
  if (!secret) {
    console.error('❌ CRITICAL: JWT_SECRET environment variable is not set!');
    throw new Error('Server configuration error: JWT_SECRET not configured');
  }
  
  return secret;
}

/**
 * Generate a JWT token for admin sessions
 * @param {Object} payload - Data to encode in the token
 * @param {string} expiresIn - Token expiration time (default: 8 hours)
 * @returns {Promise<string>} JWT token
 */
export async function generateAdminToken(payload = {}, expiresIn = '8h') {
  const secret = getJWTSecret();
  const secretKey = new TextEncoder().encode(secret);
  
  // Convert expiresIn string to seconds
  const expiresInSeconds = expiresIn === '8h' ? 8 * 60 * 60 : 28800; // 8 hours default
  
  const tokenPayload = {
    ...payload,
    role: 'admin',
  };
  
  const token = await new SignJWT(tokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(secretKey);
  
  return token;
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Promise<Object|null>} Decoded token payload or null if invalid
 */
export async function verifyAdminToken(token) {
  if (!token) {
    return null;
  }
  
  try {
    const secret = getJWTSecret();
    const secretKey = new TextEncoder().encode(secret);
    
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256']
    });
    
    // Verify it's an admin token
    if (payload.role !== 'admin') {
      console.warn('⚠️ Token does not have admin role');
      return null;
    }
    
    return payload;
  } catch (error) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      console.warn('⚠️ Admin token expired');
    } else if (error.code === 'ERR_JWS_INVALID') {
      console.warn('⚠️ Invalid admin token');
    } else {
      console.error('❌ Error verifying admin token:', error);
    }
    return null;
  }
}

/**
 * Extract JWT token from request headers
 * Supports both Authorization header and custom X-Admin-Token header
 * @param {Request} request - Next.js request object
 * @returns {string|null} Token string or null
 */
function extractToken(request) {
  // Try Authorization header first (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Try custom X-Admin-Token header
  const customHeader = request.headers.get('x-admin-token');
  if (customHeader) {
    return customHeader;
  }
  
  return null;
}

/**
 * Higher-order function to wrap admin API routes with authentication
 * 
 * @param {Function} handler - The API route handler function
 * @returns {Function} Wrapped handler with authentication
 * 
 * @example
 * export const GET = withAdminAuth(async (request) => {
 *   return NextResponse.json({ data: 'protected data' });
 * });
 */
export function withAdminAuth(handler) {
  return async function authenticatedHandler(request, context) {
    try {
      // Extract token from request
      const token = extractToken(request);
      
      if (!token) {
        console.warn('⚠️ Admin API access attempt without token');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Authentication required',
            message: 'No authentication token provided'
          },
          { status: 401 }
        );
      }
      
      // Verify token (now async with jose)
      const decoded = await verifyAdminToken(token);
      
      if (!decoded) {
        console.warn('⚠️ Admin API access attempt with invalid token');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid or expired token',
            message: 'Please log in again'
          },
          { status: 401 }
        );
      }
      
      // Token is valid - attach decoded data to request for handler to use if needed
      request.adminAuth = decoded;
      
      // Call the actual handler
      return await handler(request, context);
      
    } catch (error) {
      console.error('❌ Error in admin auth middleware:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication error',
          message: 'An error occurred during authentication'
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Validate admin password (for login endpoint only)
 * @param {string} password - Password to validate
 * @returns {boolean} True if password is correct
 */
export function validateAdminPassword(password) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    console.error('❌ CRITICAL: ADMIN_PASSWORD environment variable is not set!');
    throw new Error('Server configuration error: ADMIN_PASSWORD not configured');
  }
  
  // In production, you should use bcrypt to compare hashed passwords
  // For now, direct comparison (make sure ADMIN_PASSWORD is strong)
  return password === adminPassword;
}

