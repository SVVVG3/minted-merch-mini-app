'use client';

import { useCart } from '@/lib/CartContext';

export function CartIndicator() {
  const { itemCount, cartTotal } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed top-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg z-50">
      <div className="text-sm font-medium">
        Cart: {itemCount} {itemCount === 1 ? 'item' : 'items'}
      </div>
      <div className="text-xs">
        ${cartTotal.toFixed(2)}
      </div>
    </div>
  );
} 