'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWalletConnect } from '@/lib/useWalletConnect';
import { useFarcaster } from '@/lib/useFarcaster';

/**
 * WalletConnect Provider Context
 * Provides wallet connection functionality for desktop and mobile web users
 * while maintaining compatibility with existing mini app functionality
 */

const WalletConnectContext = createContext();

export function WalletConnectProvider({ children }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [userAddress, setUserAddress] = useState(null);
  const [connectionMethod, setConnectionMethod] = useState(null); // 'farcaster', 'walletconnect', 'base', 'ethereum'
  
  // Get Farcaster context
  const { isInFarcaster, user: farcasterUser, isReady: farcasterReady } = useFarcaster();
  
  // Get WalletConnect context
  const {
    isConnected: isWCConnected,
    isConnecting: isWCConnecting,
    isLoading: isWCLoading,
    error: wcError,
    shouldUseWC,
    isAvailable: isWCAvailable,
    connect: wcConnect,
    disconnect: wcDisconnect,
    getPrimaryAddress,
    hasAccounts: wcHasAccounts,
  } = useWalletConnect();

  // Initialize connection method detection
  useEffect(() => {
    if (!farcasterReady) return;

    const detectConnectionMethod = async () => {
      try {
        // Priority 1: Farcaster mini app
        if (isInFarcaster && farcasterUser) {
          console.log('🔗 Using Farcaster mini app connection');
          setConnectionMethod('farcaster');
          
          // Get wallet address from Farcaster SDK
          try {
            const { sdk } = await import('@/lib/frame');
            const provider = await sdk.wallet.getEthereumProvider();
            if (provider) {
              const accounts = await provider.request({ method: 'eth_accounts' });
              if (accounts && accounts.length > 0) {
                setUserAddress(accounts[0]);
                console.log('✅ Farcaster wallet address:', accounts[0]);
              }
            }
          } catch (error) {
            console.log('ℹ️ Could not get Farcaster wallet address:', error);
          }
          return;
        }

        // Priority 2: Check for existing wallet connection (window.ethereum)
        if (typeof window !== 'undefined' && window.ethereum) {
          try {
            // Check if this is an Android device with native wallet (includes dGEN1)
            const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
            const isAndroidWallet = userAgent.includes('android');
            
            if (isAndroidWallet) {
              console.log('🤖 Android device with native wallet detected - attempting auto-connection');
              // For dGEN1, try to request accounts to trigger auto-connection
              try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts && accounts.length > 0 && accounts[0] !== 'decline') {
                  console.log('✅ Android wallet auto-connected:', accounts[0]);
                  setConnectionMethod('ethereum');
                  setUserAddress(accounts[0]);
                  return;
                } else if (accounts && accounts.length > 0 && accounts[0] === 'decline') {
                  console.log('❌ Android wallet connection declined by user');
                  // Don't set connection, let it remain null
                }
              } catch (error) {
                console.log('ℹ️ Android wallet auto-connection failed, trying eth_accounts:', error);
                // Fall back to eth_accounts if eth_requestAccounts fails
                try {
                  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                  if (accounts && accounts.length > 0 && accounts[0] !== 'decline') {
                    console.log('✅ Android wallet already connected:', accounts[0]);
                    setConnectionMethod('ethereum');
                    setUserAddress(accounts[0]);
                    return;
                  } else if (accounts && accounts.length > 0 && accounts[0] === 'decline') {
                    console.log('❌ Android wallet connection declined (eth_accounts)');
                  }
                } catch (ethAccountsError) {
                  console.log('❌ Failed to get eth_accounts:', ethAccountsError);
                }
              }
            } else {
              // For other wallets, just check existing accounts
              const accounts = await window.ethereum.request({ method: 'eth_accounts' });
              if (accounts && accounts.length > 0) {
                console.log('🔗 Using existing wallet connection');
                setConnectionMethod('ethereum');
                setUserAddress(accounts[0]);
                console.log('✅ Existing wallet address:', accounts[0]);
                return;
              }
            }
          } catch (error) {
            console.log('ℹ️ Could not get existing wallet accounts:', error);
          }
        }

        // Priority 3: WalletConnect (if available and no other connection)
        if (shouldUseWC && isWCAvailable) {
          console.log('🔗 WalletConnect available for connection');
          setConnectionMethod('walletconnect');
          
          // If already connected via WalletConnect, get the address
          if (isWCConnected && wcHasAccounts) {
            const address = getPrimaryAddress();
            if (address) {
              setUserAddress(address);
              console.log('✅ WalletConnect address:', address);
            }
          }
          return;
        }

        // No connection method available
        console.log('ℹ️ No wallet connection method available');
        setConnectionMethod(null);
        
      } catch (error) {
        console.error('❌ Error detecting connection method:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    detectConnectionMethod();
  }, [farcasterReady, isInFarcaster, farcasterUser, shouldUseWC, isWCAvailable, isWCConnected, wcHasAccounts, getPrimaryAddress]);

  // Handle WalletConnect connection changes
  useEffect(() => {
    if (connectionMethod === 'walletconnect' && isWCConnected && wcHasAccounts) {
      const address = getPrimaryAddress();
      if (address && address !== userAddress) {
        setUserAddress(address);
        console.log('✅ WalletConnect address updated:', address);
      }
    } else if (connectionMethod === 'walletconnect' && !isWCConnected) {
      setUserAddress(null);
    }
  }, [connectionMethod, isWCConnected, wcHasAccounts, getPrimaryAddress, userAddress]);

  // Connect wallet function
  const connectWallet = async () => {
    try {
      if (connectionMethod === 'walletconnect') {
        await wcConnect();
      } else if (typeof window !== 'undefined' && window.ethereum) {
        // Connect to existing wallet
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        if (accounts && accounts.length > 0) {
          setUserAddress(accounts[0]);
          setConnectionMethod('ethereum');
        }
      } else {
        throw new Error('No wallet connection method available');
      }
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      throw error;
    }
  };

  // Disconnect wallet function
  const disconnectWallet = async () => {
    try {
      if (connectionMethod === 'walletconnect') {
        await wcDisconnect();
      }
      
      setUserAddress(null);
      setConnectionMethod(null);
    } catch (error) {
      console.error('❌ Failed to disconnect wallet:', error);
      throw error;
    }
  };

  // Get wallet provider for transactions
  const getWalletProvider = async () => {
    if (connectionMethod === 'farcaster' && isInFarcaster) {
      const { sdk } = await import('@/lib/frame');
      return await sdk.wallet.getEthereumProvider();
    } else if (connectionMethod === 'ethereum' && window.ethereum) {
      return window.ethereum;
    } else if (connectionMethod === 'walletconnect') {
      // Get WalletConnect provider directly from the walletConnect module
      const { getWalletProvider: getWCProvider } = await import('@/lib/walletConnect');
      return await getWCProvider();
    }
    
    throw new Error('No wallet provider available');
  };

  const contextValue = {
    // Connection state
    isInitialized,
    isConnected: !!userAddress,
    userAddress,
    connectionMethod,
    
    // Farcaster state
    isInFarcaster,
    farcasterUser,
    
    // WalletConnect state
    isWCConnected,
    isWCConnecting,
    isWCLoading,
    wcError,
    shouldUseWC,
    isWCAvailable,
    
    // Actions
    connectWallet,
    disconnectWallet,
    getWalletProvider,
    
    // Helpers
    canConnect: shouldUseWC || (typeof window !== 'undefined' && window.ethereum),
    needsConnection: !userAddress && (shouldUseWC || (typeof window !== 'undefined' && window.ethereum)),
  };

  return (
    <WalletConnectContext.Provider value={contextValue}>
      {children}
    </WalletConnectContext.Provider>
  );
}

// Hook to use WalletConnect context
export function useWalletConnectContext() {
  const context = useContext(WalletConnectContext);
  if (!context) {
    throw new Error('useWalletConnectContext must be used within a WalletConnectProvider');
  }
  return context;
}
