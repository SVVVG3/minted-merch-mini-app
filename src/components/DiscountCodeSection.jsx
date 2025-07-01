'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';

export function DiscountCodeSection({ 
  onDiscountApplied, 
  onDiscountRemoved, 
  subtotal = 0,
  autoPopulate = false,
  className = ""
}) {
  const { getFid } = useFarcaster();
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState(null);
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);

  // Auto-populate discount code from session storage
  useEffect(() => {
    if (autoPopulate && !hasAutoPopulated) {
      try {
        // Check for active discount in session storage (from HomePage)
        const activeDiscountData = sessionStorage.getItem('activeDiscountCode');
        if (activeDiscountData) {
          const activeDiscount = JSON.parse(activeDiscountData);
          console.log('🎯 Auto-populating discount from session:', activeDiscount);
          
          setDiscountCode(activeDiscount.code || '');
          setHasAutoPopulated(true);
          
          // Optionally auto-apply the discount if we have subtotal
          if (subtotal > 0 && activeDiscount.code) {
            console.log('🚀 Auto-applying discount:', activeDiscount.code);
            handleApplyDiscount(activeDiscount.code);
          }
        }
      } catch (error) {
        console.error('Error auto-populating discount:', error);
      }
    }
  }, [autoPopulate, hasAutoPopulated, subtotal]);

  const handleApplyDiscount = async (codeToApply = null) => {
    const code = codeToApply || discountCode.trim();
    
    if (!code) {
      setDiscountError('Please enter a discount code');
      return;
    }

    if (subtotal <= 0) {
      setDiscountError('Please add items to cart first');
      return;
    }

    setIsValidatingDiscount(true);
    setDiscountError(null);

    try {
      const userFid = getFid();
      if (!userFid) {
        throw new Error('User not authenticated');
      }

      console.log('🔍 Validating discount code:', code);

      const response = await fetch('/api/validate-discount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code.toUpperCase(),
          fid: userFid,
          subtotal: subtotal
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Invalid discount code');
      }

      // Apply the discount
      const discount = {
        code: result.code || code.toUpperCase(),
        discountType: result.discountType,
        discountValue: result.discountValue,
        discountAmount: result.discountAmount,
        message: result.message,
        source: codeToApply ? 'auto_applied' : 'user_entered'
      };

      setAppliedDiscount(discount);
      setDiscountCode(discount.code);

      // Notify parent component
      if (onDiscountApplied) {
        onDiscountApplied(discount);
      }

      console.log('✅ Discount applied successfully:', discount);

    } catch (error) {
      console.error('❌ Error applying discount:', error);
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

  return (
    <div className={`space-y-3 border border-gray-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Discount Code</h3>
        {appliedDiscount && appliedDiscount.source === 'auto_applied' && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
            Auto-applied
          </span>
        )}
      </div>
      
      {!appliedDiscount ? (
        <div className="space-y-2">
          <div className="flex space-x-2">
            <input
              type="text"
              value={discountCode}
              onChange={handleDiscountCodeChange}
              placeholder="Enter discount code"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3eb489] focus:border-transparent"
              disabled={isValidatingDiscount}
            />
            <button
              onClick={() => handleApplyDiscount()}
              disabled={!discountCode.trim() || isValidatingDiscount}
              className="px-4 py-2 bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              {isValidatingDiscount ? 'Validating...' : 'Apply'}
            </button>
          </div>
          
          {discountError && (
            <div className="text-red-600 text-xs">{discountError}</div>
          )}

          {/* Helper text for auto-populated codes */}
          {autoPopulate && hasAutoPopulated && !appliedDiscount && (
            <div className="text-green-600 text-xs">
              💡 We found a discount code for you! Click Apply to use it.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-800">
                {appliedDiscount.discountValue}% discount applied!
              </div>
              <div className="text-xs text-green-600">
                Code: {appliedDiscount.code}
              </div>
              {appliedDiscount.discountAmount && (
                <div className="text-xs text-green-600">
                  Savings: ${appliedDiscount.discountAmount.toFixed(2)}
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