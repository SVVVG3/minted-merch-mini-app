'use client';

import { useState } from 'react';
import { useCart } from '@/lib/CartContext';
import Link from 'next/link';

export function Cart({ isOpen, onClose }) {
  const { cart, removeItem, updateQuantity, clearCart, updateNotes, cartTotal, itemCount } = useCart();
  const [localNotes, setLocalNotes] = useState(cart.notes || '');
  
  if (!isOpen) return null;

  const handleQuantityChange = (itemKey, newQuantity) => {
    if (newQuantity <= 0) {
      removeItem(itemKey);
    } else {
      updateQuantity(itemKey, newQuantity);
    }
  };

  const handleNotesChange = (e) => {
    const notes = e.target.value;
    setLocalNotes(notes);
    updateNotes(notes);
  };

  const handleClearCart = () => {
    if (window.confirm('Are you sure you want to clear your cart? This will remove all items and notes.')) {
      clearCart();
      setLocalNotes('');
    }
  };

  const handleCheckout = () => {
    // This will be implemented in the next phase (USDC payment)
    alert('Checkout functionality will be implemented in the next phase!');
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Cart Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Shopping Cart ({itemCount})
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cart Content */}
        <div className="flex-1 overflow-y-auto">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6M20 13v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-gray-500 mb-6">Add some items to get started!</p>
              <button
                onClick={onClose}
                className="bg-[#3eb489] text-white px-6 py-2 rounded-lg hover:bg-[#359970] transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {cart.items.map((item) => (
                <CartItem
                  key={item.key}
                  item={item}
                  onQuantityChange={handleQuantityChange}
                  onRemove={() => removeItem(item.key)}
                />
              ))}
              
              {/* Notes Section */}
              <div className="border-t pt-4 mt-6">
                <label htmlFor="cart-notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Order Notes
                </label>
                <textarea
                  id="cart-notes"
                  value={localNotes}
                  onChange={handleNotesChange}
                  placeholder="Add any special instructions or notes for your order..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#3eb489] focus:border-transparent"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Include NFT token #, OpenSea URLs, or any customization requests
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.items.length > 0 && (
          <div className="border-t p-4 space-y-4">
            {/* Clear Cart Button */}
            <button
              onClick={handleClearCart}
              className="w-full text-sm text-red-600 hover:text-red-700 transition-colors py-2"
            >
              Clear Cart
            </button>

            {/* Total */}
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total:</span>
              <span>${cartTotal.toFixed(2)} USD</span>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              className="w-full bg-[#3eb489] text-white py-3 rounded-lg hover:bg-[#359970] transition-colors font-medium"
            >
              Checkout with USDC
            </button>

            <p className="text-xs text-gray-500 text-center">
              Pay with USDC on Base network
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function CartItem({ item, onQuantityChange, onRemove }) {
  const [quantity, setQuantity] = useState(item.quantity);

  const handleQuantityUpdate = (newQuantity) => {
    setQuantity(newQuantity);
    onQuantityChange(item.key, newQuantity);
  };

  const itemTotal = (item.price * item.quantity).toFixed(2);

  return (
    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
      {/* Product Image */}
      <div className="w-16 h-16 bg-gray-200 rounded-md overflow-hidden flex-shrink-0">
        {item.product.image?.url ? (
          <img
            src={item.product.image.url}
            alt={item.product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-2">
          <div>
            <Link 
              href={`/product/${item.product.handle}`}
              className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-2"
            >
              {item.product.title}
            </Link>
            {item.variant && (
              <p className="text-xs text-gray-500 mt-1">
                {item.variant.title}
              </p>
            )}
          </div>
          <button
            onClick={onRemove}
            className="p-1 hover:bg-gray-200 rounded transition-colors ml-2"
            title="Remove item"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Price and Quantity */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleQuantityUpdate(quantity - 1)}
              className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
              disabled={quantity <= 1}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <span className="text-sm font-medium w-8 text-center">{quantity}</span>
            
            <button
              onClick={() => handleQuantityUpdate(quantity + 1)}
              className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900">
              ${itemTotal}
            </div>
            <div className="text-xs text-gray-500">
              ${item.price.toFixed(2)} each
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 