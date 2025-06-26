'use client';

import { useState, useEffect } from 'react';
import { ProductGrid } from './ProductGrid';
import { Cart } from './Cart';
import { OrderHistory } from './OrderHistory';
import { NotificationPrompt } from './NotificationPrompt';
import { useCart } from '@/lib/CartContext';
import { useFarcaster } from '@/lib/useFarcaster';

export function HomePage({ collection, products }) {
  const { itemCount, cartTotal } = useCart();
  const { isInFarcaster, isReady, getFid, getUsername, getDisplayName, getPfpUrl, user } = useFarcaster();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(false);

  // Register user profile when they visit the app (without notifications initially)
  useEffect(() => {
    const registerUserProfile = async () => {
      // Only register if we're in Farcaster and have user data
      if (!isInFarcaster || !isReady) return;
      
      const userFid = getFid();
      if (!userFid) return;
      
      try {
        console.log('=== REGISTERING USER PROFILE ===');
        console.log('User FID:', userFid);
        console.log('User Data:', user);
        
        // Prepare user data for registration
        const userData = {
          username: getUsername() || `user_${userFid}`,
          displayName: getDisplayName() || null,
          bio: null, // We don't have bio from Farcaster context
          pfpUrl: getPfpUrl() || null
        };

        console.log('Registering user profile with data:', userData);
        
        // Register user profile without notification token initially
        const response = await fetch('/api/register-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            userFid,
            userData
            // No notificationToken - user will enable separately
          }),
        });
        
        const result = await response.json();
        console.log('User profile registration result:', result);
        
        setRegistrationStatus(result);
        
        if (result.success) {
          console.log('✅ User profile successfully registered!');
          
          if (result.profile.isNew) {
            console.log('🎉 New user profile created - show notification prompt');
            // Show notification prompt for new users after a delay
            setTimeout(() => setShowNotificationPrompt(true), 2000);
          } else {
            console.log('👤 Existing user profile updated');
            // For existing users, check if they already have notifications enabled
            checkNotificationStatus(userFid);
          }
        } else {
          console.error('❌ User profile registration failed:', result.error);
        }
        
      } catch (error) {
        console.error('Error registering user profile:', error);
        setRegistrationStatus({
          success: false,
          error: error.message
        });
      }
    };

    // Small delay to ensure Farcaster context is fully loaded
    const timer = setTimeout(registerUserProfile, 1000);
    return () => clearTimeout(timer);
  }, [isInFarcaster, isReady, getFid, getUsername, getDisplayName, getPfpUrl, user]);

  // Check if user already has notifications enabled
  const checkNotificationStatus = async (userFid) => {
    try {
      const response = await fetch(`/api/debug/supabase-test?testType=token&userFid=${userFid}`);
      const result = await response.json();
      
      if (result.tests?.token?.success && result.tests.token.operations?.initial_get?.token) {
        console.log('✅ User already has notifications enabled');
        setHasNotifications(true);
      } else {
        console.log('❌ User does not have notifications enabled');
        setShowNotificationPrompt(true);
      }
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  };

  const handleNotificationEnabled = (result) => {
    console.log('🎉 Notifications successfully enabled!', result);
    setHasNotifications(true);
    setShowNotificationPrompt(false);
    
    // Update registration status to reflect notification enablement
    setRegistrationStatus(prev => ({
      ...prev,
      notifications: result.notifications
    }));
  };

  const handleDismissNotificationPrompt = () => {
    setShowNotificationPrompt(false);
    console.log('User dismissed notification prompt');
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const openOrderHistory = () => setIsOrderHistoryOpen(true);
  const closeOrderHistory = () => setIsOrderHistoryOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {collection?.title || 'All Products'}
            </h1>
            <div className="flex items-center space-x-2">
              <p className="text-xs text-gray-500 mt-0.5">Pay with USDC on Base</p>
              
              {/* Registration Status Indicator (for debugging) */}
              {isInFarcaster && registrationStatus && (
                <div className="flex items-center space-x-1">
                  {registrationStatus.success ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-green-600">
                        {registrationStatus.profile?.isNew ? 'Registered' : 'Updated'}
                      </span>
                      {hasNotifications && (
                        <>
                          <div className="w-2 h-2 bg-blue-500 rounded-full ml-1"></div>
                          <span className="text-xs text-blue-600">Notifications on</span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-xs text-red-600">Registration failed</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Order History Button - Only show in Farcaster */}
            {isInFarcaster && (
              <button
                onClick={openOrderHistory}
                className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                title="Order History"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </button>
            )}
            
            {/* Cart Button */}
            <button
            onClick={openCart}
            className="flex items-center space-x-2 bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-2 rounded-lg transition-colors"
            title="Open Cart"
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6M20 13v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6" />
              </svg>
              
              {/* Item Count Badge */}
              {itemCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {itemCount > 99 ? '99+' : itemCount}
                </div>
              )}
            </div>
            {itemCount > 0 && (
              <span className="text-sm font-medium">
                ${cartTotal.toFixed(2)}
              </span>
            )}
          </button>
          </div>
        </div>
      </header>
      
      <main>
        {/* Notification Prompt - Only show in Farcaster for users without notifications */}
        {isInFarcaster && showNotificationPrompt && !hasNotifications && (
          <div className="px-4 pt-4">
            <NotificationPrompt
              userFid={getFid()}
              onNotificationEnabled={handleNotificationEnabled}
              onDismiss={handleDismissNotificationPrompt}
            />
          </div>
        )}
        
        <ProductGrid products={products} />
      </main>
      
      {/* Cart Sidebar */}
      <Cart isOpen={isCartOpen} onClose={closeCart} />
      
      {/* Order History Modal */}
      <OrderHistory isOpen={isOrderHistoryOpen} onClose={closeOrderHistory} />
    </div>
  );
} 