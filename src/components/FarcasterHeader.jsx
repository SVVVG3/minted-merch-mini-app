'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/miniapp-sdk';

export function FarcasterHeader() {
  const { user, isLoading, isInFarcaster } = useFarcaster();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Get wallet address from Farcaster SDK
  useEffect(() => {
    async function getWalletAddress() {
      if (isInFarcaster && user) {
        try {
          const provider = await sdk.wallet.getEthereumProvider();
          if (provider) {
            // Request accounts from the provider
            const accounts = await provider.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              setConnectedWallet(accounts[0]);
            }
          }
        } catch (error) {
          console.log('Error getting wallet address:', error);
        }
      }
    }

    getWalletAddress();
  }, [isInFarcaster, user]);

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  // Don't render if not in Farcaster context
  if (!isInFarcaster || !user) {
    return null;
  }

  // Handle coin mini app click
  const handleCoinClick = async () => {
    // Add haptic feedback for coin link selection
    try {
      const capabilities = await sdk.getCapabilities();
      if (capabilities.includes('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
      }
    } catch (error) {
      // Haptics not available, continue without feedback
      console.log('Haptics not available:', error);
    }
    
    try {
      await sdk.actions.openMiniApp({
        url: 'https://coin.mintedmerch.shop/'
      });
      console.log('Coin mini app opened successfully - current app will close');
    } catch (error) {
      console.error('Failed to open coin mini app:', error);
    }
  };

  // Handle profile modal opening
  const handleProfileClick = async () => {
    // Add haptic feedback for profile picture selection
    try {
      const capabilities = await sdk.getCapabilities();
      if (capabilities.includes('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
      }
    } catch (error) {
      // Haptics not available, continue without feedback
      console.log('Haptics not available:', error);
    }
    
    setShowProfileModal(true);
    setProfileLoading(true);
    
    try {
      // Fetch user profile data including token balance
      const response = await fetch('/api/user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: user.fid
        })
      });
      
      const data = await response.json();
      console.log('Profile data received:', data);
      if (data.success) {
        console.log('Profile data.data:', data.data);
        setProfileData(data.data);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="bg-[#3eb489] text-white px-4 py-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <div className="space-y-0.5">
            <div>
              Hold 1M+ {' '}
              <button 
                onClick={handleCoinClick}
                className="underline hover:text-green-200 transition-colors font-medium"
              >
                $mintedmerch
              </button>
              {' '}to qualify for random raffles!
            </div>
            <div>
              Hold 50M+ to become a Merch Mogul 🤌
            </div>
          </div>
        </div>
        {user.pfpUrl && (
          <img 
            src={user.pfpUrl} 
            alt={user.displayName || user.username}
            className="w-9 h-9 rounded-full cursor-pointer border-2 border-white hover:ring-2 hover:ring-white hover:ring-opacity-50 transition-all"
            onClick={handleProfileClick}
          />
        )}
      </div>
      
      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header with User Info */}
              <div className="flex items-center justify-between mb-6">
                {/* User Info */}
                <div className="flex items-center space-x-3">
                  {user.pfpUrl && (
                    <img 
                      src={user.pfpUrl} 
                      alt={user.displayName || user.username}
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {user.displayName || user.username}
                    </h3>
                    <p className="text-sm text-gray-600">FID: {user.fid}</p>
                  </div>
                </div>
                
                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    setCopySuccess(false); // Reset copy state when closing
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              {profileLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489] mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading profile data...</p>
                </div>
              ) : profileData ? (
                <div className="space-y-4">
                  {/* Token Holdings */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">
                      💎 $MINTEDMERCH Holdings {(() => {
                        if (!profileData.all_wallet_addresses) {
                          console.log('No all_wallet_addresses found in profileData:', profileData);
                          return '';
                        }
                        
                        // Check if it's already an array (which it is!)
                        if (Array.isArray(profileData.all_wallet_addresses)) {
                          console.log('all_wallet_addresses is array:', profileData.all_wallet_addresses, 'Length:', profileData.all_wallet_addresses.length);
                          return `(${profileData.all_wallet_addresses.length} wallets)`;
                        }
                        
                        // Fallback: try to parse as JSON string
                        try {
                          console.log('all_wallet_addresses raw (not array):', profileData.all_wallet_addresses);
                          const wallets = JSON.parse(profileData.all_wallet_addresses);
                          console.log('Parsed wallets:', wallets, 'Length:', wallets.length);
                          return `(${wallets.length} wallets)`;
                        } catch (e) {
                          console.error('Error parsing wallet addresses:', e);
                          console.log('Raw data type:', typeof profileData.all_wallet_addresses);
                          return '';
                        }
                      })()}
                    </h4>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-green-700">
                        {profileData.token_balance ? 
                          `${(parseFloat(profileData.token_balance) / Math.pow(10, 18) / 1000000).toFixed(1)}M tokens` : 
                          '0 tokens'
                        }
                      </div>
                      <button
                        onClick={async () => {
                          // Add haptic feedback for buy action
                          try {
                            const capabilities = await sdk.getCapabilities();
                            if (capabilities.includes('haptics.selectionChanged')) {
                              await sdk.haptics.selectionChanged();
                            }
                          } catch (error) {
                            console.log('Haptics not available:', error);
                          }
                          
                          // Open swap functionality
                          try {
                            const result = await sdk.actions.swapToken({
                              buyToken: `eip155:8453/erc20:0x774EAeFE73Df7959496Ac92a77279A8D7d690b07`, // $mintedmerch token on Base
                              sellToken: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
                            });
                            
                            if (result.success) {
                              console.log('Swap completed:', result.swap);
                            } else {
                              console.log('Swap failed or cancelled:', result.reason);
                            }
                          } catch (error) {
                            console.error('Error opening swap:', error);
                          }
                        }}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-full transition-colors font-medium"
                      >
                        Buy
                      </button>
                    </div>
                    {profileData.token_balance_updated_at && (
                      <p className="text-xs text-green-600 mt-1">
                        Last updated: {new Date(profileData.token_balance_updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  {/* Connected Wallet */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">
                      💳 Connected Wallet (for purchases)
                    </h4>
                    {connectedWallet ? (
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-sm text-blue-700">
                          {`${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`}
                        </p>
                        <button
                          onClick={async () => {
                            // Add haptic feedback for copy action
                            try {
                              const capabilities = await sdk.getCapabilities();
                              if (capabilities.includes('haptics.impactOccurred')) {
                                await sdk.haptics.impactOccurred('light');
                              }
                            } catch (error) {
                              // Haptics not available, continue without feedback
                              console.log('Haptics not available:', error);
                            }
                            
                            try {
                              await navigator.clipboard.writeText(connectedWallet);
                              setCopySuccess(true);
                              console.log('Wallet address copied:', connectedWallet);
                              // Reset after 2 seconds
                              setTimeout(() => setCopySuccess(false), 2000);
                            } catch (error) {
                              console.error('Failed to copy:', error);
                            }
                          }}
                          className={`text-xs ml-2 px-2 py-1 border rounded transition-all duration-200 ${
                            copySuccess 
                              ? 'text-green-600 border-green-300 bg-green-100' 
                              : 'text-blue-600 hover:text-blue-800 border-blue-300 hover:bg-blue-100'
                          }`}
                        >
                          {copySuccess ? '✅ Copied!' : '📋 Copy Address'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-blue-600">No wallet connected</p>
                    )}
                  </div>
                  
                  {/* Merch Mogul Status */}
                  {profileData.token_balance && parseFloat(profileData.token_balance) >= 50000000 * Math.pow(10, 18) ? (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-semibold text-purple-800 mb-2">
                        🤌 Merch Mogul Status
                      </h4>
                      <div className="text-purple-700">
                        <p className="mb-2">You hold 50M+ $mintedmerch & have access to:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>15% off store wide</li>
                          <li>Exclusive collaborations</li>
                          <li>Custom merch orders</li>
                          <li>Merch Moguls group chat</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">
                        🎯 Become a Merch Mogul
                      </h4>
                      <div className="text-gray-700">
                        <p className="mb-2">Hold 50M+ $mintedmerch to unlock:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>15% off store wide</li>
                          <li>Exclusive collaborations</li>
                          <li>Custom merch orders</li>
                          <li>Merch Moguls group chat</li>
                        </ul>
                        <p className="text-xs text-gray-600 mt-2">
                          Current holdings: {profileData.token_balance ? 
                            `${(parseFloat(profileData.token_balance) / Math.pow(10, 18) / 1000000).toFixed(1)}M tokens` : 
                            '0 tokens'
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">Unable to load profile data</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 