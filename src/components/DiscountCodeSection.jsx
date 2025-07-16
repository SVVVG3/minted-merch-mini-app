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
  const { cart, cartSubtotal, cartTotal, items: cartItems } = useCart();
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  
  // Use cart's applied discount if available, otherwise use local state
  const effectiveAppliedDiscount = cart.appliedDiscount || appliedDiscount;
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState(null);
  const [tokenGatingInfo, setTokenGatingInfo] = useState(null);

  // Simple effect to sync with cart's applied discount
  useEffect(() => {
    if (cart.appliedDiscount) {
      setDiscountCode(cart.appliedDiscount.code || '');
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
      setDiscountCode('');
      setAppliedDiscount(null);
      setTokenGatingInfo(null);
    }
  }, [cart.appliedDiscount]);

  // Debug effect to monitor component state
  useEffect(() => {
    console.log('📊 DiscountCodeSection Analytics:', {
      hasDiscountCode: !!discountCode,
      isValidatingDiscount,
      discountError: !!discountError,
      appliedDiscount: !!effectiveAppliedDiscount
    });
  }, [discountCode, isValidatingDiscount, discountError, effectiveAppliedDiscount]);

  const handleApplyDiscount = async (codeToApply = null) => {
    const code = codeToApply || discountCode.trim();
    
    console.log('🔥 handleApplyDiscount called:', {
      codeToApply,
      discountCode,
      finalCode: code,
      subtotal,
      cartSubtotal,
      appliedDiscount: !!appliedDiscount
    });
    
    if (!code) {
      console.log('❌ No code provided');
      setDiscountError('Please enter a discount code');
      return;
    }

    if (subtotal <= 0 && cartSubtotal <= 0) {
      console.log('❌ Subtotal conditions not met:', { subtotal, cartSubtotal });
      setDiscountError('Please add items to cart first');
      return;
    }

    console.log('✅ Proceeding with discount validation');
    setIsValidatingDiscount(true);
    setDiscountError(null);

    try {
      const userFid = getFid();
      
      // Debug logging for FID
      console.log('🔍 FID Debug:', {
        userFid,
        userFidType: typeof userFid,
        userFidValue: userFid,
        userFidIsNull: userFid === null,
        userFidIsUndefined: userFid === undefined
      });
      
      // Validate FID - only send if it's a valid number
      const validatedFid = (userFid && typeof userFid === 'number') ? userFid : null;
      
      console.log('🔍 Validating code:', {
        code,
        originalFid: userFid,
        validatedFid,
        subtotal: cartSubtotal > 0 ? cartSubtotal : subtotal,
        hasCartItems: !!(cartItems && cartItems.length > 0)
      });

      const response = await fetch('/api/validate-discount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code.toUpperCase(),
          fid: validatedFid, // Use validated FID
          subtotal: cartSubtotal > 0 ? cartSubtotal : subtotal,
          cartItems: cartItems || [] // Pass cart items for gift card validation
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Invalid code');
      }

      // Check if this is a gift card
      if (result.isGiftCard) {
        console.log('🎁 Gift card detected:', result);
        setDiscountError('Gift cards are not supported in this checkout flow. Please use the regular checkout.');
        return;
      }

      // Apply the discount
      const discount = {
        code: result.code || code.toUpperCase(),
        discountType: result.discountType,
        discountValue: result.discountValue,
        discountAmount: result.discountAmount,
        freeShipping: result.freeShipping || false,
        message: result.message,
        source: codeToApply ? 'auto_applied' : 'user_entered',
        requiresAuth: result.requiresAuth || false
      };

      setAppliedDiscount(discount);
      setDiscountCode(discount.code);

      // Notify parent component
      if (onDiscountApplied) {
        onDiscountApplied(discount);
      }

      console.log('✅ Discount applied successfully:', discount);

    } catch (error) {
      console.error('❌ Error applying code:', error);
      setDiscountError(error.message);
    } finally {
      setIsValidatingDiscount(false);
    }
  };

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

  const handleDiscountCodeChange = (e) => {
    setDiscountCode(e.target.value.toUpperCase());
    setDiscountError(null);
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

  return (
    <div className={`space-y-3 border border-gray-200 rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Discount Code</h3>
        {appliedDiscount && appliedDiscount.source === 'auto_applied' && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
            {tokenGatingInfo?.isTokenGated 
              ? `🎫 ${getTokenGatingDisplayText(tokenGatingInfo.gatingType)}` 
              : 'Auto-applied'
            }
          </span>
        )}
      </div>
      
      {!effectiveAppliedDiscount ? (
        <div className="space-y-2">
          {discountError && (
            <div className="text-red-600 text-xs">{discountError}</div>
          )}

          {/* Show authentication status only if it's relevant */}
          {!isAuthenticated && (
            <div className="text-amber-600 text-xs">
              ⚠️ For personalized discounts, connect via Farcaster
            </div>
          )}

          {/* Helper text for auto-populated codes */}
          {autoPopulate && (
            <div className="text-green-600 text-xs">
              {tokenGatingInfo?.isTokenGated ? (
                <div>
                  🎫 <strong>{getTokenGatingDisplayText(tokenGatingInfo.gatingType)} discount found!</strong>
                  {tokenGatingInfo.description && (
                    <div className="text-gray-600 mt-1">{tokenGatingInfo.description}</div>
                  )}
                  <div className="mt-1">Click Apply to use it.</div>
                </div>
              ) : (
                '💡 We found a discount code for you! Click Apply to use it.'
              )}
            </div>
          )}

          {/* Notification prompt for users without notifications */}
          {/* This section is removed as auto-population is removed */}

          {/* Show that auto-discounts are available for notification users */}
          {/* This section is removed as auto-population is removed */}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-800">
                {effectiveAppliedDiscount.discountValue}% discount applied!
                {effectiveAppliedDiscount.freeShipping && (
                  <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">
                    + FREE SHIPPING
                  </span>
                )}
              </div>
              <div className="text-xs text-green-600">
                {effectiveAppliedDiscount.source === 'auto_applied' ? (
                  tokenGatingInfo?.isTokenGated ? (
                    `🎫 ${getTokenGatingDisplayText(tokenGatingInfo.gatingType)} discount`
                  ) : (
                    'Auto-applied discount'
                  )
                ) : (
                  `Code: ${effectiveAppliedDiscount.code}`
                )}
              </div>
              {effectiveAppliedDiscount.discountAmount && (
                <div className="text-xs text-green-600">
                  Savings: ${calculateActualDiscountAmount().toFixed(2)}
                  {effectiveAppliedDiscount.freeShipping && (
                    <span className="ml-1">+ Free shipping</span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleRemoveDiscount}
              className="text-green-600 hover:text-green-800 text-sm transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 