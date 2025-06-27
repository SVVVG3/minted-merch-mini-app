'use client';

import { useState } from 'react';
import { useCart } from '@/lib/CartContext';
import { Cart } from './Cart';

export function CartIndicator() {
  const { itemCount, cartTotal } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  return (
    <>
      {/* Cart Button */}
      <button
        onClick={openCart}
        className="fixed top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg z-30 transition-colors"
        title="Open Cart"
      >
        <div className="relative">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6M7 13l-1.5-6" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="20" cy="19" r="1" />
          </svg>
          
          {/* Item Count Badge */}
          {itemCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {itemCount > 99 ? '99+' : itemCount}
            </div>
          )}
        </div>
      </button>

      {/* Cart Total Preview (only show if items in cart) */}
      {itemCount > 0 && (
        <div className="fixed top-16 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-30">
          <div className="text-xs text-gray-600 text-center">
            ${cartTotal.toFixed(2)}
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      <Cart isOpen={isCartOpen} onClose={closeCart} />
    </>
  );
} 