'use client';

import { useEffect, useState } from 'react';
import { useConnect, useAccount } from 'wagmi';
import { useFarcaster } from '@/lib/useFarcaster';

/**
 * Bridge component to auto-connect Farcaster wallet to Wagmi
 * Uses the EIP-1193 provider from Farcaster SDK
 * Must be rendered inside WagmiProvider
 * 
 * Reference: https://eips.ethereum.org/EIPS/eip-1193
 * SDK Docs: https://miniapps.farcaster.xyz/docs/sdk/wallet
 */
function WagmiWalletConnectBridgeInner() {
  const [isMounted, setIsMounted] = useState(false);
  const { isInFarcaster, user: farcasterUser, isReady: farcasterReady } = useFarcaster();
  const { connect, connectors } = useConnect();
  const { isConnected: isWagmiConnected } = useAccount();

  // Track mounted state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-connect Farcaster wallet to wagmi using EIP-1193 provider
  useEffect(() => {
    if (!farcasterReady || !isMounted || !isInFarcaster || !farcasterUser) return;
    if (isWagmiConnected) return; // Already connected

    const autoConnect = async () => {
      try {
        // Get EIP-1193 provider from Farcaster SDK
        const { sdk } = await import('@/lib/frame');
        const provider = await sdk.wallet.getEthereumProvider();
        
        if (!provider) {
          console.warn('⚠️ No Ethereum provider available from Farcaster SDK');
          return;
        }

        console.log('🔌 Got EIP-1193 provider from Farcaster SDK');

        // Find the injected connector in wagmi
        const injectedConnector = connectors?.find(c => 
          c.id === 'injected' || 
          c.name === 'Injected' || 
          c.type === 'injected'
        );

        if (injectedConnector && typeof connect === 'function') {
          console.log('🔌 Auto-connecting Farcaster wallet to wagmi...');
          
          // Temporarily inject the provider into window for wagmi's injected connector
          const originalEthereum = window.ethereum;
          window.ethereum = provider;
          
          try {
            await connect({ connector: injectedConnector });
            console.log('✅ Farcaster wallet connected to wagmi via EIP-1193 provider');
          } finally {
            // Restore original ethereum if it existed
            if (originalEthereum) {
              window.ethereum = originalEthereum;
            }
          }
        } else {
          console.warn('⚠️ Injected connector not found in wagmi config');
        }
      } catch (error) {
        console.warn('⚠️ Could not auto-connect Farcaster wallet to wagmi:', error);
      }
    };

    autoConnect();
  }, [farcasterReady, isMounted, isInFarcaster, farcasterUser, isWagmiConnected, connect, connectors]);

  // This component doesn't render anything
  return null;
}

// Wrapper to prevent SSR rendering
export function WagmiWalletConnectBridge() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Only render after hydration (client-side only)
  if (!isHydrated) {
    return null;
  }

  return <WagmiWalletConnectBridgeInner />;
}

