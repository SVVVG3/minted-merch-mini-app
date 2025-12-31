'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcaster } from '@/lib/useFarcaster';
import { useWalletConnectContext } from './WalletConnectProvider';
import { sdk } from '@farcaster/miniapp-sdk';
import { useSignIn } from '@farcaster/auth-kit';

// Separate component for wallet connection section to properly use context
function WalletConnectSection({ setConnectedWallet, isInFarcaster }) {
  const { 
    connectWallet, 
    isWCConnecting, 
    shouldUseWC, 
    isWCAvailable,
    canConnect 
  } = useWalletConnectContext();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    console.log('🔗 Manual wallet connection attempt...');
    setIsConnecting(true);
    setError(null);
    
    // Clear disconnected flag when user manually connects
    localStorage.removeItem('wallet_disconnected');
    
    try {
      // Check if this is an Android device with native wallet
      const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
      const isAndroidWallet = userAgent.includes('android');
      
      if (isAndroidWallet && window.ethereum) {
        // Android path (dGEN1, etc.)
        console.log('🤖 Manual Android wallet connection attempt...');
        try {
          const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
          });
          console.log('🔍 Manual connection result:', accounts);
          
          if (accounts && accounts.length > 0 && accounts[0] !== 'decline') {
            console.log('✅ Manual Android wallet connection successful:', accounts[0]);
            setConnectedWallet(accounts[0]);
            window.location.reload();
            return;
          } else if (accounts && accounts.length > 0 && accounts[0] === 'decline') {
            setError('Wallet connection was declined. Please try again.');
            return;
          }
        } catch (err) {
          console.error('❌ Manual Android wallet connection failed:', err);
          setError(err.message);
          return;
        }
      } else if (window.ethereum) {
        // Desktop with browser extension (MetaMask, etc.)
        console.log('🦊 Attempting browser extension wallet connection...');
        try {
          const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
          });
          if (accounts && accounts.length > 0) {
            console.log('✅ Browser extension wallet connected:', accounts[0]);
            setConnectedWallet(accounts[0]);
            window.location.reload();
            return;
          }
        } catch (err) {
          console.error('❌ Browser extension connection failed:', err);
          // Fall through to WalletConnect
        }
      }
      
      // Try WalletConnect for desktop without extensions
      if (shouldUseWC && isWCAvailable && canConnect) {
        console.log('📱 Attempting WalletConnect connection...');
        try {
          await connectWallet();
          // WalletConnect will trigger a state update in the provider
          // which will be picked up by the ProfileModal's useEffect
          window.location.reload();
        } catch (err) {
          // Silent timeout (user likely closed modal) - just reset button
          if (err.message === 'TIMEOUT_SILENT') {
            console.log('ℹ️ Wallet connection cancelled or timed out');
          } else {
            console.error('❌ WalletConnect connection failed:', err);
            setError(err.message || 'WalletConnect connection failed');
          }
        }
      } else {
        setError('No wallet connection method available. Please install a wallet extension like MetaMask.');
      }
    } catch (err) {
      console.error('❌ Manual connection error:', err);
      // Don't show error for silent timeout
      if (err.message !== 'TIMEOUT_SILENT') {
        setError(err.message);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="text-center py-2">
      <p className="text-blue-400 mb-3">No wallet connected</p>
      {error && (
        <p className="text-red-400 text-xs mb-2">{error}</p>
      )}
      <button
        onClick={handleConnect}
        disabled={isConnecting || isWCConnecting}
        className="px-4 py-2 bg-[#3eb489] hover:bg-[#359970] disabled:bg-[#3eb489]/50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 mx-auto"
      >
        {(isConnecting || isWCConnecting) ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Connecting...
          </>
        ) : (
          <>
            <img 
              src="/walletconnectlogo.png" 
              alt="" 
              className="w-4 h-4"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            Connect Wallet
          </>
        )}
      </button>
      {!isInFarcaster && (
        <p className="text-gray-500 text-xs mt-2">
          Connect via WalletConnect or browser extension
        </p>
      )}
    </div>
  );
}

export function ProfileModal({ isOpen, onClose, onSignOut }) {
  const router = useRouter();
  const { user, isInFarcaster, getSessionToken, isReady } = useFarcaster();
  const { isConnected: isWalletConnected, userAddress: walletConnectAddress, connectionMethod, disconnectWallet } = useWalletConnectContext();
  const { signOut: authKitSignOut } = useSignIn();
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({ totalOrders: 0, totalSpent: 0 });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [isAmbassador, setIsAmbassador] = useState(false);
  const [checkingAmbassador, setCheckingAmbassador] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const shareDropdownRef = useRef(null);

  // Close share dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(event.target)) {
        setShowShareDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Share scores functionality
  const handleShareScores = async (method) => {
    setShowShareDropdown(false);
    
    const baseUrl = 'https://app.mintedmerch.shop';
    const shareUrl = `${baseUrl}/scores/${user?.fid}`;
    
    // Build scores text with all scores
    let scoresText = '';
    if (profileData?.mojo_score) {
      scoresText += `MMM: ${parseFloat(profileData.mojo_score).toFixed(2)}`;
    }
    if (profileData?.neynar_score) {
      scoresText += scoresText ? ' | ' : '';
      scoresText += `Neynar: ${parseFloat(profileData.neynar_score).toFixed(2)}`;
    }
    if (profileData?.quotient_score) {
      scoresText += scoresText ? ' | ' : '';
      scoresText += `Quotient: ${parseFloat(profileData.quotient_score).toFixed(2)}`;
    }
    
    const shareText = `Just checked my Minted Merch Mojo, Neynar, & Quotient scores on /mintedmerch:\n\n${scoresText}\n\nSee yours on the $mintedmerch mini app 👇`;
    
    if (method === 'copy') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    } else if (method === 'cast') {
      try {
        if (isInFarcaster && sdk?.actions?.composeCast) {
          await sdk.actions.composeCast({
            text: shareText,
            embeds: [shareUrl],
          });
        } else {
          // Fallback for non-mini-app
          const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(shareUrl)}`;
          window.open(warpcastUrl, '_blank');
        }
      } catch (err) {
        console.error('Failed to share:', err);
        // Fallback
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(shareUrl)}`;
        window.open(warpcastUrl, '_blank');
      }
    }
  };

  // Handle sign out for manually signed-in users (AuthKit)
  const handleSignOut = async () => {
    // Clear session token from localStorage
    localStorage.removeItem('fc_session_token');
    
    // Sign out from AuthKit
    try {
      authKitSignOut();
    } catch (e) {
      console.log('AuthKit signOut:', e);
    }
    
    // Call optional additional sign out handler (e.g., for Partner page)
    if (onSignOut) {
      try {
        await onSignOut();
      } catch (e) {
        console.log('Additional signOut handler:', e);
      }
    }
    
    // Close modal and reload page to reset all state
    onClose();
    window.location.reload();
  };

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
            // Check if user manually disconnected - don't show as connected
            const wasDisconnected = localStorage.getItem('wallet_disconnected');
            if (wasDisconnected === 'true') {
              console.log('ℹ️ User previously disconnected - not showing wallet');
              return;
            }
            
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
            // PHASE 2: Include session JWT token in Authorization header
            const headers = { 
              'Content-Type': 'application/json'
            };
            
            // Get session token (required)
            const token = localStorage.getItem('fc_session_token');
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            } else {
              console.error('No session token available - user must authenticate');
              setWalletMessage({ 
                type: 'error', 
                text: 'Authentication required. Please refresh the app.' 
              });
              return;
            }
            
            const response = await fetch('/api/update-connected-wallet', {
              method: 'POST',
              headers,
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
      // 🔒 SECURITY: Include JWT token for authentication
      const sessionToken = getSessionToken();
      
      if (!sessionToken) {
        console.warn('⚠️ No session token available for order history load');
        setOrdersLoading(false);
        return;
      }
      
      const headers = { 'Authorization': `Bearer ${sessionToken}` };
      
      const response = await fetch(`/api/user-orders?fid=${user.fid}&includeArchived=true`, { headers });
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

  // Check if user is an ambassador
  useEffect(() => {
    const checkAmbassadorStatus = async () => {
      if (!isOpen || !user?.fid) {
        return;
      }

      try {
        setCheckingAmbassador(true);
        
        // Get existing session token (user is already authenticated)
        const token = localStorage.getItem('fc_session_token');
        console.log('🔑 Ambassador check - Token received:', token ? 'YES' : 'NO');
        
        if (!token) {
          console.log('❌ No session token available for ambassador check');
          setIsAmbassador(false);
          return;
        }

        // Check ambassador status
        console.log('🔍 Checking ambassador status for FID:', user.fid);
        const response = await fetch('/api/ambassador/check-status', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('📡 Ambassador check response status:', response.status);
        const data = await response.json();
        console.log('📦 Ambassador check response data:', data);
        
        if (data.success && data.isAmbassador) {
          setIsAmbassador(true);
          console.log('✅ User is an ambassador');
        } else {
          setIsAmbassador(false);
          console.log('❌ User is NOT an ambassador or check failed:', data);
        }
      } catch (error) {
        console.error('❌ Error checking ambassador status:', error);
        setIsAmbassador(false);
      } finally {
        setCheckingAmbassador(false);
      }
    };

    checkAmbassadorStatus();
  }, [isOpen, user?.fid]);

  // Check if user is a partner
  useEffect(() => {
    const checkPartnerStatus = async () => {
      if (!isOpen || !user?.fid) {
        setIsPartner(false);
        return;
      }

      try {
        const token = localStorage.getItem('fc_session_token');
        if (!token) {
          setIsPartner(false);
          return;
        }

        const response = await fetch(`/api/partner/check-status?fid=${user.fid}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (data.success && data.isPartner) {
          setIsPartner(true);
          console.log('✅ User is a partner');
        } else {
          setIsPartner(false);
        }
      } catch (error) {
        console.error('❌ Error checking partner status:', error);
        setIsPartner(false);
      }
    };

    checkPartnerStatus();
  }, [isOpen, user?.fid]);

  // Load profile data when modal opens - wait for SDK to be ready
  useEffect(() => {
    if (isOpen && user?.fid && isReady) {
      setProfileLoading(true);
      
      // 🔒 SECURITY: Include JWT token for authentication
      const sessionToken = getSessionToken();
      
      if (!sessionToken) {
        console.warn('⚠️ No session token available for profile load');
        setProfileLoading(false);
        return;
      }
      
      loadOrderHistory();
      
      // Fetch profile data
      fetch('/api/user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
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
  }, [isOpen, user?.fid, isReady, getSessionToken]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden border border-[#3eb489]/30" style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6), 0 10px 30px rgba(0, 0, 0, 0.4)' }}>
        <div className="relative bg-gradient-to-br from-[#3eb489] to-[#2d8a66] px-4 pt-5 pb-3 text-white">
          {/* Close Button */}
          <button
            onClick={() => {
              onClose();
              setCopySuccess(false);
              setShowShareDropdown(false);
            }}
            className="absolute top-3 right-3 w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* User Info - Centered with Profile Image on Left */}
          <div className="flex flex-col items-center">
            {/* Top row: Profile Image + Name/FID/Share */}
            <div className="flex items-center gap-3">
              {/* Profile Image */}
              {user?.pfpUrl && (
                <img 
                  src={user.pfpUrl} 
                  alt={user.displayName || user.username}
                  className="w-12 h-12 rounded-full border-2 border-white/20 shadow-lg flex-shrink-0"
                />
              )}
              
              {/* Name + FID/Share stacked */}
              <div>
                <h3 className="text-lg font-bold leading-tight">
                  {user?.displayName || user?.username}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white/80 text-xs">FID: {user?.fid}</span>
                  {/* Share Button */}
                  {(profileData?.neynar_score || profileData?.quotient_score) && (
                    <div className="relative" ref={shareDropdownRef}>
                      <button
                        onClick={() => setShowShareDropdown(!showShareDropdown)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white rounded-md transition-colors text-sm font-medium"
                        title="Share"
                      >
                        <span>Share</span>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 520 457" fill="currentColor">
                          <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
                        </svg>
                      </button>
                      
                      {/* Share Dropdown */}
                      {showShareDropdown && (
                        <div className="absolute left-0 mt-1 w-40 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden z-50">
                          <button
                            onClick={() => handleShareScores('copy')}
                            className="w-full px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2 transition-colors"
                          >
                            {copySuccess ? (
                              <>
                                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-green-400 font-medium">Copied!</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleShareScores('cast')}
                            className="w-full px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2 transition-colors border-t border-gray-700"
                          >
                            <svg className="w-4 h-4 text-[#6A3CFF]" viewBox="0 0 520 457" fill="currentColor">
                              <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
                            </svg>
                            <span>Share Cast</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* All 3 scores centered */}
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {profileData?.mojo_score !== null && profileData?.mojo_score !== undefined && (
                <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs font-medium whitespace-nowrap">
                  MMM: {parseFloat(profileData.mojo_score).toFixed(2)}
                </span>
              )}
              {profileData?.neynar_score !== null && profileData?.neynar_score !== undefined && (
                <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs text-white/80 whitespace-nowrap">
                  Neynar: {parseFloat(profileData.neynar_score).toFixed(2)}
                </span>
              )}
              {profileData?.quotient_score !== null && profileData?.quotient_score !== undefined && (
                <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs text-white/80 whitespace-nowrap">
                  Quotient: {parseFloat(profileData.quotient_score).toFixed(2)}
                </span>
              )}
            </div>
            
            <p className="text-white/90 text-xl font-semibold mt-1">Profile & Order History</p>
          </div>
        </div>
        
        {/* Content Area */}
        <div className="overflow-y-auto max-h-[calc(90vh-160px)] pb-4">
          
          {profileLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#3eb489] border-t-transparent mx-auto"></div>
              <p className="text-gray-400 mt-4 font-medium">Loading profile data...</p>
            </div>
          ) : profileData ? (
            <div className="p-4 space-y-3">
              {/* Token Holdings Card */}
              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50 rounded-xl p-5 shadow-sm">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-green-700 bg-black flex items-center justify-center p-0.5">
                    <img src="/splash.png" alt="$MINTEDMERCH" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-green-400">$MINTEDMERCH Holdings</h4>
                      {/* Merch Mogul Badge - based on staked amount */}
                      {profileData?.staked_balance && parseFloat(profileData.staked_balance) >= 50000000 && (
                        <img 
                          src={parseFloat(profileData.staked_balance) >= 200000000 
                            ? "/GoldVerifiedMerchMogulBadge.png" 
                            : "/VerifiedMerchMogulBadge.png"
                          }
                          alt={parseFloat(profileData.staked_balance) >= 200000000 ? "Whale" : "Merch Mogul"}
                          className="h-5"
                          title={parseFloat(profileData.staked_balance) >= 200000000 
                            ? "Whale - 200M+ $MINTEDMERCH staked" 
                            : "Merch Mogul - 50M+ $MINTEDMERCH staked"
                          }
                        />
                      )}
                    </div>
                    <p className="text-xs text-green-500">
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
                  <div className="text-3xl font-bold text-green-400">
                    {formatTokenBalance(profileData.token_balance)}
                    <span className="text-lg font-normal text-green-500 ml-1">tokens</span>
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
                
                {/* Staked vs Wallet Breakdown */}
                {(profileData.staked_balance > 0 || profileData.wallet_balance > 0) && (
                  <div className="mt-3 pt-3 border-t border-green-700/50 flex justify-between text-sm">
                    <div className="text-green-400">
                      <span className="text-green-500">Staked:</span> {formatTokenBalance(profileData.staked_balance || 0)}
                    </div>
                    <div className="text-green-400">
                      <span className="text-green-500">Wallet:</span> {formatTokenBalance(profileData.wallet_balance || 0)}
                    </div>
                  </div>
                )}
              </div>

              {/* Staking Section */}
              <div className="bg-gradient-to-r from-teal-900/30 to-emerald-900/30 border border-teal-700/50 rounded-xl p-4 shadow-sm">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-teal-700">
                      <img src="/FinalAirdropStakeNFT.png" alt="Staking Rewards" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-teal-400">Staking Rewards</h4>
                      <p className="text-xs text-teal-500">Stake to earn $mintedmerch & spin-to-claim daily for a chance to win prizes!</p>
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
                      
                      // Close modal and navigate to stake page
                      onClose();
                      router.push('/stake');
                    }}
                    className="bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1 whitespace-nowrap w-full"
                  >
                    Stake Now
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Minted Merch Missions Link - For 50M+ holders OR 10M+ stakers */}
              {profileData && (
                (parseFloat(profileData.token_balance || 0) >= 50000000) || 
                (parseFloat(profileData.staked_balance || 0) >= 10000000)
              ) && (
                <div className="bg-gradient-to-r from-purple-900/30 to-fuchsia-900/30 border border-purple-700/50 rounded-xl p-4 shadow-sm">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-800/50 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                        🎯
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-purple-400">Minted Merch Missions</h4>
                        <p className="text-xs text-purple-500">Complete time-sensitive missions to earn $mintedmerch!</p>
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
                        
                        onClose();
                        router.push('/missions');
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1 whitespace-nowrap w-full"
                    >
                      View Missions
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Partner Dashboard Link - Only for registered partners */}
              {isPartner && (
                <div className="bg-gradient-to-r from-amber-900/30 to-yellow-900/30 border border-amber-700/50 rounded-xl p-4 shadow-sm">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-amber-800/50 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                        🤝
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-amber-400">Partner Dashboard</h4>
                        <p className="text-xs text-amber-500">Manage your assigned orders & payouts</p>
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
                        
                        onClose();
                        router.push('/partner');
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1 whitespace-nowrap w-full"
                    >
                      Open Dashboard
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Status Card */}
              {profileData.staked_balance && parseFloat(profileData.staked_balance) >= 50000000 ? (
                <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-700/50 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-8 h-8 bg-purple-800/50 rounded-full flex items-center justify-center">
                      🤌
                    </div>
                    <div>
                      <h4 className="font-bold text-purple-400">Merch Mogul Status</h4>
                      <p className="text-xs text-purple-500">Staking 50M+ $mintedmerch</p>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-purple-400 font-medium mb-2">You have access to:</p>
                    <div className="text-sm text-purple-300">
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
                <div className="bg-gradient-to-r from-gray-800/50 to-slate-800/50 border border-gray-700/50 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-8 h-8 bg-gray-700/50 rounded-full flex items-center justify-center">
                      🎯
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-300">Become a Merch Mogul</h4>
                      <p className="text-xs text-gray-500">Unlock exclusive benefits</p>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-300 font-medium mb-2">Stake 50M+ tokens to unlock:</p>
                    <div className="text-sm text-gray-400 mb-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span>• 15% off store wide</span>
                        <span>• Exclusive collaborations</span>
                        <span>• Custom merch orders</span>
                        <span>• Merch Moguls group chat</span>
                        <span>• ... and more!</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 bg-gray-700/50 rounded-lg p-2">
                      Currently staked: {profileData.staked_balance ? 
                        `${formatTokenBalance(profileData.staked_balance)} tokens` : 
                        '0 tokens'
                      }
                    </div>
                  </div>
                </div>
              )}
              
              {/* Connected Wallet Card */}
              <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-700/50 rounded-xl p-5 shadow-sm">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-8 h-8 bg-blue-800/50 rounded-full flex items-center justify-center">
                    💳
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-400">Connected Wallet</h4>
                    <p className="text-xs text-blue-500">Merch purchases & $mintedmerch buys</p>
                  </div>
                </div>
                
                {connectedWallet ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                      <p className="font-mono text-sm text-blue-400 font-medium">
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
                            ? 'text-green-400 bg-green-900/50 border border-green-700' 
                            : 'text-blue-400 bg-blue-900/50 hover:bg-blue-800/50 border border-blue-700'
                        }`}
                      >
                        {copySuccess ? '✅ Copied!' : '📋 Copy'}
                      </button>
                    </div>
                    
                    {/* Disconnect button - for manual connections (WalletConnect or browser extension, not mini app or dGEN1) */}
                    {(() => {
                      const userAgent = typeof window !== 'undefined' ? window.navigator?.userAgent?.toLowerCase() || '' : '';
                      const isAndroid = userAgent.includes('android');
                      const showDisconnect = !isInFarcaster && !isAndroid && (connectionMethod === 'walletconnect' || connectionMethod === 'ethereum');
                      
                      return showDisconnect ? (
                        <button
                          onClick={async () => {
                            try {
                              await disconnectWallet();
                              setConnectedWallet(null);
                              // Close modal after disconnect
                              onClose();
                            } catch (error) {
                              console.error('Failed to disconnect:', error);
                            }
                          }}
                          className="w-full px-3 py-2 text-xs font-medium text-red-400 bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 rounded-lg transition-colors"
                        >
                          Disconnect Wallet
                        </button>
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <WalletConnectSection 
                    setConnectedWallet={setConnectedWallet}
                    isInFarcaster={isInFarcaster}
                  />
                )}
              </div>
              
              {/* Order History Section */}
              <div className="bg-gradient-to-r from-orange-900/30 to-amber-900/30 border border-orange-700/50 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-orange-800/50 rounded-full flex items-center justify-center">
                      📦
                    </div>
                    <div>
                      <h4 className="font-bold text-orange-400">Order History</h4>
                      <p className="text-xs text-orange-500">Your recent purchases</p>
                    </div>
                  </div>
                  {orderStats.totalOrders > 0 && (
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-400">${orderStats.totalSpent.toFixed(2)}</div>
                      <div className="text-xs text-orange-500">{orderStats.totalOrders} orders</div>
                    </div>
                  )}
                </div>
                
                {ordersLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-orange-500 text-sm">Loading orders...</p>
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
                        <div key={order.id || order.order_id} className="bg-gray-800/50 rounded-lg p-3 border border-orange-700/30">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <button
                                className="font-semibold text-orange-400 text-sm hover:text-orange-300 underline cursor-pointer"
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
                              <p className="text-xs text-orange-500">{new Date(order.created_at || order.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-orange-400">${parseFloat(order.amount_total || order.totalAmount || 0).toFixed(2)} {order.currency || 'USDC'}</p>
                              <span className={`text-xs px-2 py-1 rounded-full inline-block ${
                                formatStatus(order.status) === 'Confirmed' || formatStatus(order.status) === 'confirmed' 
                                  ? 'bg-green-900/50 text-green-400'
                                  : formatStatus(order.status) === 'Shipped' || formatStatus(order.status) === 'shipped'
                                  ? 'bg-blue-900/50 text-blue-400' 
                                  : formatStatus(order.status) === 'Delivered' || formatStatus(order.status) === 'delivered'
                                  ? 'bg-purple-900/50 text-purple-400'
                                  : 'bg-yellow-900/50 text-yellow-400'
                              }`}>
                                {formatStatus(order.status)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Order Items Preview */}
                          {(order.lineItems || order.items) && (order.lineItems || order.items).length > 0 && (
                            <div className="text-xs text-orange-500">
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
                            <div className="mt-2 pt-2 border-t border-orange-700/30">
                              <button
                                className="text-xs text-orange-500 hover:text-orange-400 underline"
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
                    <p className="text-orange-500 text-sm">No orders yet</p>
                    <p className="text-xs text-orange-600 mt-1">Start shopping to see your orders here!</p>
                  </div>
                )}
              </div>

              {/* Sign Out Button - Only show for manually signed-in users (not in mini app) */}
              {!isInFarcaster && user?.fid && (
                <div className="pt-4 border-t border-gray-700">
                  <button
                    onClick={handleSignOut}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : !user?.fid ? (
            <div className="text-center py-8 px-4">
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-gray-300 font-medium">Sign in to view your profile</p>
              <p className="text-gray-500 text-sm mt-1">Connect with Farcaster to see your stats, orders, and more</p>
            </div>
          ) : !isReady ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#3eb489] border-t-transparent mx-auto"></div>
              <p className="text-gray-400 mt-3">Connecting to Farcaster...</p>
            </div>
          ) : (
            <div className="text-center py-8 px-4">
              <p className="text-gray-300">Unable to load profile data</p>
              <p className="text-gray-500 text-sm mt-1">Please try closing and reopening the modal</p>
              <button 
                onClick={() => {
                  setProfileLoading(true);
                  const sessionToken = getSessionToken();
                  if (sessionToken && user?.fid) {
                    fetch('/api/user-profile', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                      },
                      body: JSON.stringify({ fid: user.fid })
                    })
                      .then(response => response.json())
                      .then(data => {
                        if (data.success) setProfileData(data.data);
                      })
                      .catch(console.error)
                      .finally(() => setProfileLoading(false));
                  } else {
                    setProfileLoading(false);
                  }
                }}
                className="mt-3 text-[#3eb489] hover:text-[#2d9970] text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
