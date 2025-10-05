'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/lib/CartContext';
import { Cart } from './Cart';

export function CartIndicator() {
  const { itemCount, cartTotal } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [justAddedItem, setJustAddedItem] = useState(false);
  const [previousItemCount, setPreviousItemCount] = useState(0);

  // Detect when items are added to cart
  useEffect(() => {
    if (itemCount > previousItemCount && previousItemCount > 0) {
      setJustAddedItem(true);
      setTimeout(() => setJustAddedItem(false), 2000); // Hide after 2 seconds
    }
    setPreviousItemCount(itemCount);
  }, [itemCount, previousItemCount]);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  return (
    <>
      {/* Cart Button */}
      <button
        onClick={openCart}
        className={`fixed top-4 right-4 text-white p-3 rounded-full shadow-lg z-30 transition-all duration-300 ${
          justAddedItem 
            ? 'bg-green-500 transform scale-110' 
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
        title="Open Cart"
      >
        <div className="relative">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
          </svg>
          
          {/* Item Count Badge */}
          {itemCount > 0 && (
            <div className={`absolute -top-2 -right-2 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center transition-all duration-300 ${
              justAddedItem ? 'bg-green-600 animate-pulse' : 'bg-red-500'
            }`}>
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