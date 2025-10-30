'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to detect and auto-connect dGEN1 wallet
 * dGEN1 is an Android device with built-in Ethereum wallet
 * 
 * NOTE: This hook does NOT use Wagmi hooks to avoid WagmiProvider dependency issues
 * It detects dGEN1 and connects directly via window.ethereum
 */
export function useDgenWallet() {
  const [isDgen, setIsDgen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Client-side only rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Don't run until mounted (client-side)
    if (!mounted) return;

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

          // Auto-request accounts to connect wallet
          // This is similar to what Wagmi does but without needing WagmiProvider
          try {
            console.log('🔌 Auto-connecting to dGEN1 wallet...');
            const accounts = await window.ethereum.request({ 
              method: 'eth_requestAccounts' 
            });
            
            if (accounts && accounts.length > 0) {
              console.log('✅ Successfully connected to dGEN1 wallet:', accounts[0]);
              // Wagmi will automatically detect this connection
            }
          } catch (error) {
            console.error('❌ Failed to auto-connect dGEN1 wallet:', error);
            // User may have denied connection, that's ok
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
  }, [mounted]);

  return {
    isDgen,
    isChecking,
  };
}

