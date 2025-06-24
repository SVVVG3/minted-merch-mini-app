'use client';

import { useState } from 'react';
import { useCart } from '@/lib/CartContext';
import { useUSDCPayment } from '@/lib/useUSDCPayment';

export function CheckoutFlow() {
  const { cart, clearCart } = useCart();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
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
      
      if (!isConnected) {
        throw new Error('Please connect your wallet to continue');
      }

      // Execute the payment
      await executePayment(cartTotal, {
        items: cart.items,
        notes: cart.notes,
        total: cartTotal
      });

    } catch (err) {
      console.error('Checkout error:', err);
    }
  };

  const handlePaymentSuccess = () => {
    // Clear cart after successful payment
    clearCart();
    setIsCheckoutOpen(false);
    resetPayment();
  };

  const handleCloseCheckout = () => {
    setIsCheckoutOpen(false);
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
                <h2 className="text-lg font-semibold">Complete Payment</h2>
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
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)} USD = {cartTotal.toFixed(2)} USDC</span>
                </div>
              </div>

              {/* Payment Status */}
              {paymentStatus === 'checking' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-blue-800 text-sm">Checking balance...</div>
                </div>
              )}

              {paymentStatus === 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="text-yellow-800 text-sm">
                    {isPending ? 'Confirm transaction in your wallet...' : 'Processing payment...'}
                  </div>
                </div>
              )}

              {isConfirming && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-blue-800 text-sm">Confirming transaction on blockchain...</div>
                  {transactionHash && (
                    <div className="text-xs text-blue-600 mt-1 font-mono">
                      TX: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                    </div>
                  )}
                </div>
              )}

              {paymentStatus === 'success' && isConfirmed && (
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

              {paymentStatus === 'error' && (
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

              {/* Payment Actions */}
              {paymentStatus === 'idle' && isConnected && (
                <div className="space-y-2">
                  {!hasSufficientBalance(cartTotal) && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-red-800 text-sm">
                        Insufficient USDC balance. You need {cartTotal.toFixed(2)} USDC but only have {balanceNumber.toFixed(2)} USDC.
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => executePayment(cartTotal, { items: cart.items, notes: cart.notes, total: cartTotal })}
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