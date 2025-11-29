'use client';

import { AuthKitProvider as FarcasterAuthKitProvider } from '@farcaster/auth-kit';

/**
 * AuthKit Provider for non-mini-app environments (desktop/mobile web)
 * This allows users to sign in with Farcaster when not in the mini app
 */
export function AuthKitProvider({ children }) {
  // Use production domain always for consistency (especially important for PWAs)
  // PWAs running from dGEN1 or other stores need a stable domain/siweUri
  const PRODUCTION_DOMAIN = 'app.mintedmerch.shop';
  const PRODUCTION_URL = `https://${PRODUCTION_DOMAIN}`;
  
  // Detect if we're in development
  const isDevelopment = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // Use localhost for development, production domain for everything else (including PWAs)
  const domain = isDevelopment ? window.location.host : PRODUCTION_DOMAIN;
  const fullUrl = isDevelopment ? `${window.location.protocol}//${window.location.host}` : PRODUCTION_URL;

  const config = {
    // Relay server for AuthKit (required)
    relay: 'https://relay.farcaster.xyz',
    
    // RPC URL for Optimism Mainnet (required for SIWE)
    rpcUrl: 'https://mainnet.optimism.io',
    
    // Your app's domain (for SIWE) - use consistent production domain
    domain: domain,
    
    // SIWE URI (the full URL of your app) - use consistent production URL
    siweUri: fullUrl,
    
    // Optional: API endpoint to verify the signature
    // siweVerifyUrl: `${fullUrl}/api/auth/verify`,
    
    // Version
    version: 'v1',
  };

  return (
    <FarcasterAuthKitProvider config={config}>
      {children}
    </FarcasterAuthKitProvider>
  );
}

