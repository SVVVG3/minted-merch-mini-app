'use client';

import { AuthKitProvider as FarcasterAuthKitProvider } from '@farcaster/auth-kit';

/**
 * AuthKit Provider for non-mini-app environments (desktop/mobile web)
 * This allows users to sign in with Farcaster when not in the mini app
 */
export function AuthKitProvider({ children }) {
  // Get the current domain dynamically
  const domain = typeof window !== 'undefined' ? window.location.host : 'app.mintedmerch.shop';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const fullUrl = `${protocol}//${domain}`;

  const config = {
    // Relay server for AuthKit (required)
    relay: 'https://relay.farcaster.xyz',
    
    // RPC URL for Optimism Mainnet (required for SIWE)
    rpcUrl: 'https://mainnet.optimism.io',
    
    // Your app's domain (for SIWE) - use current domain
    domain: domain,
    
    // SIWE URI (the full URL of your app)
    siweUri: fullUrl,
    
    // Optional: API endpoint to verify the signature
    // siweVerifyUrl: `${fullUrl}/api/auth/verify`,
    
    // Version
    version: 'v1',
  };

  console.log('AuthKit config:', config);

  return (
    <FarcasterAuthKitProvider config={config}>
      {children}
    </FarcasterAuthKitProvider>
  );
}

