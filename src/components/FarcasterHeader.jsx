'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/miniapp-sdk';

export function FarcasterHeader() {
  const { user, isLoading, isInFarcaster } = useFarcaster();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({ totalOrders: 0, totalSpent: 0 });
  const [ordersLoading, setOrdersLoading] = useState(false);

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

  // Load order history
  const loadOrderHistory = useCallback(async () => {
    if (!user?.fid) return;
    
    setOrdersLoading(true);
    try {
      const response = await fetch(`/api/user-orders?fid=${user.fid}&limit=10&includeArchived=true`);
      if (response.ok) {
        const data = await response.json();
        if (data.orders && Array.isArray(data.orders)) {
          setOrders(data.orders);
          setOrderStats({
            totalOrders: data.totalOrders || data.orders.length,
            totalSpent: data.totalSpent || 0
          });
        }
      }
    } catch (error) {
      console.error('Failed to load order history:', error);
    } finally {
      setOrdersLoading(false);
    }
  }, [user?.fid]);

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
    
    // Load order history
    loadOrderHistory();
    
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
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="relative bg-gradient-to-br from-[#3eb489] to-[#2d8a66] p-6 text-white">
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setCopySuccess(false);
                }}
                className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              >
                ×
              </button>
              
              {/* User Info */}
              <div className="flex items-center space-x-4">
                {user.pfpUrl && (
                  <img 
                    src={user.pfpUrl} 
                    alt={user.displayName || user.username}
                    className="w-16 h-16 rounded-full border-3 border-white/20 shadow-lg"
                  />
                )}
                <div>
                  <h3 className="text-xl font-bold">
                    {user.displayName || user.username}
                  </h3>
                  <p className="text-white/80 text-sm">FID: {user.fid}</p>
                </div>
              </div>
            </div>
            
            {/* Content Area */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              
              {profileLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#3eb489] border-t-transparent mx-auto"></div>
                  <p className="text-gray-600 mt-4 font-medium">Loading profile data...</p>
                </div>
              ) : profileData ? (
                <div className="p-6 space-y-6">
                  {/* Token Holdings Card */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          💎
                        </div>
                        <div>
                          <h4 className="font-bold text-green-800">$MINTEDMERCH Holdings</h4>
                          <p className="text-xs text-green-600">
                            {(() => {
                              if (!profileData.all_wallet_addresses) return '';
                              if (Array.isArray(profileData.all_wallet_addresses)) {
                                return `${profileData.all_wallet_addresses.length} wallets tracked`;
                              }
                              try {
                                const wallets = JSON.parse(profileData.all_wallet_addresses);
                                return `${wallets.length} wallets tracked`;
                              } catch (e) {
                                return '';
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const capabilities = await sdk.getCapabilities();
                            if (capabilities.includes('haptics.selectionChanged')) {
                              await sdk.haptics.selectionChanged();
                            }
                          } catch (error) {
                            console.log('Haptics not available:', error);
                          }
                          
                          try {
                            const result = await sdk.actions.swapToken({
                              buyToken: `eip155:8453/erc20:0x774EAeFE73Df7959496Ac92a77279A8D7d690b07`,
                              sellToken: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
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
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105 shadow-md"
                      >
                        Buy More
                      </button>
                    </div>
                    
                    <div className="text-3xl font-bold text-green-700 mb-2">
                      {profileData.token_balance ? 
                        `${(parseFloat(profileData.token_balance) / Math.pow(10, 18) / 1000000).toFixed(1)}M` : 
                        '0'
                      }
                      <span className="text-lg font-normal text-green-600 ml-1">tokens</span>
                    </div>
                    
                    {profileData.token_balance_updated_at && (
                      <p className="text-xs text-green-600">
                        Last updated: {new Date(profileData.token_balance_updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  {/* Connected Wallet Card */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        💳
                      </div>
                      <div>
                        <h4 className="font-bold text-blue-800">Connected Wallet</h4>
                        <p className="text-xs text-blue-600">For purchases & payments</p>
                      </div>
                    </div>
                    
                    {connectedWallet ? (
                      <div className="flex items-center justify-between bg-white/50 rounded-lg p-3">
                        <p className="font-mono text-sm text-blue-700 font-medium">
                          {`${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`}
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              const capabilities = await sdk.getCapabilities();
                              if (capabilities.includes('haptics.impactOccurred')) {
                                await sdk.haptics.impactOccurred('light');
                              }
                            } catch (error) {
                              console.log('Haptics not available:', error);
                            }
                            
                            try {
                              await navigator.clipboard.writeText(connectedWallet);
                              setCopySuccess(true);
                              setTimeout(() => setCopySuccess(false), 2000);
                            } catch (error) {
                              console.error('Failed to copy:', error);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            copySuccess 
                              ? 'text-green-700 bg-green-100 border border-green-300' 
                              : 'text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-300'
                          }`}
                        >
                          {copySuccess ? '✅ Copied!' : '📋 Copy'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-blue-600 text-center py-2">No wallet connected</p>
                    )}
                  </div>
                  
                  {/* Status Card */}
                  {profileData.token_balance && parseFloat(profileData.token_balance) >= 50000000 * Math.pow(10, 18) ? (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          🤌
                        </div>
                        <div>
                          <h4 className="font-bold text-purple-800">Merch Mogul Status</h4>
                          <p className="text-xs text-purple-600">Elite member benefits</p>
                        </div>
                      </div>
                      <div className="bg-white/50 rounded-lg p-3">
                        <p className="text-purple-700 font-medium mb-2">You have access to:</p>
                        <div className="grid grid-cols-2 gap-2 text-sm text-purple-700">
                          <div className="flex items-center space-x-1">
                            <span className="text-purple-500">•</span>
                            <span>15% off store wide</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-purple-500">•</span>
                            <span>Exclusive collabs</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-purple-500">•</span>
                            <span>Custom merch</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-purple-500">•</span>
                            <span>Group chat access</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          🎯
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">Become a Merch Mogul</h4>
                          <p className="text-xs text-gray-600">Unlock exclusive benefits</p>
                        </div>
                      </div>
                      <div className="bg-white/50 rounded-lg p-3">
                        <p className="text-gray-700 font-medium mb-2">Hold 50M+ tokens to unlock:</p>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 mb-3">
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-500">•</span>
                            <span>15% off store wide</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-500">•</span>
                            <span>Exclusive collabs</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-500">•</span>
                            <span>Custom merch</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-500">•</span>
                            <span>Group chat access</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 bg-gray-100 rounded-lg p-2">
                          Current: {profileData.token_balance ? 
                            `${(parseFloat(profileData.token_balance) / Math.pow(10, 18) / 1000000).toFixed(1)}M tokens` : 
                            '0 tokens'
                          }
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Order History Section */}
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                          📦
                        </div>
                        <div>
                          <h4 className="font-bold text-orange-800">Order History</h4>
                          <p className="text-xs text-orange-600">Your recent purchases</p>
                        </div>
                      </div>
                      {orderStats.totalOrders > 0 && (
                        <div className="text-right">
                          <div className="text-lg font-bold text-orange-700">${orderStats.totalSpent.toFixed(2)}</div>
                          <div className="text-xs text-orange-600">{orderStats.totalOrders} orders</div>
                        </div>
                      )}
                    </div>
                    
                    {ordersLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-orange-600 text-sm">Loading orders...</p>
                      </div>
                    ) : orders.length > 0 ? (
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {orders.slice(0, 5).map((order) => (
                          <div key={order.id} className="bg-white/60 rounded-lg p-3 border border-orange-100">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-semibold text-orange-800 text-sm">Order #{order.orderNumber}</p>
                                <p className="text-xs text-orange-600">{new Date(order.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-orange-700">${order.totalAmount}</p>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  order.status === 'shipped' ? 'bg-green-100 text-green-700' :
                                  order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {order.status || 'Pending'}
                                </span>
                              </div>
                            </div>
                            {order.items && order.items.length > 0 && (
                              <p className="text-xs text-orange-700">
                                {order.items.length} item{order.items.length > 1 ? 's' : ''}: {order.items[0]?.title}
                                {order.items.length > 1 && ` +${order.items.length - 1} more`}
                              </p>
                            )}
                          </div>
                        ))}
                        {orders.length > 5 && (
                          <div className="text-center pt-2">
                            <p className="text-xs text-orange-600">Showing 5 of {orders.length} orders</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-orange-600 text-sm">No orders yet</p>
                        <p className="text-xs text-orange-500 mt-1">Start shopping to see your orders here!</p>
                      </div>
                    )}
                  </div>
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