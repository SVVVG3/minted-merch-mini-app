'use client';

import React, { useState } from 'react';
import { useWalletConnectContext } from './WalletConnectProvider';

/**
 * Wallet Connection Button Component
 * Shows appropriate connection method based on environment and availability
 */
export function WalletConnectButton({ 
  onConnect, 
  onDisconnect, 
  className = '',
  children,
  showDisconnect = true 
}) {
  const {
    isInitialized,
    isConnected,
    userAddress,
    connectionMethod,
    isWCConnecting,
    isWCLoading,
    wcError,
    canConnect,
    needsConnection,
    connectWallet,
    disconnectWallet,
  } = useWalletConnectContext();

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Handle connect
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      await connectWallet();
      
      if (onConnect) {
        onConnect(userAddress);
      }
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      
      if (onDisconnect) {
        onDisconnect();
      }
    } catch (error) {
      console.error('❌ Failed to disconnect wallet:', error);
      setError(error.message);
    }
  };

  // Show loading state
  if (!isInitialized || isWCLoading) {
    return (
      <button 
        disabled 
        className={`px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed ${className}`}
      >
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          <span>Loading...</span>
        </div>
      </button>
    );
  }

  // Show error state
  if (error || wcError) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2 text-red-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">Connection Error</span>
        </div>
        <p className="text-red-600 text-sm mt-1">{error || wcError}</p>
        <button
          onClick={() => {
            setError(null);
            handleConnect();
          }}
          className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Show connected state
  if (isConnected && userAddress) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm font-medium text-gray-700">
            {connectionMethod === 'farcaster' && 'Connected via Farcaster'}
            {connectionMethod === 'walletconnect' && 'Connected via WalletConnect'}
            {connectionMethod === 'ethereum' && 'Connected via Wallet'}
            {connectionMethod === 'base' && 'Connected via Base'}
          </span>
        </div>
        
        <div className="text-sm text-gray-600 font-mono">
          {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
        </div>
        
        {showDisconnect && (
          <button
            onClick={handleDisconnect}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Disconnect
          </button>
        )}
      </div>
    );
  }

  // Show connect button
  if (needsConnection && canConnect) {
    return (
      <button
        onClick={handleConnect}
        disabled={isConnecting || isWCConnecting}
        className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed ${className}`}
      >
        {isConnecting || isWCConnecting ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Connecting...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span>
              {connectionMethod === 'walletconnect' && 'Connect Wallet'}
              {connectionMethod === 'ethereum' && 'Connect Wallet'}
              {!connectionMethod && 'Connect Wallet'}
            </span>
          </div>
        )}
      </button>
    );
  }

  // Show custom children if provided
  if (children) {
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  // No connection method available
  return (
    <div className={`p-4 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
      <div className="flex items-center space-x-2 text-gray-600">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="text-sm">Wallet connection not available</span>
      </div>
      <p className="text-gray-500 text-sm mt-1">
        Please use a supported wallet or visit from a compatible environment.
      </p>
    </div>
  );
}

// Simplified connect button for specific use cases
export function ConnectWalletButton({ className = '', ...props }) {
  return (
    <WalletConnectButton 
      className={`px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors ${className}`}
      {...props}
    >
      Connect Wallet
    </WalletConnectButton>
  );
}

// Wallet status indicator
export function WalletStatus({ className = '' }) {
  const { isConnected, userAddress, connectionMethod } = useWalletConnectContext();

  if (!isConnected || !userAddress) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      <span className="text-gray-600">
        {connectionMethod === 'farcaster' && 'Farcaster'}
        {connectionMethod === 'walletconnect' && 'WalletConnect'}
        {connectionMethod === 'ethereum' && 'Wallet'}
        {connectionMethod === 'base' && 'Base'}
      </span>
      <span className="text-gray-500 font-mono">
        {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
      </span>
    </div>
  );
}
