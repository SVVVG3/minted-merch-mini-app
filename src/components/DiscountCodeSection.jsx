'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { useCart } from '@/lib/CartContext';

// Helper function to get token-gating display text
const getTokenGatingDisplayText = (gatingType) => {
  switch (gatingType) {
    case 'nft_holding':
      return 'NFT holder';
    case 'token_balance':
      return 'Token holder';
    case 'whitelist_fid':
      return 'VIP member';
    case 'whitelist_wallet':
      return 'Whitelisted wallet';
    case 'combined':
      return 'Exclusive eligibility';
    default:
      return 'Token-gated';
  }
};

export function DiscountCodeSection({ 
  onDiscountApplied, 
  onDiscountRemoved, 
  subtotal, 
  autoPopulate = false 
}) {
  const { getFid } = useFarcaster();
  const { cart, cartSubtotal, cartTotal, items: cartItems, isEvaluatingDiscount } = useCart();
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  
  // Use cart's applied discount if available, otherwise use local state
  const effectiveAppliedDiscount = cart.appliedDiscount || appliedDiscount;
  const [tokenGatingInfo, setTokenGatingInfo] = useState(null);

  // Simple effect to sync with cart's applied discount
  useEffect(() => {
    if (cart.appliedDiscount) {
      setAppliedDiscount(cart.appliedDiscount);
      
      // Store token-gating information if available
      if (cart.appliedDiscount.isTokenGated) {
        setTokenGatingInfo({
          isTokenGated: true,
          gatingType: cart.appliedDiscount.gatingType,
          description: cart.appliedDiscount.description,
          priorityLevel: cart.appliedDiscount.priority_level
        });
      }
    } else {
      setAppliedDiscount(null);
      setTokenGatingInfo(null);
    }
  }, [cart.appliedDiscount]);



  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
    setDiscountError(null);
    // setHasAutoPopulated(false); // This state is removed
    setTokenGatingInfo(null);

    // Clear from session storage
    try {
      sessionStorage.removeItem('activeDiscountCode');
    } catch (error) {
      console.error('Error clearing session storage:', error);
    }

    // Notify parent component
    if (onDiscountRemoved) {
      onDiscountRemoved();
    }

    console.log('🗑️ Discount removed');
  };



  // Helper function to calculate actual discount amount (product-aware)
  const calculateActualDiscountAmount = () => {
    if (!effectiveAppliedDiscount) return 0;
    
    // The actual discount amount is the difference between subtotal and total (from cart context)
    const actualDiscountAmount = cartSubtotal - cartTotal;
    
    console.log(`📊 Discount Display: subtotal=$${cartSubtotal.toFixed(2)}, total=$${cartTotal.toFixed(2)}, actual discount=$${actualDiscountAmount.toFixed(2)}`);
    
    return actualDiscountAmount;
  };

  const userFid = getFid();
  const isAuthenticated = !!userFid;

  console.log('🎨 DiscountCodeSection render state:', {
    effectiveAppliedDiscount: !!effectiveAppliedDiscount,
    effectiveAppliedDiscountCode: effectiveAppliedDiscount?.code,
    isEvaluatingDiscount,
    isAuthenticated,
    cartHasItems: Array.isArray(cartItems) ? cartItems.length > 0 : false
  });

  return (
    <div className={`space-y-3 border border-gray-200 rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Discount Code</h3>
        {effectiveAppliedDiscount && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
            {tokenGatingInfo?.isTokenGated 
              ? `🎫 ${getTokenGatingDisplayText(tokenGatingInfo.gatingType)}` 
              : 'Auto-applied'
            }
          </span>
        )}
      </div>
      
      {effectiveAppliedDiscount ? (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-800">
                {effectiveAppliedDiscount.discountValue}% discount applied!
                {effectiveAppliedDiscount.freeShipping && (
                  <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">
                    FREE SHIPPING
                  </span>
                )}
              </div>
              {effectiveAppliedDiscount.description && (
                <div className="text-xs text-green-600 mt-1">
                  {effectiveAppliedDiscount.description}
                </div>
              )}
            </div>
            <button
              onClick={handleRemoveDiscount}
              className="text-red-600 hover:text-red-800 text-xs font-medium"
            >
              Remove
            </button>
          </div>
          
          {/* Show savings calculation */}
          <div className="mt-2 pt-2 border-t border-green-200">
            <div className="text-xs text-green-700">
              You save: ${calculateActualDiscountAmount().toFixed(2)}
            </div>
          </div>
        </div>
      ) : isEvaluatingDiscount ? (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3eb489] mr-2"></div>
            <div className="text-sm text-green-800">
              Loading best discount...
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
          <div className="text-sm text-amber-800">
            💡 Best discounts are applied automatically when you add items to your cart
          </div>
          <div className="text-xs text-amber-600 mt-1">
            Add this mini app to your Farcaster notifications for a 15% off welcome discount!
          </div>
        </div>
      )}
    </div>
  );
} 