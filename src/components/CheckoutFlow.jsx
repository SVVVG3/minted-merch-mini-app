'use client';

import { useState } from 'react';
import { useCart } from '@/lib/CartContext';
import { useUSDCPayment } from '@/lib/useUSDCPayment';
import { ShippingForm } from './ShippingForm';

export function CheckoutFlow() {
  const { cart, clearCart, updateShipping } = useCart();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('shipping'); // 'shipping' or 'payment'
  const [shippingData, setShippingData] = useState(cart.shipping || null);
  const [isShippingValid, setIsShippingValid] = useState(false);
  
  const {
    balance,
    balanceNumber,
    isLoadingBalance,
    paymentStatus,
    error,
    transactionHash,
    executePayment,
    resetPayment,
    hasSufficientBalance,
    isPending,
    isConfirming,
    isConfirmed,
    isConnected,
    address
  } = useUSDCPayment();

  const cartTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const hasItems = cart.items.length > 0;

  const handleCheckout = async () => {
    if (!hasItems) return;
    
    try {
      setIsCheckoutOpen(true);
      setCheckoutStep('shipping'); // Start with shipping step
      
    } catch (err) {
      console.error('Checkout error:', err);
    }
  };

  const handleShippingChange = (shipping, isValid) => {
    setShippingData(shipping);
    setIsShippingValid(isValid);
  };

  const handleContinueToPayment = () => {
    if (!isShippingValid || !shippingData) return;
    
    // Save shipping data to cart context
    updateShipping(shippingData);
    setCheckoutStep('payment');
  };

  const handleBackToShipping = () => {
    setCheckoutStep('shipping');
  };

  const handlePayment = async () => {
    if (!isConnected) {
      throw new Error('Please connect your wallet to continue');
    }

    if (!shippingData) {
      throw new Error('Please provide shipping information');
    }

    // Execute the payment
    await executePayment(cartTotal, {
      items: cart.items,
      notes: cart.notes,
      shipping: shippingData,
      total: cartTotal
    });
  };

  const handlePaymentSuccess = () => {
    // Clear cart after successful payment
    clearCart();
    setIsCheckoutOpen(false);
    resetPayment();
  };

  const handleCloseCheckout = () => {
    setIsCheckoutOpen(false);
    setCheckoutStep('shipping');
    resetPayment();
  };

  // Don't render if no items in cart
  if (!hasItems) return null;

  return (
    <>
      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        disabled={!hasItems || !isConnected}
        className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
      >
        {!isConnected ? 'Connect Wallet to Pay' : `Pay ${cartTotal.toFixed(2)} USDC`}
      </button>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {checkoutStep === 'shipping' ? 'Shipping Information' : 'Complete Payment'}
                  </h2>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${checkoutStep === 'shipping' ? 'bg-[#3eb489]' : 'bg-gray-300'}`}></div>
                    <span className="text-xs text-gray-500">Shipping</span>
                    <div className="w-4 h-px bg-gray-300"></div>
                    <div className={`w-2 h-2 rounded-full ${checkoutStep === 'payment' ? 'bg-[#3eb489]' : 'bg-gray-300'}`}></div>
                    <span className="text-xs text-gray-500">Payment</span>
                  </div>
                </div>
                <button
                  onClick={handleCloseCheckout}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              
              {/* Shipping Step */}
              {checkoutStep === 'shipping' && (
                <>
                  <ShippingForm
                    onShippingChange={handleShippingChange}
                    initialShipping={shippingData}
                  />
                  
                  {/* Order Summary */}
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="font-medium">Order Summary</h3>
                    {cart.items.map((item) => (
                      <div key={item.key} className="flex justify-between text-sm">
                        <span>{item.title} {item.variantTitle && `(${item.variantTitle})`} × {item.quantity}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    {cart.notes && (
                      <div className="text-sm text-gray-600">
                        <strong>Notes:</strong> {cart.notes}
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span>Subtotal</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Shipping and taxes will be calculated in the next step
                    </div>
                  </div>
                  
                  {/* Continue Button */}
                  <button
                    onClick={handleContinueToPayment}
                    disabled={!isShippingValid}
                    className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    Continue to Payment
                  </button>
                </>
              )}

              {/* Payment Step */}
              {checkoutStep === 'payment' && (
                <>
                  {/* Back Button */}
                  <button
                    onClick={handleBackToShipping}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Shipping
                  </button>

                  {/* Shipping Summary */}
                  {shippingData && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-700 mb-1">Shipping to:</div>
                      <div className="text-sm text-gray-600">
                        {shippingData.firstName} {shippingData.lastName}<br />
                        {shippingData.address1}{shippingData.address2 && `, ${shippingData.address2}`}<br />
                        {shippingData.city}, {shippingData.province} {shippingData.zip}<br />
                        {shippingData.country}
                      </div>
                    </div>
                  )}
                  
                  {/* Wallet Info */}
                  {isConnected && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600">Connected Wallet</div>
                      <div className="font-mono text-xs">{address?.slice(0, 8)}...{address?.slice(-6)}</div>
                      <div className="text-sm mt-1">
                        Balance: {isLoadingBalance ? 'Loading...' : `${balanceNumber.toFixed(2)} USDC`}
                      </div>
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className="space-y-2">
                    <h3 className="font-medium">Order Summary</h3>
                    {cart.items.map((item) => (
                      <div key={item.key} className="flex justify-between text-sm">
                        <span>{item.title} {item.variantTitle && `(${item.variantTitle})`} × {item.quantity}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    {cart.notes && (
                      <div className="text-sm text-gray-600">
                        <strong>Notes:</strong> {cart.notes}
                      </div>
                    )}
                    <div className="border-t pt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>${cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Shipping</span>
                        <span>Calculated at checkout</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Taxes</span>
                        <span>Calculated at checkout</span>
                      </div>
                      <div className="border-t pt-1 flex justify-between font-medium">
                        <span>Total</span>
                        <span>${cartTotal.toFixed(2)} USDC*</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        *Final amount will include shipping and taxes
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Payment Status - Only show in payment step */}
              {checkoutStep === 'payment' && paymentStatus === 'checking' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-blue-800 text-sm">Checking balance...</div>
                </div>
              )}

              {checkoutStep === 'payment' && paymentStatus === 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="text-yellow-800 text-sm">
                    {isPending ? 'Confirm transaction in your wallet...' : 'Processing payment...'}
                  </div>
                </div>
              )}

              {checkoutStep === 'payment' && isConfirming && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-blue-800 text-sm">Confirming transaction on blockchain...</div>
                  {transactionHash && (
                    <div className="text-xs text-blue-600 mt-1 font-mono">
                      TX: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                    </div>
                  )}
                </div>
              )}

              {checkoutStep === 'payment' && paymentStatus === 'success' && isConfirmed && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-green-800 text-sm font-medium">Payment Successful! 🎉</div>
                  <div className="text-green-600 text-xs mt-1">Your order has been processed.</div>
                  {transactionHash && (
                    <div className="text-xs text-green-600 mt-1 font-mono">
                      TX: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                    </div>
                  )}
                  <button
                    onClick={handlePaymentSuccess}
                    className="mt-2 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                  >
                    Continue Shopping
                  </button>
                </div>
              )}

              {checkoutStep === 'payment' && paymentStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-red-800 text-sm font-medium">Payment Failed</div>
                  <div className="text-red-600 text-xs mt-1">{error}</div>
                  <button
                    onClick={resetPayment}
                    className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Payment Actions - Only show in payment step */}
              {checkoutStep === 'payment' && paymentStatus === 'idle' && isConnected && (
                <div className="space-y-2">
                  {!hasSufficientBalance(cartTotal) && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-red-800 text-sm">
                        Insufficient USDC balance. You need {cartTotal.toFixed(2)} USDC but only have {balanceNumber.toFixed(2)} USDC.
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={handlePayment}
                    disabled={!hasSufficientBalance(cartTotal) || isPending}
                    className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    {isPending ? 'Processing...' : `Pay ${cartTotal.toFixed(2)} USDC`}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}