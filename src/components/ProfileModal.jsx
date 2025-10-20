'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcaster } from '@/lib/useFarcaster';
import { useWalletConnectContext } from './WalletConnectProvider';
import { sdk } from '@farcaster/miniapp-sdk';

export function ProfileModal({ isOpen, onClose }) {
  const router = useRouter();
  const { user, isInFarcaster } = useFarcaster();
  const { isConnected: isWalletConnected, userAddress: walletConnectAddress, connectionMethod } = useWalletConnectContext();
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({ totalOrders: 0, totalSpent: 0 });
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Format token balance with proper B/M/K suffixes
  const formatTokenBalance = (balance) => {
    if (!balance || balance === 0) return '0';
    
    // Balance is now stored in tokens (not wei), so no conversion needed
    const tokenAmount = typeof balance === 'string' ? parseFloat(balance) : balance;
    
    if (tokenAmount >= 1000000000) {
      // Show billions (B) for amounts >= 1 billion
      return `${(tokenAmount / 1000000000).toFixed(3)}B`;
    } else if (tokenAmount >= 1000000) {
      // Show millions (M) for amounts >= 1 million
      return `${(tokenAmount / 1000000).toFixed(1)}M`;
    } else if (tokenAmount >= 1000) {
      // Show thousands (K) for amounts >= 1 thousand
      return `${(tokenAmount / 1000).toFixed(1)}K`;
    } else if (tokenAmount >= 1) {
      return tokenAmount.toFixed(2);
    } else {
      return tokenAmount.toFixed(6);
    }
  };

  // Get wallet address from Farcaster SDK, WalletConnect, or window.ethereum (for dGEN1/desktop)
  useEffect(() => {
    async function getWalletAddress() {
      let detectedAddress = null;
      let isConnectedWallet = false;

      // Priority 1: Check WalletConnect connection
      if (isWalletConnected && walletConnectAddress && connectionMethod === 'walletconnect') {
        detectedAddress = walletConnectAddress;
        isConnectedWallet = true;
        console.log('💳 Using WalletConnect wallet address:', detectedAddress);
      }
      
      // Priority 2: Check window.ethereum for dGEN1/desktop wallet
      if (!detectedAddress && typeof window !== 'undefined' && window.ethereum) {
        try {
          // Check if this is an Android device with native wallet (includes dGEN1)
          const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
          const isAndroidWallet = userAgent.includes('android');
          
          if (isAndroidWallet) {
            console.log('🤖 Android device with native wallet detected in ProfileModal - attempting auto-connection');
            // For dGEN1, try to request accounts to trigger auto-connection
            try {
              const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
              if (accounts && accounts.length > 0 && accounts[0] !== 'decline') {
                detectedAddress = accounts[0];
                isConnectedWallet = true;
                console.log('✅ Android wallet auto-connected in ProfileModal:', detectedAddress);
              } else if (accounts && accounts.length > 0 && accounts[0] === 'decline') {
                console.log('❌ Android wallet connection declined by user');
                // Don't set detectedAddress, let it remain null
              }
            } catch (error) {
              console.log('ℹ️ Android wallet auto-connection failed in ProfileModal, trying eth_accounts:', error);
              // Fall back to eth_accounts if eth_requestAccounts fails
              try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts && accounts.length > 0 && accounts[0] !== 'decline') {
                  detectedAddress = accounts[0];
                  isConnectedWallet = true;
                  console.log('✅ Android wallet already connected in ProfileModal:', detectedAddress);
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
              detectedAddress = accounts[0];
              isConnectedWallet = true;
              console.log('💳 Using connected wallet address:', detectedAddress);
            }
          }
        } catch (error) {
          console.log('Error getting wallet from window.ethereum:', error);
        }
      }
      
      // Priority 3: Farcaster SDK wallet (mini app)
      if (!detectedAddress && isInFarcaster && user) {
        try {
          const provider = await sdk.wallet.getEthereumProvider();
          if (provider) {
            const accounts = await provider.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              detectedAddress = accounts[0];
              console.log('💳 Using Farcaster SDK wallet address:', detectedAddress);
            }
          }
        } catch (error) {
          console.log('Error getting wallet address from Farcaster SDK:', error);
        }
      }

      // Update local state
      if (detectedAddress) {
        setConnectedWallet(detectedAddress);

        // If user has FID and this is a connected wallet (not Farcaster), save to database
        if (user?.fid && isConnectedWallet) {
          console.log('💾 Saving connected wallet to database for FID:', user.fid);
          try {
            const response = await fetch('/api/update-connected-wallet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fid: user.fid,
                walletAddress: detectedAddress
              })
            });
            const result = await response.json();
            if (result.success) {
              console.log('✅ Connected wallet saved to database');
            } else if (result.code === 'PROFILE_NOT_FOUND') {
              // User hasn't registered yet - this is expected, not an error
              console.log('ℹ️ Profile not found - user needs to sign in with Farcaster first');
            } else {
              console.error('❌ Failed to save wallet:', result.error);
            }
          } catch (error) {
            console.error('Error saving wallet to database:', error);
          }
        }
      }
    }

    getWalletAddress();
  }, [isInFarcaster, user, isWalletConnected, walletConnectAddress, connectionMethod]);

  // Load order history  
  const loadOrderHistory = async () => {
    // For anonymous users (dGEN1), we can't load order history without FID
    // Orders are stored but not queryable without FID
    if (!user?.fid) {
      console.log('No FID available - cannot load order history');
      return;
    }
    
    setOrdersLoading(true);
    try {
      const response = await fetch(`/api/user-orders?fid=${user.fid}&includeArchived=true`);
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
  };

  // Load profile data when modal opens
  useEffect(() => {
    if (isOpen && user?.fid) {
      setProfileLoading(true);
      loadOrderHistory();
      
      // Fetch profile data
      fetch('/api/user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: user.fid
        })
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setProfileData(data.data);
          }
        })
        .catch(error => {
          console.error('Error fetching profile data:', error);
        })
        .finally(() => {
          setProfileLoading(false);
        });
    }
  }, [isOpen, user?.fid]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden" style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6), 0 10px 30px rgba(0, 0, 0, 0.4)' }}>
        <div className="relative bg-gradient-to-br from-[#3eb489] to-[#2d8a66] p-6 text-white">
          {/* Close Button */}
          <button
            onClick={() => {
              onClose();
              setCopySuccess(false);
            }}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* User Info */}
          <div className="flex items-center space-x-4">
            {user?.pfpUrl && (
              <img 
                src={user.pfpUrl} 
                alt={user.displayName || user.username}
                className="w-16 h-16 rounded-full border-3 border-white/20 shadow-lg"
              />
            )}
            <div>
              <h3 className="text-xl font-bold">
                {user?.displayName || user?.username}
              </h3>
              <p className="text-white/80 text-sm">FID: {user?.fid}</p>
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
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    💎
                  </div>
                  <div className="flex-1">
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
                
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-green-700">
                    {formatTokenBalance(profileData.token_balance)}
                    <span className="text-lg font-normal text-green-600 ml-1">tokens</span>
                  </div>
                  <button
                    onClick={async () => {
                      if (isInFarcaster) {
                        // In mini app - use SDK swap action
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
                      } else {
                        // Not in mini app - open Matcha in new tab
                        const matchaUrl = 'https://matcha.xyz/tokens/base/0x774eaefe73df7959496ac92a77279a8d7d690b07';
                        window.open(matchaUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 shadow-md"
                  >
                    Buy More
                  </button>
                </div>
                
                {profileData.token_balance_updated_at && (
                  <p className="text-xs text-green-600 mt-2">
                    Last updated: {new Date(profileData.token_balance_updated_at).toLocaleString()}
                  </p>
                )}
              </div>
              
              {/* Status Card */}
              {profileData.token_balance && parseFloat(profileData.token_balance) >= 50000000 ? (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      🤌
                    </div>
                    <div>
                      <h4 className="font-bold text-purple-800">Merch Mogul Status</h4>
                      <p className="text-xs text-purple-600">Holding 50M+ $mintedmerch</p>
                    </div>
                  </div>
                  <div className="bg-white/50 rounded-lg p-3">
                    <p className="text-purple-700 font-medium mb-2">You have access to:</p>
                    <div className="text-sm text-purple-700">
                      <div className="flex flex-wrap items-center gap-1">
                        <span>• 15% off store wide</span>
                        <span>• Exclusive collaborations</span>
                        <span>• Custom merch orders</span>
                        <span>• Merch Moguls group chat</span>
                        <span>• ... and more!</span>
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
                    <div className="text-sm text-gray-700 mb-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span>• 15% off store wide</span>
                        <span>• Exclusive collaborations</span>
                        <span>• Custom merch orders</span>
                        <span>• Merch Moguls group chat</span>
                        <span>• ... and more!</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 bg-gray-100 rounded-lg p-2">
                      Current: {profileData.token_balance ? 
                        `${formatTokenBalance(profileData.token_balance)} tokens` : 
                        '0 tokens'
                      }
                    </div>
                  </div>
                </div>
              )}
              
              {/* Connected Wallet Card */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    💳
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-800">Connected Wallet</h4>
                    <p className="text-xs text-blue-600">Merch purchases & $mintedmerch buys</p>
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
                  <div className="text-center py-2">
                    <p className="text-blue-600 mb-3">No wallet connected</p>
                    <button
                      onClick={async () => {
                        console.log('🔗 Manual wallet connection attempt...');
                        try {
                          // Check if this is an Android device with native wallet
                          const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
                          const isAndroidWallet = userAgent.includes('android');
                          
                          if (isAndroidWallet && window.ethereum) {
                            console.log('🤖 Manual Android wallet connection attempt...');
                            try {
                              const accounts = await window.ethereum.request({ 
                                method: 'eth_requestAccounts' 
                              });
                              console.log('🔍 Manual connection result:', accounts);
                              
                              if (accounts && accounts.length > 0 && accounts[0] !== 'decline') {
                                console.log('✅ Manual Android wallet connection successful:', accounts[0]);
                                setConnectedWallet(accounts[0]);
                                // Trigger a re-render of the wallet detection
                                window.location.reload();
                              } else if (accounts && accounts.length > 0 && accounts[0] === 'decline') {
                                console.log('❌ Manual Android wallet connection declined');
                                alert('Wallet connection was declined. Please try again or check your wallet settings.');
                              } else {
                                console.log('❌ No accounts returned from manual connection');
                                alert('No wallet accounts found. Please check your wallet is unlocked.');
                              }
                            } catch (error) {
                              console.error('❌ Manual Android wallet connection failed:', error);
                              alert(`Wallet connection failed: ${error.message}`);
                            }
                          } else {
                            console.log('❌ Not an Android device or no ethereum provider');
                            alert('Wallet connection not available on this device.');
                          }
                        } catch (error) {
                          console.error('❌ Manual connection error:', error);
                          alert(`Connection error: ${error.message}`);
                        }
                      }}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      🔗 Connect Wallet
                    </button>
                  </div>
                )}
              </div>
              
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
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {orders.map((order) => {
                      // Clean order ID for display (remove # if present)
                      const cleanOrderId = order.order_id?.replace('#', '') || order.orderId?.replace('#', '') || order.orderNumber || 'Unknown';
                      
                      // Helper function to format status
                      const formatStatus = (status) => {
                        if (!status) return 'Unknown';
                        const statusMap = {
                          'pending': 'Pending',
                          'paid': 'Confirmed', 
                          'processing': 'Processing',
                          'shipped': 'Shipped',
                          'delivered': 'Delivered',
                          'cancelled': 'Cancelled',
                          'refunded': 'Refunded'
                        };
                        return statusMap[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
                      };
                      
                      return (
                        <div key={order.id || order.order_id} className="bg-white/60 rounded-lg p-3 border border-orange-100">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <button
                                className="font-semibold text-orange-800 text-sm hover:text-orange-600 underline cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Close modal first
                                  onClose();
                                  // Use Next.js router to avoid full page reload (preserves auth state)
                                  router.push(`/order/${cleanOrderId}`);
                                }}
                              >
                                Order #{cleanOrderId}
                              </button>
                              <p className="text-xs text-orange-600">{new Date(order.created_at || order.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-orange-700">${parseFloat(order.amount_total || order.totalAmount || 0).toFixed(2)} {order.currency || 'USDC'}</p>
                              <span className={`text-xs px-2 py-1 rounded-full inline-block ${
                                formatStatus(order.status) === 'Confirmed' || formatStatus(order.status) === 'confirmed' 
                                  ? 'bg-green-100 text-green-800'
                                  : formatStatus(order.status) === 'Shipped' || formatStatus(order.status) === 'shipped'
                                  ? 'bg-blue-100 text-blue-800' 
                                  : formatStatus(order.status) === 'Delivered' || formatStatus(order.status) === 'delivered'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {formatStatus(order.status)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Order Items Preview */}
                          {(order.lineItems || order.items) && (order.lineItems || order.items).length > 0 && (
                            <div className="text-xs text-orange-700">
                              {(order.lineItems || order.items).length === 1 
                                ? `1 item`
                                : `${(order.lineItems || order.items).length} items`
                              }
                              {(order.lineItems || order.items).length <= 3 ? (
                                <span className="ml-1">
                                  ({(order.lineItems || order.items).map((item, idx) => {
                                    // Use the enriched title from the API
                                    let itemName = item.title || 'Unknown Item';
                                    
                                    // Include variant info if available
                                    if (item.variant && item.variant !== 'Default Title') {
                                      itemName += ` (${item.variant})`;
                                    }
                                    
                                    return itemName;
                                  }).join(', ')})
                                </span>
                              ) : (
                                <span className="ml-1">
                                  ({(order.lineItems || order.items).slice(0, 2).map((item, idx) => {
                                    let itemName = item.title || 'Unknown Item';
                                    if (item.variant && item.variant !== 'Default Title') {
                                      itemName += ` (${item.variant})`;
                                    }
                                    return itemName;
                                  }).join(', ')} and {(order.lineItems || order.items).length - 2} more)
                                </span>
                              )}
                            </div>
                          )}
                          
                          {/* Transaction Link */}
                          {order.transaction_hash && (
                            <div className="mt-2 pt-2 border-t border-orange-200">
                              <button
                                className="text-xs text-orange-600 hover:text-orange-800 underline"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const baseScanUrl = `https://basescan.org/tx/${order.transaction_hash}`;
                                    await sdk.actions.openUrl(baseScanUrl);
                                  } catch (error) {
                                    console.log('SDK openUrl failed, trying fallback:', error);
                                    try {
                                      if (window.open) {
                                        window.open(baseScanUrl, '_blank', 'noopener,noreferrer');
                                      } else {
                                        window.location.href = baseScanUrl;
                                      }
                                    } catch (fallbackError) {
                                      console.error('All methods failed to open transaction link:', fallbackError);
                                    }
                                  }
                                }}
                              >
                                Tx: {order.transaction_hash.slice(0, 10)}...{order.transaction_hash.slice(-6)}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
  );
}
