'use client'

import { useState, useEffect } from 'react'
import { useEnhancedPayment } from '@/lib/useEnhancedPayment'
import { useBaseAccount } from '@/components/BaseAccountProvider'

/**
 * Enhanced checkout flow that uses Base Account SDK when available,
 * falls back to existing flow for Farcaster app users
 */
export function EnhancedCheckoutFlow({ 
  cart, 
  appliedDiscount, 
  appliedGiftCard, 
  onOrderSuccess,
  onError 
}) {
  const { isBaseApp, baseAccount, baseProfile, isLoading: isBaseLoading } = useBaseAccount()
  const {
    executePayment,
    getAutoFilledShippingData,
    paymentStatus,
    error: paymentError,
    resetPayment
  } = useEnhancedPayment()

  const [shippingData, setShippingData] = useState(null)
  const [isAutoFilled, setIsAutoFilled] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Auto-fill shipping data from Base Account when available
  useEffect(() => {
    async function autoFillShippingData() {
      if (isBaseApp && baseAccount && !shippingData) {
        try {
          const autoFilledData = await getAutoFilledShippingData()
          if (autoFilledData) {
            setShippingData(autoFilledData)
            setIsAutoFilled(true)
            console.log('✅ Auto-filled shipping data from Base Account')
          }
        } catch (error) {
          console.log('Auto-fill failed, user will enter manually:', error.message)
        }
      }
    }

    autoFillShippingData()
  }, [isBaseApp, baseAccount, shippingData, getAutoFilledShippingData])

  // Handle payment processing
  const handlePayment = async () => {
    try {
      setIsProcessing(true)
      resetPayment()

      if (!shippingData) {
        throw new Error('Please provide shipping information')
      }

      // Calculate final total (same logic as existing checkout)
      const finalTotal = calculateFinalTotal()
      
      console.log('💳 Processing payment with enhanced flow:', {
        paymentMethod: isBaseApp ? 'Base Account' : 'Wagmi',
        total: finalTotal,
        hasAutoFilledShipping: isAutoFilled
      })

      // Execute payment using enhanced hook
      const result = await executePayment(finalTotal, {
        items: cart.items,
        shipping: shippingData,
        selectedShipping: cart.selectedShipping,
        checkout: cart.checkout,
        appliedDiscount,
        appliedGiftCard,
        total: finalTotal
      })

      console.log('✅ Payment successful:', result)
      
      // Call success callback
      if (onOrderSuccess) {
        await onOrderSuccess(result)
      }

    } catch (error) {
      console.error('💥 Payment error:', error)
      if (onError) {
        onError(error)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Calculate final total (same logic as existing checkout)
  const calculateFinalTotal = () => {
    if (!cart.checkout) return 0

    const subtotal = parseFloat(cart.checkout.subtotal.amount)
    const tax = parseFloat(cart.checkout.tax.amount)
    const shipping = parseFloat(cart.selectedShipping?.price?.amount || 0)
    
    // Apply discount
    let discountAmount = 0
    if (appliedDiscount) {
      const discountValue = parseFloat(appliedDiscount.discountValue || 0)
      if (appliedDiscount.discountType === 'percentage') {
        discountAmount = (subtotal * discountValue) / 100
      } else {
        discountAmount = discountValue
      }
    }

    // Apply gift card
    let giftCardDiscount = 0
    if (appliedGiftCard) {
      const totalBeforeGiftCard = subtotal + tax + shipping - discountAmount
      giftCardDiscount = Math.min(appliedGiftCard.balance, totalBeforeGiftCard)
    }

    const finalTotal = Math.max(0, subtotal + tax + shipping - discountAmount - giftCardDiscount)
    
    // Minimum charge for free orders
    if (finalTotal <= 0.01 && (subtotal <= 0.01 || giftCardDiscount > 0)) {
      return 0.01
    }

    return finalTotal
  }

  // Show loading state while Base Account initializes
  if (isBaseLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Initializing payment system...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Base Account Status */}
      {isBaseApp && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-blue-800">
              Enhanced Base Experience
            </span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            {isAutoFilled ? 
              'Shipping info auto-filled from your Base profile' : 
              'One-tap payments and profile integration available'
            }
          </p>
        </div>
      )}

      {/* Shipping Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Shipping Information</h3>
        
        {isAutoFilled && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800">
                Auto-filled from Base Account
              </span>
            </div>
          </div>
        )}

        {shippingData ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={shippingData.firstName}
                  onChange={(e) => setShippingData({...shippingData, firstName: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={shippingData.lastName}
                  onChange={(e) => setShippingData({...shippingData, lastName: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input
                type="text"
                value={shippingData.address1}
                onChange={(e) => setShippingData({...shippingData, address1: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input
                  type="text"
                  value={shippingData.city}
                  onChange={(e) => setShippingData({...shippingData, city: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">State</label>
                <input
                  type="text"
                  value={shippingData.province}
                  onChange={(e) => setShippingData({...shippingData, province: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ZIP</label>
                <input
                  type="text"
                  value={shippingData.zip}
                  onChange={(e) => setShippingData({...shippingData, zip: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading shipping form...</p>
          </div>
        )}
      </div>

      {/* Order Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${parseFloat(cart.checkout?.subtotal?.amount || 0).toFixed(2)}</span>
          </div>
          {appliedDiscount && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({appliedDiscount.discountType === 'fixed' ? `$${appliedDiscount.discountValue}` : `${appliedDiscount.discountValue}%`})</span>
              <span>-${appliedDiscount.discountType === 'fixed' 
                ? Math.min(parseFloat(appliedDiscount.discountValue || 0), parseFloat(cart.checkout?.subtotal?.amount || 0)).toFixed(2)
                : (parseFloat(cart.checkout?.subtotal?.amount || 0) * parseFloat(appliedDiscount.discountValue || 0) / 100).toFixed(2)
              }</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{cart.selectedShipping?.price?.amount === '0' ? 'FREE' : `$${parseFloat(cart.selectedShipping?.price?.amount || 0).toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>${parseFloat(cart.checkout?.tax?.amount || 0).toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Total</span>
            <span>${calculateFinalTotal().toFixed(2)} USDC</span>
          </div>
        </div>
      </div>

      {/* Payment Button */}
      <button
        onClick={handlePayment}
        disabled={!shippingData || isProcessing || paymentStatus === 'pending'}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          isProcessing || paymentStatus === 'pending'
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isProcessing || paymentStatus === 'pending' ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Processing Payment...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2">
            {isBaseApp ? (
              <>
                <span>🚀</span>
                <span>Pay with Base Account</span>
              </>
            ) : (
              <>
                <span>💳</span>
                <span>Pay with USDC</span>
              </>
            )}
          </div>
        )}
      </button>

      {/* Error Display */}
      {paymentError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{paymentError}</p>
        </div>
      )}
    </div>
  )
}
