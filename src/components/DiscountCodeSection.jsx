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
  subtotal = 0,
  autoPopulate = false,
  className = "",
  hasNotifications = null,
  showNotificationPrompt = false
}) {
  const { getFid } = useFarcaster();
  const { cartSubtotal, cartTotal, items: cartItems } = useCart();
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState(null);
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);
  const [tokenGatingInfo, setTokenGatingInfo] = useState(null);

  // Auto-populate discount code from session storage
  useEffect(() => {
    if (autoPopulate && !hasAutoPopulated) {
      try {
        const userFid = getFid();
        console.log('🎯 Auto-populate effect triggered:', {
          autoPopulate,
          hasAutoPopulated,
          userFid,
          subtotal,
          cartSubtotal
        });
        
        // Check for active discount in session storage (from HomePage)
        const activeDiscountData = sessionStorage.getItem('activeDiscountCode');
        console.log('💾 Session storage data:', activeDiscountData);
        
        if (activeDiscountData) {
          const activeDiscount = JSON.parse(activeDiscountData);
          console.log('🎯 Auto-populating discount from session:', activeDiscount);
          
          setDiscountCode(activeDiscount.code || '');
          // Only set hasAutoPopulated to true if we actually apply the discount
          // setHasAutoPopulated(true);
          
          // Store token-gating information if available
          if (activeDiscount.isTokenGated) {
            setTokenGatingInfo({
              isTokenGated: true,
              gatingType: activeDiscount.gatingType,
              description: activeDiscount.description,
              priorityLevel: activeDiscount.priorityLevel
            });
          }
          
          // For token-gated discounts, wait for valid FID before auto-applying
          if (activeDiscount.isTokenGated && (!userFid || typeof userFid !== 'number')) {
            console.log('🔄 Token-gated discount found but waiting for valid FID...');
            
            // Set up a retry mechanism
            const retryAutoApply = () => {
              const retryFid = getFid();
              if (retryFid && typeof retryFid === 'number') {
                console.log('🔄 Retrying auto-apply with FID:', retryFid);
                if ((subtotal > 0 || cartSubtotal > 0) && activeDiscount.code) {
                  setHasAutoPopulated(true); // Set this when we successfully retry
                  handleApplyDiscount(activeDiscount.code);
                }
              }
            };
            
            // Retry after 500ms, 1s, and 2s
            setTimeout(retryAutoApply, 500);
            setTimeout(retryAutoApply, 1000);
            setTimeout(retryAutoApply, 2000);
            
            return; // Don't auto-apply yet, wait for FID
          }
          
          // Auto-apply the discount if we have subtotal and valid FID (for token-gated) or any FID (for non-token-gated)
          console.log('🔍 Auto-apply conditions:', {
            hasSubtotal: subtotal > 0,
            hasCartSubtotal: cartSubtotal > 0,
            subtotalCondition: subtotal > 0 || cartSubtotal > 0,
            hasCode: !!activeDiscount.code,
            isTokenGated: activeDiscount.isTokenGated,
            userFid: userFid,
            validFid: userFid && typeof userFid === 'number'
          });
          
          if ((subtotal > 0 || cartSubtotal > 0) && activeDiscount.code) {
            console.log('🚀 Auto-applying discount:', activeDiscount.code);
            setHasAutoPopulated(true); // Set this here when we actually apply
            handleApplyDiscount(activeDiscount.code);
          } else {
            console.log('❌ Auto-apply conditions not met');
          }
        } else {
          console.log('❌ No active discount data found in session storage');
        }
      } catch (error) {
        console.error('Error auto-populating discount:', error);
      }
    }
  }, [autoPopulate, hasAutoPopulated, subtotal, cartItems, getFid]); // Add getFid to dependencies

  // Listen for sessionStorage changes (for cart discount re-evaluation)
  useEffect(() => {
    if (!autoPopulate) return;
    
    const handleStorageChange = () => {
      try {
        console.log('📻 Session storage change detected in DiscountCodeSection');
        
        const activeDiscountData = sessionStorage.getItem('activeDiscountCode');
        console.log('💾 Active discount data:', activeDiscountData);
        
        if (activeDiscountData) {
          const activeDiscount = JSON.parse(activeDiscountData);
          console.log('🔍 Parsed active discount:', activeDiscount);
          console.log('🔍 Current discount code:', discountCode);
          console.log('🔍 Condition checks:', {
            codeMatch: activeDiscount.code !== discountCode,
            autoApplied: activeDiscount.autoApplied,
            subtotal: subtotal,
            cartSubtotal: cartSubtotal,
            subtotalCondition: subtotal > 0 || cartSubtotal > 0
          });
          
          // Check if this is a new/better discount
          if (activeDiscount.code !== discountCode && activeDiscount.autoApplied) {
            console.log('🔄 New discount detected from cart re-evaluation:', activeDiscount.code);
            
            // Update the discount code and apply it
            setDiscountCode(activeDiscount.code);
            
            if (subtotal > 0 || cartSubtotal > 0) {
              console.log('🚀 Auto-applying discount from storage change:', activeDiscount.code);
              handleApplyDiscount(activeDiscount.code);
            } else {
              console.log('❌ Subtotal conditions not met for auto-apply');
            }
          }
        }
      } catch (error) {
        console.error('Error handling discount update:', error);
      }
    };

    // Listen for storage events (from other tabs/components)
    window.addEventListener('storage', handleStorageChange);
    
    // Also set up a custom event listener for same-tab updates
    window.addEventListener('sessionStorageUpdate', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sessionStorageUpdate', handleStorageChange);
    };
  }, [autoPopulate, discountCode, subtotal, cartItems]);

  // Retry auto-apply when FID becomes available (for token-gated discounts)
  useEffect(() => {
    const userFid = getFid();
    
    console.log('🔄 FID retry effect triggered:', {
      userFid,
      userFidType: typeof userFid,
      hasAutoPopulated,
      autoPopulate
    });
    
    // Only proceed if we have a valid FID and haven't auto-populated yet
    if (userFid && typeof userFid === 'number' && !hasAutoPopulated && autoPopulate) {
      try {
        const activeDiscountData = sessionStorage.getItem('activeDiscountCode');
        if (activeDiscountData) {
          const activeDiscount = JSON.parse(activeDiscountData);
          
          console.log('🔄 Checking discount for auto-apply with FID:', activeDiscount);
          
          // Check if this is a token-gated discount that was waiting for FID
          if (activeDiscount.isTokenGated && activeDiscount.code) {
            console.log('🔄 Valid FID now available, attempting auto-apply for token-gated discount:', activeDiscount.code);
            
            setDiscountCode(activeDiscount.code);
            setHasAutoPopulated(true);
            
            // Store token-gating information
            setTokenGatingInfo({
              isTokenGated: true,
              gatingType: activeDiscount.gatingType,
              description: activeDiscount.description,
              priorityLevel: activeDiscount.priorityLevel
            });
            
            // Auto-apply now that we have a valid FID
            if (subtotal > 0 || cartSubtotal > 0) {
              console.log('🚀 Auto-applying token-gated discount with valid FID:', activeDiscount.code);
              handleApplyDiscount(activeDiscount.code);
            }
          }
          // Also handle non-token-gated discounts that might be waiting
          else if (activeDiscount.code && !activeDiscount.isTokenGated) {
            console.log('🔄 Non-token-gated discount found, auto-applying:', activeDiscount.code);
            
            setDiscountCode(activeDiscount.code);
            setHasAutoPopulated(true);
            
            if (subtotal > 0 || cartSubtotal > 0) {
              console.log('🚀 Auto-applying non-token-gated discount:', activeDiscount.code);
              handleApplyDiscount(activeDiscount.code);
            }
          }
        }
      } catch (error) {
        console.error('Error in FID retry logic:', error);
      }
    }
  }, [getFid(), hasAutoPopulated, autoPopulate, subtotal, cartSubtotal]); // Watch for FID changes

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
    setHasAutoPopulated(false);
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
    if (!appliedDiscount) return 0;
    
    // The actual discount amount is the difference between subtotal and total (from cart context)
    const actualDiscountAmount = cartSubtotal - cartTotal;
    
    console.log(`📊 Discount Display: subtotal=$${cartSubtotal.toFixed(2)}, total=$${cartTotal.toFixed(2)}, actual discount=$${actualDiscountAmount.toFixed(2)}`);
    
    return actualDiscountAmount;
  };

  const userFid = getFid();
  const isAuthenticated = !!userFid;

  return (
    <div className={`space-y-3 border border-gray-200 rounded-lg p-3 ${className}`}>
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
      
      {!appliedDiscount ? (
        <div className="space-y-2">
          {discountError && (
            <div className="text-red-600 text-xs">{discountError}</div>
          )}

          {/* Show authentication status only if it's relevant */}
          {!isAuthenticated && hasAutoPopulated && (
            <div className="text-amber-600 text-xs">
              ⚠️ For personalized discounts, connect via Farcaster
            </div>
          )}

          {/* Helper text for auto-populated codes */}
          {autoPopulate && hasAutoPopulated && !appliedDiscount && (
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
          {showNotificationPrompt && hasNotifications === false && !hasAutoPopulated && (
            <div className="bg-green-50 border border-green-200 rounded-md p-2 mt-2">
              <div className="text-green-800 text-xs font-medium mb-1">
                🔔 Enable notifications for automatic discounts!
              </div>
              <div className="text-green-600 text-xs">
                Get 15% off your first/next order when you add the mini app and turn on notifications.
              </div>
            </div>
          )}

          {/* Show that auto-discounts are available for notification users */}
          {hasNotifications === true && !hasAutoPopulated && !appliedDiscount && (
            <div className="text-gray-600 text-xs">
              ✅ Auto-discounts enabled - we'll apply any available codes for you
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-800">
                {appliedDiscount.discountValue}% discount applied!
                {appliedDiscount.freeShipping && (
                  <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">
                    + FREE SHIPPING
                  </span>
                )}
              </div>
              <div className="text-xs text-green-600">
                {appliedDiscount.source === 'auto_applied' ? (
                  tokenGatingInfo?.isTokenGated ? (
                    `🎫 ${getTokenGatingDisplayText(tokenGatingInfo.gatingType)} discount`
                  ) : (
                    'Auto-applied discount'
                  )
                ) : (
                  `Code: ${appliedDiscount.code}`
                )}
              </div>
              {appliedDiscount.discountAmount && (
                <div className="text-xs text-green-600">
                  Savings: ${calculateActualDiscountAmount().toFixed(2)}
                  {appliedDiscount.freeShipping && (
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