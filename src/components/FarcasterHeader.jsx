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
              Hold 50M+ to become a Merch Mogul
            </div>
          </div>
        </div>
        {user.pfpUrl && (
          <img 
            src={user.pfpUrl} 
            alt={user.displayName || user.username}
            className="w-9 h-9 rounded-full cursor-pointer hover:ring-2 hover:ring-white hover:ring-opacity-50 transition-all"
            onClick={handleProfileClick}
          />
        )}
      </div>
      
      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-end mb-4">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              {/* User Info */}
              <div className="flex items-center space-x-3 mb-6">
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
                      💎 $MINTEDMERCH Holdings {profileData.all_wallet_addresses && (() => {
                        try {
                          console.log('all_wallet_addresses raw:', profileData.all_wallet_addresses);
                          const wallets = JSON.parse(profileData.all_wallet_addresses);
                          console.log('Parsed wallets:', wallets);
                          return `(${wallets.length} wallets)`;
                        } catch (e) {
                          console.error('Error parsing wallet addresses:', e);
                          return '';
                        }
                      })()}
                    </h4>
                    <div className="text-2xl font-bold text-green-700">
                      {profileData.token_balance ? 
                        `${(parseFloat(profileData.token_balance) / Math.pow(10, 18) / 1000000).toFixed(1)}M tokens` : 
                        '0 tokens'
                      }
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
                      💳 Connected Wallet (for payments)
                    </h4>
                    {connectedWallet ? (
                      <div>
                        <p className="font-mono text-sm text-blue-700 break-all">
                          {connectedWallet}
                        </p>
                        <button
                          onClick={() => navigator.clipboard.writeText(connectedWallet)}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          📋 Copy Address
                        </button>
                      </div>
                    ) : (
                      <p className="text-blue-600">No wallet connected</p>
                    )}
                  </div>
                  
                  {/* Merch Mogul Status */}
                  {profileData.token_balance && parseFloat(profileData.token_balance) >= 50000000 * Math.pow(10, 18) && (
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