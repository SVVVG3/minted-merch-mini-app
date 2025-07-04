'use client';

import { useState, useEffect, useRef } from 'react';
import { useCart } from '@/lib/CartContext';
import { useUSDCPayment } from '@/lib/useUSDCPayment';
import { useFarcaster } from '@/lib/useFarcaster';
import { calculateCheckout } from '@/lib/shopify';
import { saveOrderToHistory } from '@/lib/orderHistory';
import { ShippingForm } from './ShippingForm';

export function CheckoutFlow({ checkoutData, onBack }) {
  const { cart, clearCart, updateShipping, updateCheckout, updateSelectedShipping, clearCheckout, addItem, cartSubtotal, cartTotal } = useCart();
  const { getFid, isInFarcaster } = useFarcaster();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(checkoutData ? true : false);
  const [checkoutStep, setCheckoutStep] = useState('shipping'); // 'shipping', 'shipping-method', 'payment', or 'success'
  const [shippingData, setShippingData] = useState(cart.shipping || null);
  const [isShippingValid, setIsShippingValid] = useState(false);
  const [isCalculatingCheckout, setIsCalculatingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const buyNowProcessed = useRef(false);

  // Helper function to calculate product-aware discount amount
  const calculateProductAwareDiscountAmount = () => {
    if (!appliedDiscount) return 0;
    
    const { code, discountType, discountValue } = appliedDiscount;
    const currentSubtotal = cart.checkout ? cart.checkout.subtotal.amount : cartSubtotal;
    
    // Check if this is a product-specific discount from session storage
    try {
      const activeDiscountData = sessionStorage.getItem('activeDiscountCode');
      if (activeDiscountData) {
        const activeDiscount = JSON.parse(activeDiscountData);
        
        // For product-specific discounts, only apply to qualifying products
        if (activeDiscount.source === 'product_specific_api' && activeDiscount.code === code) {
          let qualifyingSubtotal = 0;
          
          cart.items.forEach(item => {
            const productHandle = item.product?.handle;
            const productTitle = item.product?.title || item.title;
            
            // Check if this product qualifies for the SNAPSHOT-TINY-HYPER-FREE discount
            if (code === 'SNAPSHOT-TINY-HYPER-FREE') {
              if (productHandle === 'tiny-hyper-tee' || productTitle?.includes('Tiny Hyper Tee')) {
                qualifyingSubtotal += (item.price * item.quantity);
              }
            } else {
              // For other product-specific discounts, fall back to original behavior
              qualifyingSubtotal = currentSubtotal;
            }
          });
          
          // Calculate discount only on qualifying products
          if (discountType === 'percentage') {
            return (qualifyingSubtotal * discountValue) / 100;
          } else if (discountType === 'fixed') {
            return Math.min(discountValue, qualifyingSubtotal);
          }
        }
      }
    } catch (error) {
      console.error('Error calculating product-aware discount:', error);
    }
    
    // Fallback to original calculation
    return appliedDiscount.discountAmount || 0;
  };

  // Helper function to calculate adjusted tax based on discount
  const calculateAdjustedTax = () => {
    if (!cart.checkout || !cart.checkout.tax) return 0;
    
    const originalSubtotal = cart.checkout.subtotal.amount;
    const originalTax = cart.checkout.tax.amount;
    
    // If no original tax, return 0
    if (originalTax <= 0 || originalSubtotal <= 0) return 0;
    
    const discount = calculateProductAwareDiscountAmount();
    const discountedSubtotal = originalSubtotal - discount;
    
    // If discounted subtotal is 0 or negative, no tax should be applied
    if (discountedSubtotal <= 0) return 0;
    
    const taxRate = originalTax / originalSubtotal;
    const adjustedTax = Math.max(0, discountedSubtotal * taxRate);
    
    return adjustedTax;
  };

  // Helper function to calculate final total safely (never negative)
  const calculateFinalTotal = () => {
    if (!cart.checkout || !cart.selectedShipping) return cartTotal;
    
    const subtotal = cart.checkout.subtotal.amount;
    const discount = calculateProductAwareDiscountAmount();
    const shipping = cart.selectedShipping.price.amount;
    const tax = calculateAdjustedTax();
    
    // Calculate total but ensure it never goes negative
    const finalTotal = Math.max(0, subtotal - discount + shipping + tax);
    return finalTotal;
  };

  // Handle Buy Now functionality by adding item to cart
  useEffect(() => {
    if (checkoutData && checkoutData.product && checkoutData.variant && !buyNowProcessed.current) {
      // Add the item to cart for Buy Now (only once)
      addItem(checkoutData.product, checkoutData.variant, checkoutData.quantity || 1);
      setIsCheckoutOpen(true);
      buyNowProcessed.current = true;
    }
  }, [checkoutData, addItem]);
  
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

  // Use cart total from context instead of calculating locally
  const hasItems = cart.items.length > 0;
  const appliedDiscount = cart.appliedDiscount;

  // Auto-create order when payment succeeds
  useEffect(() => {
    if (paymentStatus === 'success' && isConfirmed && transactionHash && checkoutStep === 'payment' && !orderDetails) {
      console.log('Payment confirmed, auto-creating order...');
      handlePaymentSuccess();
    }
  }, [paymentStatus, isConfirmed, transactionHash, checkoutStep, orderDetails]);

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

  const handleContinueToShippingMethod = async () => {
    if (!isShippingValid || !shippingData) return;
    
    setIsCalculatingCheckout(true);
    setCheckoutError(null);
    
    try {
      // Save shipping data to cart context
      updateShipping(shippingData);
      
      console.log('Calculating checkout with:', {
        cartItems: cart.items,
        shippingAddress: shippingData
      });
      
      // Calculate checkout with Shopify API
      const checkoutData = await calculateCheckout(cart.items, shippingData);
      console.log('Checkout calculation result:', checkoutData);
      
      // Validate the response
      if (!checkoutData) {
        throw new Error('No checkout data received from API');
      }
      
      if (!checkoutData.total || !checkoutData.subtotal) {
        throw new Error('Invalid checkout data: missing required fields');
      }
      
      // Save checkout data to cart context
      updateCheckout(checkoutData);
      
      // Move to shipping method selection step
      setCheckoutStep('shipping-method');
      
    } catch (error) {
      console.error('Checkout calculation error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        cartItems: cart.items,
        shippingData: shippingData
      });
      setCheckoutError(error.message || 'Failed to calculate shipping and taxes');
    } finally {
      setIsCalculatingCheckout(false);
    }
  };

  const handleContinueToPayment = () => {
    if (!cart.selectedShipping) return;
    setCheckoutStep('payment');
  };

  const handleBackToShipping = () => {
    setCheckoutStep('shipping');
    setCheckoutError(null);
    clearCheckout(); // Clear checkout data when going back
  };

  const handleBackToShippingMethod = () => {
    setCheckoutStep('shipping-method');
    setCheckoutError(null);
  };

  const handlePayment = async () => {
    if (!isConnected) {
      throw new Error('Please connect your wallet to continue');
    }

    if (!shippingData) {
      throw new Error('Please provide shipping information');
    }

    if (!cart.checkout) {
      throw new Error('Checkout calculation not available');
    }

    // Calculate final total using the safe helper function
    const finalTotal = calculateFinalTotal();
    const discountAmount = calculateProductAwareDiscountAmount();

    // Execute the payment
    await executePayment(finalTotal, {
      items: cart.items,
      notes: cart.notes,
      shipping: shippingData,
      selectedShipping: cart.selectedShipping,
      checkout: cart.checkout,
      appliedDiscount: appliedDiscount,
      discountAmount: discountAmount,
      total: finalTotal
    });
  };

  const handlePaymentSuccess = async () => {
    // Prevent multiple order creation attempts
    if (orderDetails) {
      console.log('Order already created, skipping...');
      return;
    }

    try {
      // Create order in Shopify after successful payment
      console.log('Creating Shopify order after successful payment...');
      
      const orderData = {
        cartItems: cart.items,
        shippingAddress: shippingData,
        billingAddress: null, // Same as shipping for now
        customer: {
          email: shippingData.email || '',
          phone: shippingData.phone || ''
        },
        checkout: cart.checkout,
        selectedShipping: cart.selectedShipping,
        transactionHash: transactionHash,
        notes: cart.notes || '',
        fid: getFid(), // Add user's Farcaster ID for notifications
        appliedDiscount: appliedDiscount, // Include discount information from CartContext
        discountAmount: appliedDiscount ? appliedDiscount.discountAmount : 0
      };

      const response = await fetch('/api/shopify/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Order created successfully:', result.order.name);
        
        // Calculate final total with discount
        const finalOrderTotal = appliedDiscount 
          ? cart.checkout.subtotal.amount - calculateProductAwareDiscountAmount() + calculateAdjustedTax() + (cart.selectedShipping ? cart.selectedShipping.price.amount : 0)
          : cart.checkout.subtotal.amount + calculateAdjustedTax() + (cart.selectedShipping ? cart.selectedShipping.price.amount : 0);
        
        // Create order details object
        const orderDetailsData = {
          name: result.order.name,
          id: result.order.id,
          status: 'Confirmed',
          total: {
            amount: finalOrderTotal.toFixed(2),
            currencyCode: 'USDC'
          },
          customer: {
            email: shippingData.email || ''
          },
          transactionHash: transactionHash,
          lineItems: cart.items.map(item => ({
            title: item.product?.title || item.title || 'Unknown Item',
            variantTitle: item.variant?.title || item.variantTitle,
            quantity: item.quantity,
            price: item.price
          })),
          shippingAddress: shippingData,
          selectedShipping: cart.selectedShipping,
          appliedDiscount: appliedDiscount
        };
        
        // Save order to history
        const userFid = getFid();
        if (userFid) {
          saveOrderToHistory(userFid, orderDetailsData);
          console.log('Order saved to history for user:', userFid);
        }
        
        // Show order confirmation
        setOrderDetails(orderDetailsData);
        setCheckoutStep('success');
        
      } else {
        console.error('Order creation failed:', result.error);
        console.error('Order creation response:', result);
        // Still clear cart but show warning
        alert('Payment successful but order creation failed. Please contact support with your transaction hash: ' + transactionHash);
        clearCart();
        setIsCheckoutOpen(false);
        resetPayment();
      }
      
    } catch (error) {
      console.error('Error creating order:', error);
      // Still clear cart but show warning
      alert('Payment successful but order creation failed. Please contact support with your transaction hash: ' + transactionHash);
      clearCart();
      setIsCheckoutOpen(false);
      resetPayment();
    }
  };

  const handleContinueShopping = () => {
    setIsCheckoutOpen(false);
    setCheckoutStep('shipping');
    setCheckoutError(null);
    resetPayment();
    setOrderDetails(null);
    
    // Optionally clear cart after successful order
    if (orderDetails) {
      clearCart();
    }
    
    // Call parent's onBack if provided
    if (onBack) {
      onBack();
    }
  };

  const handleCloseCheckout = () => {
    setIsCheckoutOpen(false);
    setCheckoutStep('shipping');
    setCheckoutError(null);
    resetPayment();
    setOrderDetails(null);
    
    // Call parent's onBack if provided
    if (onBack) {
      onBack();
    }
  };

  // Share order success function
  const handleShareOrder = async () => {
    if (!orderDetails || !isInFarcaster) return;

    try {
      const orderUrl = `${window.location.origin}/order/${orderDetails.name}`;
      
      // Create a share intent for Farcaster
      const shareText = `Just placed my order #${orderDetails.name} on Minted Merch! 🛍️\n\n${orderUrl}`;
      
      // Try to use the Farcaster sharing API if available
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({
          type: 'createCast',
          data: {
            cast: {
              text: shareText,
              embeds: [orderUrl]
            }
          }
        }, '*');
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareText);
        alert('Order details copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing order:', error);
    }
  };

  const handleShippingMethodSelect = (shippingMethod) => {
    updateSelectedShipping(shippingMethod);
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
        {!isConnected ? 'Connect Wallet to Pay' : (
          appliedDiscount 
            ? `Checkout (${cartTotal.toFixed(2)} USDC + shipping & taxes)`
            : `Checkout (${cartTotal.toFixed(2)} USDC + shipping & taxes)`
        )}
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
                    {checkoutStep === 'shipping' && 'Shipping Information'}
                    {checkoutStep === 'shipping-method' && 'Select Shipping Method'}
                    {checkoutStep === 'payment' && 'Complete Payment'}
                    {checkoutStep === 'success' && 'Order Confirmed!'}
                  </h2>
                  <div className="flex items-center space-x-1 mt-1">
                    <div className={`w-2 h-2 rounded-full ${checkoutStep === 'shipping' ? 'bg-[#3eb489]' : 'bg-gray-300'}`}></div>
                    <span className="text-xs text-gray-500">Address</span>
                    <div className="w-3 h-px bg-gray-300"></div>
                    <div className={`w-2 h-2 rounded-full ${checkoutStep === 'shipping-method' ? 'bg-[#3eb489]' : 'bg-gray-300'}`}></div>
                    <span className="text-xs text-gray-500">Shipping</span>
                    <div className="w-3 h-px bg-gray-300"></div>
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
                        <span>{item.product?.title || item.title} {item.variant?.title && item.variant.title !== 'Default Title' && `(${item.variant.title})`} × {item.quantity}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    {cart.notes && (
                      <div className="text-sm text-gray-600">
                        <strong>Notes:</strong> {cart.notes}
                      </div>
                    )}
                    <div className="border-t pt-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>${cartSubtotal.toFixed(2)}</span>
                      </div>
                      {appliedDiscount && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Discount ({appliedDiscount.discountValue}%)</span>
                          <span>-${calculateProductAwareDiscountAmount().toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span>${cartTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      Shipping and taxes will be calculated in the next step
                    </div>
                  </div>
                  
                  {/* Checkout Error */}
                  {checkoutError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-red-800 text-sm font-medium">Checkout Error</div>
                      <div className="text-red-600 text-xs mt-1">{checkoutError}</div>
                    </div>
                  )}
                  
                  {/* Continue Button */}
                  <button
                    onClick={handleContinueToShippingMethod}
                    disabled={!isShippingValid || isCalculatingCheckout}
                    className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    {isCalculatingCheckout ? 'Calculating shipping & taxes...' : 'Continue to Shipping Options'}
                  </button>
                </>
              )}

              {/* Shipping Method Selection Step */}
              {checkoutStep === 'shipping-method' && (
                <>
                  {/* Back Button */}
                  <button
                    onClick={handleBackToShipping}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Shipping Address
                  </button>

                  {/* Shipping Address Summary */}
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

                  {/* Order Summary with Discount */}
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="font-medium">Order Summary</h3>
                    {cart.items.map((item) => (
                      <div key={item.key} className="flex justify-between text-sm">
                        <span>{item.product?.title || item.title} {item.variant?.title && item.variant.title !== 'Default Title' && `(${item.variant.title})`} × {item.quantity}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>${cart.checkout ? cart.checkout.subtotal.amount.toFixed(2) : cartSubtotal.toFixed(2)}</span>
                      </div>
                      {appliedDiscount && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Discount ({appliedDiscount.discountValue}%)</span>
                          <span>-${appliedDiscount.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {cart.checkout && (
                        <div className="flex justify-between text-sm">
                          <span>Taxes</span>
                          <span>${calculateAdjustedTax().toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Shipping Methods */}
                    {cart.checkout?.shippingRates && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Select Shipping Method</h4>
                        <div className="space-y-2">
                          {cart.checkout.shippingRates.map((rate, index) => (
                            <label key={index} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                              <div className="flex items-center">
                                <input
                                  type="radio"
                                  name="shipping-method"
                                  value={rate.handle || index}
                                  checked={cart.selectedShipping?.handle === rate.handle}
                                  onChange={() => handleShippingMethodSelect(rate)}
                                  className="mr-3 text-[#3eb489] focus:ring-[#3eb489]"
                                />
                                <div>
                                  <div className="font-medium text-sm">{rate.title}</div>
                                  {rate.description && (
                                    <div className="text-xs text-gray-600">{rate.description}</div>
                                  )}
                                </div>
                              </div>
                              <div className="font-medium">${rate.price.amount.toFixed(2)}</div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Total with Selected Shipping */}
                    {cart.selectedShipping && cart.checkout && (
                      <div className="border-t pt-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>${cart.checkout.subtotal.amount.toFixed(2)}</span>
                          </div>
                          {appliedDiscount && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Discount ({appliedDiscount.discountValue}%)</span>
                              <span>-${calculateProductAwareDiscountAmount().toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span>Shipping ({cart.selectedShipping.title})</span>
                            <span>${cart.selectedShipping.price.amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Taxes</span>
                            <span>${calculateAdjustedTax().toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-medium text-lg border-t pt-1">
                            <span>Total</span>
                            <span>
                              ${(() => {
                                const subtotal = cart.checkout.subtotal.amount;
                                const discount = appliedDiscount ? appliedDiscount.discountAmount : 0;
                                const shipping = cart.selectedShipping.price.amount;
                                const discountedSubtotal = subtotal - discount;
                                const adjustedTax = calculateAdjustedTax();
                                return (discountedSubtotal + shipping + adjustedTax).toFixed(2);
                              })()} USDC
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Continue to Payment Button */}
                  <button
                    onClick={handleContinueToPayment}
                    disabled={!cart.selectedShipping}
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
                    onClick={handleBackToShippingMethod}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Shipping Method
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
                        <span>{item.product.title} {item.variant?.title && item.variant.title !== 'Default Title' && `(${item.variant.title})`} × {item.quantity}</span>
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
                        <span>${cart.checkout ? cart.checkout.subtotal.amount.toFixed(2) : cartSubtotal.toFixed(2)}</span>
                      </div>
                      
                      {/* Discount Line Item */}
                      {appliedDiscount && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Discount ({appliedDiscount.discountValue}%)</span>
                          <span>-${calculateProductAwareDiscountAmount().toFixed(2)}</span>
                        </div>
                      )}
                      
                      {/* Selected Shipping Method */}
                      {cart.selectedShipping ? (
                        <div className="flex justify-between text-sm">
                          <span>Shipping ({cart.selectedShipping.title})</span>
                          <span>${cart.selectedShipping.price.amount.toFixed(2)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Shipping</span>
                          <span>Not selected</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-sm">
                        <span>Taxes</span>
                        <span>${calculateAdjustedTax().toFixed(2)}</span>
                      </div>
                      
                      <div className="border-t pt-1 flex justify-between font-medium">
                        <span>Total</span>
                        <span>
                          ${calculateFinalTotal().toFixed(2)} USDC
                        </span>
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
                    onClick={handleContinueShopping}
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
                  {(() => {
                    const finalTotal = calculateFinalTotal();
                    
                    return !hasSufficientBalance(finalTotal) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-red-800 text-sm">
                          Insufficient USDC balance. You need {finalTotal.toFixed(2)} USDC but only have {balanceNumber.toFixed(2)} USDC.
                        </div>
                      </div>
                    );
                  })()}
                  
                  <button
                    onClick={handlePayment}
                    disabled={!cart.checkout || !cart.selectedShipping || !hasSufficientBalance(calculateFinalTotal()) || isPending}
                    className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    {isPending ? 'Processing...' : `Pay ${calculateFinalTotal().toFixed(2)} USDC`}
                  </button>
                </div>
              )}

              {/* Success Step */}
              {checkoutStep === 'success' && orderDetails && (() => {
                // Generate product text for order page link
                const productNames = cart.items.map(item => {
                  const productName = item.product?.title || item.title;
                  const variantName = item.variant?.title && item.variant.title !== 'Default Title' ? item.variant.title : '';
                  const quantity = item.quantity > 1 ? ` (${item.quantity}x)` : '';
                  return variantName ? `${productName} (${variantName})${quantity}` : `${productName}${quantity}`;
                });
                
                const productText = productNames.length === 1 
                  ? productNames[0]
                  : productNames.length === 2
                    ? `${productNames[0]} and ${productNames[1]}`
                    : `${productNames.slice(0, -1).join(', ')}, and ${productNames[productNames.length - 1]}`;

                return (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                      <svg className="w-12 h-12 mx-auto text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Thank you for your order!</h3>
                      <p className="text-gray-600 mb-3">Your order has been successfully placed and payment confirmed.</p>
                      <div className="bg-white p-3 rounded border border-green-200">
                        <p className="text-sm text-gray-600">Order Number</p>
                        <p className="text-lg font-mono font-medium text-gray-900">{orderDetails.name}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <h4 className="font-medium text-gray-900">Order Details</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className="font-medium text-green-600">{orderDetails.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium">${orderDetails.total.amount} {orderDetails.total.currencyCode}</span>
                        </div>
                        {orderDetails.customer.email && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-medium">{orderDetails.customer.email}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Transaction:</span>
                          <span className="font-mono text-xs">{orderDetails.transactionHash?.slice(0, 8)}...{orderDetails.transactionHash?.slice(-6)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* Share Order Button */}
                      <button
                        onClick={handleShareOrder}
                        className="w-full bg-[#8A63D2] hover:bg-[#7C5BC7] text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                      >
                        {/* Official Farcaster Logo */}
                        <svg className="w-5 h-5" viewBox="0 0 1000 1000" fill="currentColor">
                          <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
                          <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.445H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"/>
                          <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.445H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"/>
                        </svg>
                        <span>Share My Purchase</span>
                      </button>
                      
                      <button
                        onClick={handleContinueShopping}
                        className="w-full bg-[#3eb489] hover:bg-[#359970] text-white font-medium py-3 px-4 rounded-lg transition-colors"
                      >
                        Continue Shopping
                      </button>
                      <button
                        onClick={handleCloseCheckout}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      )}
    </>
  );
}