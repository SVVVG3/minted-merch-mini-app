'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/lib/CartContext';
import { CheckoutFlow } from './CheckoutFlow';
import { DiscountCodeSection } from './DiscountCodeSection';
import { useFarcaster } from '@/lib/useFarcaster';
import Link from 'next/link';

export function Cart({ isOpen, onClose }) {
  const { 
    cart, 
    removeItem, 
    updateQuantity, 
    clearCart, 
    updateNotes, 
    cartSubtotal, 
    cartTotal, 
    itemCount,
    applyDiscount,
    removeDiscount,
    evaluateOptimalDiscount
  } = useCart();
  const { getFid } = useFarcaster();
  const [localNotes, setLocalNotes] = useState(cart.notes || '');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Simple cart effect - just for cleanup when cart is empty
  useEffect(() => {
    const cartItems = Array.isArray(cart.items) ? cart.items : [];
    if (isOpen && cartItems.length === 0) {
      // Clear any applied discount when cart is empty
      if (cart.appliedDiscount) {
        console.log('🗑️ Cart is empty - clearing applied discount');
        removeDiscount();
        sessionStorage.removeItem('activeDiscountCode');
      }
    }
  }, [isOpen, cart.items, cart.appliedDiscount, removeDiscount]);

  // Check notification status from session storage (set by HomePage)
  const getNotificationStatus = () => {
    try {
      const activeDiscountData = sessionStorage.getItem('activeDiscountCode');
      if (activeDiscountData) {
        const activeDiscount = JSON.parse(activeDiscountData);
        // If they have a discount from notification click, they must have notifications
        if (activeDiscount.source === 'notification_click') {
          return true;
        }
      }
      
      // Check if user discount data indicates notification status
      const userDiscountContext = sessionStorage.getItem('userDiscountContext');
      if (userDiscountContext) {
        const discountContext = JSON.parse(userDiscountContext);
        return discountContext.hasNotifications;
      }
      
      return null; // Unknown status
    } catch (error) {
      console.error('Error checking notification status:', error);
      return null;
    }
  };
  
  if (!isOpen) return null;
  
  // Safety check - ensure cart is properly initialized
  if (!cart || typeof cart !== 'object') {
    console.warn('Cart state is not properly initialized:', cart);
    return null;
  }
  
  // Ensure cart.items is always an array
  const safeCart = {
    ...cart,
    items: Array.isArray(cart.items) ? cart.items : []
  };

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
    setShowClearConfirm(true);
  };

  const confirmClearCart = () => {
    clearCart();
    setLocalNotes('');
    setShowClearConfirm(false);
  };

  const cancelClearCart = () => {
    setShowClearConfirm(false);
  };

  const handleDiscountApplied = (discount) => {
    console.log('💰 Discount applied in cart:', discount);
    applyDiscount(discount);
  };

  const handleDiscountRemoved = () => {
    console.log('🗑️ Discount removed from cart');
    removeDiscount();
  };

  // Checkout is now handled by the CheckoutFlow component

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Cart Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 flex flex-col" style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6), 0 10px 30px rgba(0, 0, 0, 0.4)' }}>
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
          {safeCart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
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
              
              {safeCart.items.map((item) => (
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
                  Include NFT token #, OpenSea URLs, or any customization requests. Scroll down to apply a discount!
                </p>
              </div>

              {/* Discount Code Section */}
              <div className="border-t pt-4 mt-6">
                <DiscountCodeSection
                  onDiscountApplied={handleDiscountApplied}
                  onDiscountRemoved={handleDiscountRemoved}
                  subtotal={cartSubtotal}
                  autoPopulate={true}
                  hasNotifications={getNotificationStatus()}
                  showNotificationPrompt={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {safeCart.items.length > 0 && (
          <div className="border-t p-4 space-y-4">
            {/* Action Buttons Row */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  const notesElement = document.getElementById('cart-notes');
                  if (notesElement) {
                    notesElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    notesElement.focus();
                  }
                }}
                className="text-sm text-[#3eb489] hover:text-[#359970] transition-colors py-2 flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Add Notes
              </button>
              
              <button
                onClick={handleClearCart}
                className="text-sm text-red-600 hover:text-red-700 transition-colors py-2"
              >
                Clear Cart
              </button>
            </div>

            {/* Total Summary */}
            <div className="space-y-2">
              {/* Subtotal */}
              <div className="flex justify-between items-center text-sm">
                <span>Subtotal:</span>
                <span>${cartSubtotal.toFixed(2)} USD</span>
              </div>
              
              {/* Discount Line */}
              {cart.appliedDiscount && (
                <div className="flex justify-between items-center text-sm text-green-600">
                  <span>Discount ({cart.appliedDiscount.discountType === 'fixed' ? `$${cart.appliedDiscount.discountValue}` : `${cart.appliedDiscount.discountValue}%`}):</span>
                  <span>-${(cartSubtotal - cartTotal).toFixed(2)} USD</span>
                </div>
              )}
              
              {/* Total */}
              <div className="flex justify-between items-center text-lg font-semibold border-t pt-2">
                <span>Total:</span>
                <span>
                  {(() => {
                    // NEW LOGIC:
                    // - $0.00 exactly with free shipping: Show FREE (uses signature claim, no processing fee!)
                    // - $0.01 - $0.24 with discount: Round up to $0.25 (Daimo Pay minimum)
                    // - $0.25+: Show exact amount
                    if (cartTotal === 0 && cart.appliedDiscount?.freeShipping) {
                      return <span className="text-green-600">FREE</span>;
                    }
                    if (cartTotal > 0 && cartTotal < 0.25 && cart.appliedDiscount?.freeShipping) {
                      return <span className="text-green-600">$0.25 <span className="text-xs">(min fee)</span></span>;
                    }
                    return `$${cartTotal.toFixed(2)} USD`;
                  })()}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <CheckoutFlow />

            <p className="text-xs text-gray-500 text-center">
              Pay using 1200+ coins across 20+ chains
            </p>
          </div>
        )}
      </div>

      {/* Custom Clear Cart Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Clear Cart?</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to clear your cart? This will remove all items and notes.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={cancelClearCart}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearCart}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Clear Cart
              </button>
            </div>
          </div>
        </div>
      )}
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
        {(item.variant?.image?.url || item.product.image?.url) ? (
          <img
            src={item.variant?.image?.url || item.product.image.url}
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
            {item.variant && item.variant.title && item.variant.title !== 'Default Title' && (
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