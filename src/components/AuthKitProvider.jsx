'use client';

import { AuthKitProvider as FarcasterAuthKitProvider } from '@farcaster/auth-kit';

/**
 * AuthKit Provider for non-mini-app environments (desktop/mobile web)
 * This allows users to sign in with Farcaster when not in the mini app
 */
export function AuthKitProvider({ children }) {
  const config = {
    // Relay server for AuthKit (required)
    relay: 'https://relay.farcaster.xyz',
    
    // RPC URL for Optimism Mainnet (required for SIWE)
    rpcUrl: 'https://mainnet.optimism.io',
    
    // Your app's domain (for SIWE)
    domain: 'app.mintedmerch.shop',
    
    // SIWE URI (the full URL of your app)
    siweUri: 'https://app.mintedmerch.shop',
    
    // Version
    version: 'v1',
  };

  return (
    <FarcasterAuthKitProvider config={config}>
      {children}
    </FarcasterAuthKitProvider>
  );
}

