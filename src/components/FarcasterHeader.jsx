'use client';

import { useState } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { useCart } from '@/lib/CartContext';
import { Cart } from './Cart';

export function FarcasterHeader() {
  const { user, isLoading, isInFarcaster } = useFarcaster();
  const { itemCount, cartTotal } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  // Don't render if not in Farcaster context
  if (!isInFarcaster || !user) {
    return (
      // Show cart button even when not in Farcaster context
      <div className="bg-gray-100 px-4 py-2">
        <div className="flex items-center justify-end">
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
        <Cart isOpen={isCartOpen} onClose={closeCart} />
      </div>
    );
  }

      return (
      <>
        <div className="bg-[#3eb489] text-white px-4 py-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {user.pfpUrl && (
                <img 
                  src={user.pfpUrl} 
                  alt={user.displayName || user.username}
                  className="w-6 h-6 rounded-full"
                />
              )}
              <span>
                Hey {user.displayName || user.username}! 👋
              </span>
            </div>
            <div className="flex items-center">
              <button
                onClick={openCart}
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
                title="Open Cart"
              >
                <div className="relative">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <span className="text-xs font-medium">
                    ${cartTotal.toFixed(2)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
        <Cart isOpen={isCartOpen} onClose={closeCart} />
      </>
    );
} 