'use client';

import { useState, useEffect } from 'react';
import { ProductGrid } from './ProductGrid';
import { Cart } from './Cart';
import { CheckInButton } from './CheckInButton';
import { LeaderboardButton } from './LeaderboardButton';
import { InfoButton } from './InfoButton';
import { useCart } from '@/lib/CartContext';
import { useFarcaster } from '@/lib/useFarcaster';
import { extractNotificationParams, storeNotificationContext, getPendingDiscountCode } from '@/lib/urlParams';
import { getBestAvailableDiscount, hasDiscountOfType } from '@/lib/discounts';
import { sdk } from '@farcaster/miniapp-sdk';
// Token-gating functions moved to API routes to avoid client-side Node.js imports
// import { getEligibleAutoApplyDiscounts } from '@/lib/tokenGating';
// import { fetchUserWalletData } from '@/lib/walletUtils';

export function HomePage({ collection, products }) {
  const { itemCount, cartTotal } = useCart();
  const { isInFarcaster, isReady, getFid, getUsername, getDisplayName, getPfpUrl, user, context, hasNotifications, getNotificationDetails } = useFarcaster();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [notificationContext, setNotificationContext] = useState(null);
  const [userDiscounts, setUserDiscounts] = useState({
    isLoading: true,
    bestDiscount: null,
    availableDiscounts: [],
    error: null
  });

  // URL Parameter Detection - Detect notification clicks and discount codes
  useEffect(() => {
    console.log('🔍 === URL PARAMETER DETECTION ===');
    
    // Extract URL parameters for notification detection
    const params = extractNotificationParams();
    console.log('URL Parameters extracted:', params);
    
    // Store notification context if detected
    if (params.hasNotificationParams) {
      console.log('🎯 Notification arrival detected!');
      console.log('- Discount code:', params.discountCode);
      console.log('- Notification source:', params.notificationSource);
      console.log('- Referrer:', params.referrer);
      
      // Store context for later use
      const stored = storeNotificationContext(params);
      if (stored) {
        setNotificationContext(params);
      }
    } else {
      // Check if there's a pending discount code from a previous session
      const pendingDiscount = getPendingDiscountCode();
      if (pendingDiscount) {
        console.log('💾 Found pending discount code from previous session:', pendingDiscount);
        setNotificationContext({
          hasNotificationParams: true,
          discountCode: pendingDiscount.discountCode,
          notificationSource: 'previous_session',
          timestamp: pendingDiscount.timestamp,
          hoursAgo: pendingDiscount.hoursAgo
        });
      }
    }
  }, []); // Run once on component mount

  // Register user profile when Farcaster context is ready
  useEffect(() => {
    if (!isInFarcaster || !isReady) return;
    
    const userFid = getFid();
    if (!userFid) return;

    // Prevent multiple registrations with more robust checking
    const sessionKey = `user_registered_${userFid}`;
    const hasRegistered = sessionStorage.getItem(sessionKey);
    const lastRegistration = localStorage.getItem(`last_registration_${userFid}`);
    const now = Date.now();
    
    // Skip if registered in this session or within last 5 minutes
    if (hasRegistered || (lastRegistration && (now - parseInt(lastRegistration)) < 5 * 60 * 1000)) {
      console.log('User already registered recently, loading discounts with delay to ensure data consistency');
      // Add a small delay to ensure any background registration processes complete
      setTimeout(() => {
        loadUserDiscounts(userFid);
      }, 2000); // 2 second delay
      return;
    }

    const registerUserProfile = async () => {
      try {
        console.log('=== REGISTERING USER PROFILE ===');
        console.log('User FID:', userFid);
        console.log('User Data:', {
          fid: userFid,
          username: getUsername(),
          displayName: getDisplayName(),
          pfpUrl: getPfpUrl()
        });
        console.log('Full Farcaster Context:', context);
        
        // Check if user has notifications enabled
        const hasNotifications = !!(context?.client?.notificationDetails || context?.notificationDetails);
        const notificationDetails = context?.client?.notificationDetails || context?.notificationDetails;
        
        console.log('User has notifications enabled:', hasNotifications);
        console.log('Notification details:', notificationDetails);
        
        // Prepare user data for registration
        const userData = {
          username: getUsername() || `user_${userFid}`,
          displayName: getDisplayName() || null,
          bio: null, // Bio not available in simplified version
          pfpUrl: getPfpUrl() || null
        };

        console.log('Registering user profile with data:', userData);
        
        // Register user profile
        const response = await fetch('/api/register-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            fid: userFid,
            username: userData.username,
            displayName: userData.displayName,
            bio: userData.bio,
            pfpUrl: userData.pfpUrl
          }),
        });
        
        const result = await response.json();
        console.log('User profile registration result:', result);
        
        if (result.success) {
          console.log('✅ User profile successfully registered!');
          console.log('📱 Has notifications enabled:', result.hasNotifications);
          
          // Mark as registered to prevent multiple calls
          sessionStorage.setItem(`user_registered_${userFid}`, 'true');
          localStorage.setItem(`last_registration_${userFid}`, Date.now().toString());
          
          if (result.welcomeNotificationSent) {
            console.log('🎉 Welcome notification sent to new user!');
          } else if (result.hasNotifications) {
            console.log('✅ User has notifications but welcome already sent previously');
          } else {
            console.log('📱 User does not have notifications enabled');
          }

          // After successful registration, check for user's available discount codes
          loadUserDiscounts(userFid);
        } else {
          console.error('❌ User profile registration failed:', result.error);
        }
        
      } catch (error) {
        console.error('Error registering user profile:', error);
      }
    };

    // Small delay to ensure Farcaster context is fully loaded
    const timer = setTimeout(registerUserProfile, 1000);
    return () => clearTimeout(timer);
  }, [isInFarcaster, isReady]); // Removed unstable dependencies

  // Real-time notification monitoring - simplified version
  useEffect(() => {
    if (!isInFarcaster || !isReady) return;
    
    const userFid = getFid();
    if (!userFid) return;

    // Check if already monitoring to prevent duplicates
    const isAlreadyMonitoring = sessionStorage.getItem(`monitoring_${userFid}`);
    if (isAlreadyMonitoring) return;

    sessionStorage.setItem(`monitoring_${userFid}`, 'true');
    
    let notificationCheckCount = 0;
    let isMonitoring = true;
    
    const checkForNewNotifications = async () => {
      if (!isMonitoring) return;
      
      try {
        notificationCheckCount++;
        console.log(`🔔 Checking for newly enabled notifications (check #${notificationCheckCount})...`);
        
        // Register user again to trigger notification check
        const response = await fetch('/api/register-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            fid: userFid,
            username: getUsername() || `user_${userFid}`,
            displayName: getDisplayName() || null,
            bio: null, // Don't rely on user object here
            pfpUrl: getPfpUrl() || null
          }),
        });
        
        const result = await response.json();
        
        if (result.success && result.welcomeNotificationSent) {
          console.log('🎉 Welcome notification sent during session monitoring!');
          isMonitoring = false; // Stop monitoring once notification is sent
          return;
        } else if (result.success && result.hasNotifications) {
          console.log('✅ User has notifications but welcome already sent');
          isMonitoring = false; // Stop monitoring if they already have notifications
          return;
        }
        
        // Stop after fewer checks to reduce API calls
        if (notificationCheckCount >= 5) {
          console.log('📱 Stopped monitoring for notifications after 5 checks');
          isMonitoring = false;
          return;
        }
        
        // Schedule next check (reduced frequency)
        if (isMonitoring) {
          setTimeout(checkForNewNotifications, 10000); // Check every 10 seconds
        }
        
      } catch (error) {
        console.error('Error checking for new notifications:', error);
        isMonitoring = false; // Stop on error
      }
    };
    
    // Start first check after 5 seconds (longer delay)
    const initialTimer = setTimeout(checkForNewNotifications, 5000);
    
    // Also check when window regains focus (user might have switched to enable notifications)
    const handleFocus = () => {
      if (isMonitoring && notificationCheckCount < 3) {
        console.log('Window focused - checking for notifications...');
        checkForNewNotifications();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Cleanup on unmount
    return () => {
      isMonitoring = false;
      clearTimeout(initialTimer);
      window.removeEventListener('focus', handleFocus);
      sessionStorage.removeItem(`monitoring_${userFid}`);
    };
  }, [isInFarcaster, isReady]); // Removed unstable dependencies

  // Load user's available discount codes (only for users with notifications enabled)
  const loadUserDiscounts = async (fid) => {
    try {
      console.log('🔍 === LOADING USER DISCOUNT CODES ===');
      console.log('FID:', fid);
      
      setUserDiscounts(prev => ({ ...prev, isLoading: true, error: null }));

      // First, check for pending discount from URL parameters (always allow these - they came from notifications)
      const pendingDiscount = getPendingDiscountCode();
      console.log('Pending discount from URL:', pendingDiscount);

      // Check if user has notifications enabled (required for database discount auto-population)
      let hasNotifications = false;
      try {
        const response = await fetch('/api/debug/notification-status-sync?' + new URLSearchParams({
          fid: fid.toString()
        }));
        const statusData = await response.json();
        hasNotifications = statusData.currentNeynarStatus || statusData.profile?.has_notifications || false;
        console.log('User notification status:', hasNotifications);
      } catch (error) {
        console.warn('Could not check notification status:', error);
        // Default to false if we can't check
        hasNotifications = false;
      }

      // Determine which discount to prioritize
      let activeDiscount = null;
      let discountSource = null;
      let eligibleTokenGatedDiscounts = []; // Will be populated by token-gating checks

      // Priority 1: Pending discount from URL (fresh notification click) - ALWAYS ALLOW
      if (pendingDiscount && pendingDiscount.discountCode) {
        activeDiscount = {
          code: pendingDiscount.discountCode,
          source: 'notification_click',
          displayText: '15% off', // Default for welcome codes
          isUsable: true,
          timestamp: pendingDiscount.timestamp
        };
        discountSource = 'notification_click';
        console.log('🎯 Using discount from notification click:', pendingDiscount.discountCode);
      } 
      // Priority 2: Check for token-gated auto-apply discounts via API
      else {
        console.log('🔍 Checking for token-gated auto-apply discounts...');
        console.log('🕐 HomePage.jsx token check starting - no pending discount found');
        
        try {
          // Check for eligible token-gated discounts via API (all scopes)
          // The API will fetch wallet addresses internally, no need to call user-wallet-data separately
          console.log('🏠 HomePage.jsx making token eligibility call (populates cache for ChatEligibilityPopup)');
          
          const eligibilityResponse = await fetch('/api/check-token-gated-eligibility', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fid,
              scope: 'all', // Check all discount scopes, not just site-wide
              productIds: [] // Empty for now, could be populated for specific products
            })
          });
          
          const eligibilityData = await eligibilityResponse.json();
          
          if (eligibilityData.success) {
            eligibleTokenGatedDiscounts = eligibilityData.eligibleDiscounts || [];
            console.log('Eligible token-gated discounts:', eligibleTokenGatedDiscounts);
            
            // Use the highest priority token-gated discount if available
            if (eligibleTokenGatedDiscounts.length > 0) {
              const topDiscount = eligibleTokenGatedDiscounts[0]; // Already sorted by priority
              activeDiscount = {
                code: topDiscount.code,
                source: 'token_gated',
                gating_type: topDiscount.gating_type,
                priority_level: topDiscount.priority_level,
                discount_description: topDiscount.discount_description,
                displayText: formatDiscountText(topDiscount),
                isUsable: true
              };
              discountSource = 'token_gated';
              console.log('🎫 Using token-gated discount:', topDiscount.code, 'Type:', topDiscount.gating_type);
            }
          } else {
            console.log('❌ Token-gating eligibility check failed:', eligibilityData.error);
          }
        } catch (error) {
          console.error('❌ Error checking token-gated discounts:', error);
          // Don't fail the entire flow, just skip token-gating
        }
      }

      // Priority 3: Best available discount from database - ONLY FOR USERS WITH NOTIFICATIONS
      if (!activeDiscount && hasNotifications) {
        console.log('✅ User has notifications enabled - loading database discounts');
        
        const bestDiscountResult = await getBestAvailableDiscount(fid, 'site_wide'); // Only site-wide discounts on homepage
        console.log('Best discount result:', bestDiscountResult);

        if (bestDiscountResult.success && bestDiscountResult.discountCode) {
          activeDiscount = bestDiscountResult.discountCode;
          discountSource = 'user_account';
          console.log('🎯 Using best available discount from account:', activeDiscount.code);
        }
      }
      // Priority 4: User doesn't have notifications and no token-gated discounts - no auto-discount
      else if (!activeDiscount) {
        console.log('❌ User does not have notifications enabled and no token-gated discounts found');
        console.log('💡 Users can still manually enter discount codes in the cart');
      }

      // Load welcome discount status (for display purposes)
      let welcomeDiscountResult = { hasDiscount: false };
      if (hasNotifications) {
        welcomeDiscountResult = await hasDiscountOfType(fid, 'welcome');
        console.log('Welcome discount status:', welcomeDiscountResult);
      }

      setUserDiscounts({
        isLoading: false,
        bestDiscount: activeDiscount,
        availableDiscounts: hasNotifications ? (await getBestAvailableDiscount(fid, 'site_wide')).alternativeCodes || [] : [],
        eligibleTokenGatedDiscounts, // Store all eligible token-gated discounts
        hasWelcomeDiscount: welcomeDiscountResult.hasDiscount,
        hasNotifications, // Store notification status for UI decisions
        discountSource,
        error: null
      });

      // If we have an active discount, show it as available but don't store for auto-application
      if (activeDiscount) {
        console.log('✅ Active discount available for user:', activeDiscount.code);
        console.log('💡 Discount will be automatically applied when user adds items to cart');
      } else {
        console.log('🔄 No discount available for user');
      }

      // Store user context for CartContext to use
      sessionStorage.setItem('userDiscountContext', JSON.stringify({
        hasNotifications,
        lastChecked: new Date().toISOString(),
        fid
      }));

    } catch (error) {
      console.error('❌ Error loading user discount codes:', error);
      setUserDiscounts({
        isLoading: false,
        bestDiscount: null,
        availableDiscounts: [],
        hasNotifications: false,
        error: error.message
      });
    }
  };

  // Helper function to format discount display text
  const formatDiscountText = (discount) => {
    if (discount.discount_type === 'percentage') {
      return `${discount.discount_value}% off`;
    } else if (discount.discount_type === 'fixed') {
      return `$${discount.discount_value} off`;
    }
    return 'Discount available';
  };

  const openCart = async () => {
    // Add haptic feedback for cart action
    try {
      const capabilities = await sdk.getCapabilities();
      if (capabilities.includes('haptics.impactOccurred')) {
        await sdk.haptics.impactOccurred('light');
      }
    } catch (error) {
      // Haptics not available, continue without feedback
      console.log('Haptics not available:', error);
    }
    
    setIsCartOpen(true);
  };
  
  const closeCart = () => setIsCartOpen(false);
  

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-2 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center pr-2">
            <img 
              src="/MintedMerchHeaderLogo.png" 
              alt="Minted Merch" 
              className="h-16"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Check-in Button - Only show in Farcaster */}
            {isInFarcaster && <CheckInButton />}
            
            {/* Info Button - Show for everyone, positioned between check-in and leaderboard */}
            <InfoButton />
            
            {/* Leaderboard Button - Only show in Farcaster */}
            {isInFarcaster && <LeaderboardButton />}
            
            {/* Profile Picture - Only show in Farcaster */}
            {isInFarcaster && user?.pfpUrl && (
              <button
                onClick={async () => {
                  // Add haptic feedback for profile picture selection
                  try {
                    const capabilities = await sdk.getCapabilities();
                    if (capabilities.includes('haptics.selectionChanged')) {
                      await sdk.haptics.selectionChanged();
                    }
                  } catch (error) {
                    console.log('Haptics not available:', error);
                  }
                  
                  // Trigger profile modal (we'll need to add this functionality)
                  const event = new CustomEvent('openProfileModal');
                  window.dispatchEvent(event);
                }}
                className="flex items-center justify-center w-12 h-12 rounded-lg transition-all hover:ring-2 hover:ring-[#3eb489] hover:ring-opacity-50"
                title="Profile"
              >
                <img 
                  src={user.pfpUrl} 
                  alt={user.displayName || user.username}
                  className="w-10 h-10 rounded-full border-2 border-gray-200"
                />
              </button>
            )}
            
                        {/* Cart Button */}
            <button
              onClick={openCart}
              className="flex items-center justify-center w-12 h-12 bg-[#3eb489] hover:bg-[#359970] text-white rounded-lg transition-colors"
              title="Open Cart"
            >
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
                </svg>
                
                {/* Item Count Badge */}
                {itemCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {itemCount > 99 ? '99+' : itemCount}
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>
      </header>
      
      <main>
        <ProductGrid products={products} />
      </main>
      
      {/* Cart Sidebar */}
      <Cart isOpen={isCartOpen} onClose={closeCart} />
      
    </div>
  );
} 