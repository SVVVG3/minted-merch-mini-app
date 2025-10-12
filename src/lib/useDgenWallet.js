'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';

/**
 * Hook to detect and auto-connect dGEN1 wallet
 * dGEN1 is an Android device with built-in Ethereum wallet
 */
export function useDgenWallet() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const [isDgen, setIsDgen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkForDgenWallet() {
      try {
        // Check if we're on Android
        const isAndroid = /Android/i.test(navigator.userAgent);
        
        if (!isAndroid) {
          setIsChecking(false);
          return;
        }

        // Check for dGEN1 wallet indicators
        // dGEN1 may inject its wallet as window.ethereum or a custom provider
        const hasDgenWallet = 
          // Check if ethereum provider exists
          typeof window.ethereum !== 'undefined' &&
          (
            // Check for dGEN1-specific properties
            window.ethereum.isDgen === true ||
            window.ethereum.isEthereumPhone === true ||
            // Check user agent for dGEN1
            /dGEN1/i.test(navigator.userAgent) ||
            /EthereumPhone/i.test(navigator.userAgent)
          );

        if (hasDgenWallet) {
          console.log('🤖 dGEN1 wallet detected!');
          setIsDgen(true);

          // Auto-connect to dGEN1 wallet if not already connected
          if (!isConnected) {
            console.log('🔌 Auto-connecting to dGEN1 wallet...');
            
            // Try to find injected connector (dGEN1 wallet)
            const injectedConnector = connectors.find(
              (c) => c.type === 'injected' || c.name.toLowerCase().includes('injected')
            );

            if (injectedConnector) {
              try {
                await connect({ connector: injectedConnector });
                console.log('✅ Successfully connected to dGEN1 wallet');
              } catch (error) {
                console.error('❌ Failed to auto-connect dGEN1 wallet:', error);
              }
            }
          }
        } else {
          console.log('ℹ️ Not a dGEN1 device');
        }
      } catch (error) {
        console.error('Error checking for dGEN1 wallet:', error);
      } finally {
        setIsChecking(false);
      }
    }

    checkForDgenWallet();
  }, [isConnected, connect, connectors]);

  return {
    isDgen,
    isChecking,
  };
}

