'use client';

import { useState, useEffect } from 'react';
import { ProductGrid } from './ProductGrid';
import { Cart } from './Cart';
import { OrderHistory } from './OrderHistory';
import { useCart } from '@/lib/CartContext';
import { useFarcaster } from '@/lib/useFarcaster';

export function HomePage({ collection, products }) {
  const { itemCount, cartTotal } = useCart();
  const { isInFarcaster, isReady, getFid, getUsername, getDisplayName, getPfpUrl, user } = useFarcaster();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);

  // Register user profile when they visit the app (notifications handled by Farcaster)
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
          bio: user?.bio || null, // Try to get bio from user context
          pfpUrl: getPfpUrl() || null
        };

        console.log('Registering user profile with data:', userData);
        
        // Register user profile only (notifications are handled by Farcaster webhooks)
        const response = await fetch('/api/register-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            userFid,
            userData
            // No notificationToken - handled by Farcaster Mini App system
          }),
        });
        
        const result = await response.json();
        console.log('User profile registration result:', result);
        
        if (result.success) {
          console.log('✅ User profile successfully registered!');
          
          if (result.profile.isNew) {
            console.log('🎉 New user profile created');
          } else {
            console.log('👤 Existing user profile updated');
          }
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
  }, [isInFarcaster, isReady, getFid, getUsername, getDisplayName, getPfpUrl, user]);

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
            <p className="text-xs text-gray-500 mt-0.5">Pay with USDC on Base</p>
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
        <ProductGrid products={products} />
      </main>
      
      {/* Cart Sidebar */}
      <Cart isOpen={isCartOpen} onClose={closeCart} />
      
      {/* Order History Modal */}
      <OrderHistory isOpen={isOrderHistoryOpen} onClose={closeOrderHistory} />
    </div>
  );
} 