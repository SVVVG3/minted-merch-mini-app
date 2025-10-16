'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  initializeWalletConnect, 
  connectWallet, 
  disconnectWallet, 
  getActiveSessions,
  shouldUseWalletConnect,
  isWalletConnectAvailable 
} from './walletConnect';

/**
 * React hook for WalletConnect integration
 * Provides wallet connection functionality for desktop and mobile web users
 */
export function useWalletConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [shouldUseWC, setShouldUseWC] = useState(false);

  // Check if we should use WalletConnect
  useEffect(() => {
    const useWC = shouldUseWalletConnect();
    setShouldUseWC(useWC);
    setIsLoading(false);
    
    if (useWC) {
      console.log('🔗 WalletConnect is available for this environment');
    } else {
      console.log('ℹ️ WalletConnect not needed for this environment');
    }
  }, []);

  // Initialize WalletConnect and check for existing sessions
  useEffect(() => {
    if (!shouldUseWC) return;

    const initializeAndCheckSessions = async () => {
      try {
        setIsLoading(true);
        
        // Initialize WalletConnect
        await initializeWalletConnect();
        
        // Check for existing sessions
        const activeSessions = await getActiveSessions();
        setSessions(activeSessions);
        
        if (Object.keys(activeSessions).length > 0) {
          setIsConnected(true);
          // Extract accounts from sessions
          const allAccounts = [];
          Object.values(activeSessions).forEach(session => {
            if (session.namespaces?.eip155?.accounts) {
              allAccounts.push(...session.namespaces.eip155.accounts);
            }
          });
          setAccounts(allAccounts);
          console.log('✅ Found existing WalletConnect sessions:', activeSessions);
        }
      } catch (error) {
        console.error('❌ Failed to initialize WalletConnect:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAndCheckSessions();
  }, [shouldUseWC]);

  // Connect wallet
  const connect = useCallback(async () => {
    if (!shouldUseWC) {
      throw new Error('WalletConnect not available in this environment');
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      console.log('🔗 Connecting wallet via WalletConnect...');
      
      // Connect wallet
      const walletKit = await connectWallet();
      
      if (walletKit) {
        // Get updated sessions
        const activeSessions = await getActiveSessions();
        setSessions(activeSessions);
        
        if (Object.keys(activeSessions).length > 0) {
          setIsConnected(true);
          
          // Extract accounts from sessions
          const allAccounts = [];
          Object.values(activeSessions).forEach(session => {
            if (session.namespaces?.eip155?.accounts) {
              allAccounts.push(...session.namespaces.eip155.accounts);
            }
          });
          setAccounts(allAccounts);
          
          console.log('✅ WalletConnect connection successful:', allAccounts);
        }
      }
    } catch (error) {
      console.error('❌ Failed to connect wallet via WalletConnect:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [shouldUseWC]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    if (!shouldUseWC) return;

    try {
      console.log('🔌 Disconnecting WalletConnect...');
      
      await disconnectWallet();
      
      setIsConnected(false);
      setSessions({});
      setAccounts([]);
      setError(null);
      
      console.log('✅ WalletConnect disconnected successfully');
    } catch (error) {
      console.error('❌ Failed to disconnect WalletConnect:', error);
      setError(error.message);
      throw error;
    }
  }, [shouldUseWC]);

  // Get primary account address
  const getPrimaryAddress = useCallback(() => {
    if (accounts.length === 0) return null;
    
    // Return the first account address
    const primaryAccount = accounts[0];
    if (typeof primaryAccount === 'string') {
      // Extract address from CAIP-10 format (eip155:8453:0x...)
      const parts = primaryAccount.split(':');
      return parts[parts.length - 1];
    }
    
    return primaryAccount;
  }, [accounts]);

  // Check if account is connected
  const isAccountConnected = useCallback((address) => {
    if (!address) return false;
    
    return accounts.some(account => {
      if (typeof account === 'string') {
        const parts = account.split(':');
        const accountAddress = parts[parts.length - 1];
        return accountAddress.toLowerCase() === address.toLowerCase();
      }
      return account.toLowerCase() === address.toLowerCase();
    });
  }, [accounts]);

  return {
    // State
    isConnected,
    isConnecting,
    isLoading,
    error,
    sessions,
    accounts,
    shouldUseWC,
    isAvailable: isWalletConnectAvailable(),
    
    // Actions
    connect,
    disconnect,
    
    // Helpers
    getPrimaryAddress,
    isAccountConnected,
    
    // Computed values
    primaryAddress: getPrimaryAddress(),
    hasAccounts: accounts.length > 0,
  };
}
