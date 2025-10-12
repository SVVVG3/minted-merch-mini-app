'use client';

import { AuthKitProvider as FarcasterAuthKitProvider } from '@farcaster/auth-kit';

/**
 * AuthKit Provider for non-mini-app environments (desktop/mobile web)
 * This allows users to sign in with Farcaster when not in the mini app
 */
export function AuthKitProvider({ children }) {
  const config = {
    // Your app's domain
    domain: 'app.mintedmerch.shop',
    
    // Your app's Farcaster App ID (same as in your manifest)
    // You'll need to get this from https://warpcast.com/~/developers
    siweUri: 'https://app.mintedmerch.shop',
    
    // Relay server for AuthKit
    relay: 'https://relay.farcaster.xyz',
    
    // Redirect URL after sign-in
    rpcUrl: 'https://mainnet.optimism.io',
    
    // Version
    version: 'v1',
  };

  return (
    <FarcasterAuthKitProvider config={config}>
      {children}
    </FarcasterAuthKitProvider>
  );
}

