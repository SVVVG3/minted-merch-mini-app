'use client';

import { useState, useEffect } from 'react';
import { ProductGrid } from './ProductGrid';
import { Cart } from './Cart';
import { CheckInButton } from './CheckInButton';
import { LeaderboardButton } from './LeaderboardButton';
import { InfoButton } from './InfoButton';
import { ProfileModal } from './ProfileModal';
import { CollectionSelector } from './CollectionSelector';
import { SignInWithFarcaster } from './SignInWithFarcaster';
import { WalletConnectButton } from './WalletConnectButton';
import { CompactWalletStatus } from './CompactWalletStatus';
import { useCart } from '@/lib/CartContext';
import { useFarcaster } from '@/lib/useFarcaster';
import { useDgenWallet } from '@/lib/useDgenWallet';
import { useWalletConnectContext } from './WalletConnectProvider';
import { ShareDropdown } from './ShareDropdown';
import { ChatWidget } from './ChatWidget';
import { extractNotificationParams, storeNotificationContext, getPendingDiscountCode } from '@/lib/urlParams';
import { sdk } from '@farcaster/miniapp-sdk';
// Token-gating functions moved to API routes to avoid client-side Node.js imports
// import { getEligibleAutoApplyDiscounts } from '@/lib/tokenGating';
// import { fetchUserWalletData } from '@/lib/walletUtils';

export function HomePage({ collection: initialCollection, products: initialProducts }) {
  const { itemCount, cartTotal } = useCart();
  const { isInFarcaster, isReady, isLoading: isFarcasterLoading, getFid, getUsername, getDisplayName, getPfpUrl, user, context, hasNotifications, getNotificationDetails, getSessionToken } = useFarcaster();
  const { isDgen, isChecking: isDgenChecking } = useDgenWallet(); // Auto-connect dGEN1 wallet
  const { isConnected: isWalletConnected, userAddress: walletAddress, connectionMethod, shouldUseWC, isWCAvailable, canConnect } = useWalletConnectContext();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [notificationContext, setNotificationContext] = useState(null);
  const [userDiscounts, setUserDiscounts] = useState({
    isLoading: true,
    bestDiscount: null,
    availableDiscounts: [],
    error: null
  });

  // Collection and product state management
  const [selectedCollection, setSelectedCollection] = useState(initialCollection);
  const [products, setProducts] = useState(initialProducts || []);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState(null);

  // Function to fetch products for a specific collection
  const fetchProductsForCollection = async (collection) => {
    if (!collection?.handle) {
      console.error('No collection handle provided');
      return;
    }

    try {
      setIsLoadingProducts(true);
      setProductsError(null);
      
      console.log(`🛍️ Fetching products for collection: ${collection.title} (${collection.handle})`);
      
      const response = await fetch(`/api/shopify/collections?handle=${collection.handle}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch collection products: ${response.status}`);
      }
      
      const collectionData = await response.json();
      
      if (collectionData && collectionData.products) {
        const fetchedProducts = collectionData.products.edges.map(edge => edge.node);
        setProducts(fetchedProducts);
        console.log(`✅ Loaded ${fetchedProducts.length} products for collection: ${collection.title}`);
      } else {
        setProducts([]);
        console.log(`⚠️ No products found for collection: ${collection.title}`);
      }
    } catch (error) {
      console.error('Error fetching products for collection:', error);
      setProductsError(error.message);
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Handle collection change
  const handleCollectionChange = (collection) => {
    console.log(`🔄 Collection changed to: ${collection.title} (${collection.handle})`);
    setSelectedCollection(collection);
    fetchProductsForCollection(collection);
  };

  // Share collection function
  // Handle staking link click with haptics
  const handleStakingClick = async (e) => {
    e.preventDefault();
    try {
      const capabilities = await sdk.getCapabilities();
      if (capabilities.includes('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
      }
    } catch (error) {
      console.log('Haptics not available:', error);
    }
    window.location.href = '/stake';
  };


  // URL Parameter Detection - Detect notification clicks, discount codes, and collection sharing
  useEffect(() => {
    console.log('🔍 === URL PARAMETER DETECTION ===');
    
    // Check for shared collection parameter
    const urlParams = new URLSearchParams(window.location.search);
    const sharedCollectionHandle = urlParams.get('collection');
    
    // Check for showProfile parameter (from scores share)
    const showProfile = urlParams.get('showProfile');
    if (showProfile === 'true') {
      console.log('👤 Opening profile modal from URL parameter');
      setIsProfileModalOpen(true);
      // Clean up URL
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('showProfile');
      window.history.replaceState({}, '', newUrl);
    }
    
    if (sharedCollectionHandle && !selectedCollection) {
      console.log('🔗 Shared collection detected:', sharedCollectionHandle);
      // We'll handle this after collections are loaded
    }
    
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

  // Load user discounts after registration (registration now handled in useFarcaster)
  useEffect(() => {
    if (!isInFarcaster || !isReady) return;
    
    const userFid = getFid();
    if (!userFid) return;

    // Load discounts with delay to ensure centralized registration completes first
    const timer = setTimeout(() => {
      console.log('📦 Loading discounts for user:', userFid);
      loadUserDiscounts(userFid);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [isInFarcaster, isReady]); // Registration now handled in useFarcaster hook

  // Notification status is now handled by frame.js via SDK events (notificationsEnabled/notificationsDisabled)
  // No need for polling - the SDK events automatically update the database

  // Handle shared collection URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedCollectionHandle = urlParams.get('collection');
    
    console.log('🔍 Collection URL parameter check:', {
      sharedCollectionHandle,
      isLoadingProducts,
      selectedCollection: selectedCollection?.title,
      hasSelectedCollection: !!selectedCollection
    });
    
    if (sharedCollectionHandle && !isLoadingProducts && !selectedCollection) {
      console.log('🔗 Processing shared collection:', sharedCollectionHandle);
      
      // Find the collection by handle from the CollectionSelector's loaded collections
      const checkForCollection = async () => {
        try {
          const response = await fetch('/api/shopify/collections');
          if (response.ok) {
            const collections = await response.json();
            console.log('📋 Available collections:', collections.map(c => ({ handle: c.handle, title: c.title })));
            
            const targetCollection = collections.find(c => c.handle === sharedCollectionHandle);
            
            if (targetCollection) {
              console.log('✅ Found shared collection:', targetCollection.title);
              setSelectedCollection(targetCollection);
              fetchProductsForCollection(targetCollection);
              
              // Clean up URL parameter
              const newUrl = new URL(window.location);
              newUrl.searchParams.delete('collection');
              window.history.replaceState({}, '', newUrl);
            } else {
              console.log('⚠️ Shared collection not found:', sharedCollectionHandle);
              console.log('Available handles:', collections.map(c => c.handle));
            }
          } else {
            console.error('❌ Failed to fetch collections:', response.status);
          }
        } catch (error) {
          console.error('Error loading shared collection:', error);
        }
      };
      
      checkForCollection();
    }
  }, [isLoadingProducts, selectedCollection]);

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
      // Use SDK context directly - no API call needed
      const userHasNotifications = hasNotifications();

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
      if (!activeDiscount && userHasNotifications) {
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

      // Load welcome discount status and available discounts via API (for users with notifications)
      let welcomeDiscountResult = { hasDiscount: false };
      let availableDiscounts = [];
      
      if (userHasNotifications) {
        try {
          // Check for welcome discount via API
          const welcomeResponse = await fetch(`/api/user-discounts?fid=${fid}&mode=check&type=welcome`);
          const welcomeData = await welcomeResponse.json();
          welcomeDiscountResult = { hasDiscount: welcomeData.hasDiscount || false };
          console.log('Welcome discount status:', welcomeDiscountResult);
          
          // Get best available discount via API (only if no token-gated discount found)
          if (!activeDiscount) {
            const bestResponse = await fetch(`/api/user-discounts?fid=${fid}&mode=best&scope=site_wide`);
            const bestData = await bestResponse.json();
            if (bestData.success && bestData.discountCode) {
              activeDiscount = bestData.discountCode;
              discountSource = 'user_account';
              console.log('🎯 Using best available discount from account:', activeDiscount.code);
            }
            availableDiscounts = bestData.alternativeCodes || [];
          }
        } catch (error) {
          console.warn('Could not load database discounts:', error);
        }
      }

      setUserDiscounts({
        isLoading: false,
        bestDiscount: activeDiscount,
        availableDiscounts: availableDiscounts,
        eligibleTokenGatedDiscounts, // Store all eligible token-gated discounts
        hasWelcomeDiscount: welcomeDiscountResult.hasDiscount,
        hasNotifications: userHasNotifications, // Store notification status for UI decisions
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
        hasNotifications: userHasNotifications,
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
      {/* Green Banner - Show different message based on auth status */}
      {!isInFarcaster && (
        <div className="bg-[#3eb489] text-white px-4 py-2 text-xs">
          <div className="flex items-center justify-center">
            <div className="text-center">
              {!user && isReady ? (
                <div>
                  Sign in with Farcaster to access your profile, daily check-ins, leaderboard, notifications, order history, and token gated discounts! Stake 50M+{' '}
                  <a 
                    href="https://coin.mintedmerch.shop" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-white/90 transition-colors"
                  >
                    $mintedmerch
                  </a>
                  {' '}to become a Merch Mogul 🤌
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div>
                    Shop using 1200+ coins across 20+ chains!{' '}
                    <button onClick={handleStakingClick} className="underline font-bold hover:text-yellow-200 transition-colors">Staking is LIVE</button>
                  </div>
                  <div>
                    Stake 50M+{' '}
                    <a 
                      href="https://coin.mintedmerch.shop" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-white/90 transition-colors"
                    >
                      $mintedmerch
                    </a>
                    {' '}to become a Merch Mogul 🤌
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <header className="bg-white shadow-sm sticky top-0">
        <div className="px-2 py-1.5 flex items-center justify-between">
          {/* Logo - different logo for mini app vs browser */}
          <div className="flex items-center pr-2">
            {isFarcasterLoading ? (
              // Placeholder while detecting environment to prevent logo flash
              <div className="h-12 w-28 bg-gray-100 animate-pulse rounded" />
            ) : (
              <img 
                src={isInFarcaster ? "/MintedMerchHeaderLogo.png" : "/MintedMerchSpinnerLogo.png"}
                alt="Minted Merch" 
                className="h-12 max-w-[150px] object-contain"
              />
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Sign In Button - Only show when NOT authenticated and NOT in mini app */}
            {!user && !isInFarcaster && isReady && (
              <div className="w-24">
                <SignInWithFarcaster />
              </div>
            )}
            
            {/* WalletConnect UI - Show for desktop users (signed in or not) who don't have a wallet */}
            {!isInFarcaster && !isWalletConnected && (shouldUseWC || canConnect) && (
              <WalletConnectButton 
                className="flex items-center justify-center h-12 px-3 text-sm transition-colors"
              />
            )}
            
            {/* Compact Wallet Status - Show when connected via WalletConnect */}
            {!isInFarcaster && isWalletConnected && connectionMethod === 'walletconnect' && (
              <CompactWalletStatus />
            )}
            
            {/* Check-in Button - Show for authenticated users (mini app OR AuthKit) */}
            {user && <CheckInButton />}
            
            {/* Leaderboard Button - Show for authenticated users (mini app OR AuthKit) */}
            {user && <LeaderboardButton />}
            
            {/* Info Button - Show for everyone, positioned after sign in */}
            <InfoButton />
            
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
            
            {/* Profile Picture - Show for authenticated users (mini app OR AuthKit) */}
            {user?.pfpUrl && (
              <button
                onClick={async () => {
                  // Add haptic feedback for profile picture selection (only in mini app)
                  if (isInFarcaster) {
                    try {
                      const capabilities = await sdk.getCapabilities();
                      if (capabilities.includes('haptics.selectionChanged')) {
                        await sdk.haptics.selectionChanged();
                      }
                    } catch (error) {
                      console.log('Haptics not available:', error);
                    }
                  }
                  
                  // Open profile modal directly
                  setIsProfileModalOpen(true);
                }}
                className="flex items-center justify-center w-12 h-12 rounded-lg transition-all hover:ring-2 hover:ring-[#3eb489] hover:ring-opacity-50"
                title="Profile"
              >
                <img 
                  src={user.pfpUrl} 
                  alt={user.displayName || user.username}
                  className="w-12 h-12 rounded-full border-2 border-[#3eb489]"
                />
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* Collection Selector Section - Sticky below header */}
      <div className="bg-[#3eb489] px-4 py-1.5 sticky top-[60px]">
        <div className="flex justify-center items-center gap-2">
          <div className="w-full max-w-[250px]">
            <CollectionSelector
              selectedCollection={selectedCollection}
              onCollectionChange={handleCollectionChange}
              className="w-full"
            />
          </div>
          
          {/* Share Collection Dropdown - Show for all users */}
          {selectedCollection && (
            <ShareDropdown
              type="collection"
              handle={selectedCollection.handle}
              title={selectedCollection.title}
              isInFarcaster={isInFarcaster}
            />
          )}
          
          {/* Chat Widget Button */}
          <ChatWidget />
        </div>
      </div>
      
      <main>
        {/* Loading State */}
        {isLoadingProducts && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading products...</p>
            </div>
          </div>
        )}
        
        {/* Error State */}
        {productsError && !isLoadingProducts && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-red-500 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-600 font-medium">Error loading products</p>
              <p className="text-gray-600 text-sm mt-1">{productsError}</p>
              <button
                onClick={() => selectedCollection && fetchProductsForCollection(selectedCollection)}
                className="mt-3 px-4 py-2 bg-[#3eb489] text-white rounded-lg hover:bg-[#359970] transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
        
        {/* Products Grid */}
        {!isLoadingProducts && !productsError && (
          <ProductGrid products={products} />
        )}
      </main>
      
      {/* Cart Sidebar */}
      <Cart isOpen={isCartOpen} onClose={closeCart} />
      
      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
      
    </div>
  );
} 