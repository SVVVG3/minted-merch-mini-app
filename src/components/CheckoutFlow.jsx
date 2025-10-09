'use client';

import { useState, useEffect, useRef } from 'react';
import { useCart } from '@/lib/CartContext';
import { useUSDCPayment } from '@/lib/useUSDCPayment';
import { useFarcaster } from '@/lib/useFarcaster';
import { calculateCheckout } from '@/lib/shopify';
import { sdk } from '@farcaster/miniapp-sdk';

import { ShippingForm } from './ShippingForm';
import GiftCardSection, { GiftCardBalance } from './GiftCardSection';

export function CheckoutFlow({ checkoutData, onBack }) {
  const { cart, clearCart, updateShipping, updateCheckout, updateSelectedShipping, clearCheckout, addItem, cartSubtotal, cartTotal } = useCart();
  const { getFid, isInFarcaster, user, context } = useFarcaster();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(checkoutData ? true : false);
  const [checkoutStep, setCheckoutStep] = useState('shipping'); // 'shipping', 'shipping-method', 'payment', or 'success'
  const [shippingData, setShippingData] = useState(cart.shipping || null);
  const [isShippingValid, setIsShippingValid] = useState(false);
  const [isCalculatingCheckout, setIsCalculatingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState(null);
  const buyNowProcessed = useRef(false);

  // Helper function to detect if cart contains only digital products
  const isDigitalOnlyCart = () => {
    const safeItems = Array.isArray(cart.items) ? cart.items : [];
    if (safeItems.length === 0) return false;
    
    return safeItems.every(item => {
      const productTitle = item.product?.title || item.title || '';
      const productHandle = item.product?.handle || '';
      
      // Check if product is a gift card or other digital product
      return (
        productTitle.toLowerCase().includes('gift card') ||
        productHandle.includes('gift-card') ||
        productTitle.toLowerCase().includes('digital') ||
        productTitle.toLowerCase().includes('virtual') ||
        productHandle.includes('digital') ||
        productHandle.includes('virtual')
      );
    });
  };

  // Handle gift card application
  const handleGiftCardApplied = (giftCard) => {
    console.log('🎁 Gift card applied to checkout:', giftCard);
    setAppliedGiftCard(giftCard);
  };

  // Helper function to calculate product-aware discount amount (excludes gift cards)
  const calculateProductAwareDiscountAmount = () => {
    if (!appliedDiscount) return 0;
    
    // Calculate discount amount directly to avoid floating-point errors
    const subtotal = cart.checkout && cart.checkout.subtotal ? cart.checkout.subtotal.amount : cartSubtotal;
    const discountValue = appliedDiscount.discountValue || appliedDiscount.discount_value;
    const discountType = appliedDiscount.discountType || appliedDiscount.discount_type;
    
    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = (subtotal * discountValue) / 100;
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(discountValue, subtotal);
    }
    
    // Round to 2 decimal places to match server calculation
    discountAmount = Math.round(discountAmount * 100) / 100;
    
    console.log(`💰 Discount calculation: Subtotal: $${subtotal}, Discount type: ${discountType}, Discount value: ${discountValue}, Discount amount: $${discountAmount}`);
    
    return discountAmount;
  };

  // Helper function to calculate tax - taxes should be calculated on discounted subtotal (after discount codes, before gift cards)
  const calculateAdjustedTax = () => {
    if (!cart.checkout || !cart.checkout.tax || !cart.checkout.subtotal) return 0;
    
    const originalSubtotal = cart.checkout.subtotal.amount;
    const originalTax = cart.checkout.tax.amount;
    
    // If no original tax, return 0
    if (originalTax <= 0 || originalSubtotal <= 0) return 0;
    
    // Calculate tax on discounted subtotal (after discount codes, before gift cards)
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
    if (!cart.checkout || !cart.checkout.subtotal || !cart.selectedShipping) return cartTotal;
    
    const subtotal = cart.checkout.subtotal.amount;
    const discount = calculateProductAwareDiscountAmount();
    let shipping = cart.selectedShipping.price.amount;
    const tax = calculateAdjustedTax();
    
    // Override shipping to 0 if discount includes free shipping
    if (appliedDiscount?.freeShipping) {
      shipping = 0;
      console.log('🚚 Free shipping applied - shipping cost set to $0');
    }
    
    // Calculate total before gift card
    let totalBeforeGiftCard = Math.max(0, subtotal - discount + shipping + tax);
    
    // SECURITY: Gift card discount will be calculated server-side
    // Frontend only shows that gift card is applied, not the amount
    let giftCardDiscount = 0;
    if (appliedGiftCard) {
      // Estimate gift card discount for display purposes only
      // Actual amount will be calculated server-side during checkout
      giftCardDiscount = Math.min(appliedGiftCard.balance, totalBeforeGiftCard);
      console.log('🎁 Gift card applied (estimated discount):', giftCardDiscount);
    }
    
    // Calculate final total with gift card
    let finalTotal = Math.max(0, totalBeforeGiftCard - giftCardDiscount);
    
    // MINIMUM CHARGE: If total would be $0.00, charge $0.01 for payment processing
    // Use <= 0.01 to handle floating point precision issues
    const isCartFree = cartTotal <= 0.01;
    if (finalTotal <= 0.01 && (isCartFree || giftCardDiscount > 0)) {
      finalTotal = 0.01;
      console.log('💰 Applied minimum charge of $0.01 for free giveaway order processing');
    }
    
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

  // Fetch user's previous shipping address for pre-population
  useEffect(() => {
    const fetchPreviousShippingAddress = async () => {
      const userFid = getFid();
      
      // Only fetch if we don't already have shipping data and user is identified
      if (!shippingData && userFid) {
        try {
          console.log('🔍 Fetching previous shipping address for returning user...');
          
          const response = await fetch(`/api/user-last-shipping?fid=${userFid}`);
          
          if (!response.ok) {
            console.log('📝 No previous shipping address found or API error');
            return;
          }
          
          const data = await response.json();
          
          if (data.shippingAddress) {
            console.log('✅ Found previous shipping address, pre-populating form');
            setShippingData(data.shippingAddress);
            // Also update the cart context with the shipping data
            updateShipping(data.shippingAddress);
          } else {
            console.log('📝 No previous shipping address available');
          }
        } catch (error) {
          console.error('❌ Error fetching previous shipping address:', error);
          // Fail silently - user can still enter address manually
        }
      }
    };

    fetchPreviousShippingAddress();
  }, [getFid, shippingData, updateShipping]);
  
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
  const hasItems = Array.isArray(cart.items) ? cart.items.length > 0 : false;
  const appliedDiscount = cart.appliedDiscount;

  // Auto-create order when payment succeeds
  useEffect(() => {
    if (paymentStatus === 'success' && isConfirmed && transactionHash && checkoutStep === 'payment' && !orderDetails) {
      console.log('Payment confirmed, auto-creating order...');
      handlePaymentSuccess();
    }
  }, [paymentStatus, isConfirmed, transactionHash, checkoutStep, orderDetails]);

  // Initialize shipping data for digital products with Farcaster info
  useEffect(() => {
    if (isDigitalOnlyCart() && !shippingData && user) {
      const displayName = user.displayName || user.username || '';
      const nameParts = displayName.split(' ');
      
      setShippingData({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: '',
        // Default empty address fields (will be filled with defaults during checkout)
        address1: '',
        address2: '',
        city: '',
        province: '',
        zip: '',
        country: 'US',
        phone: ''
      });
    }
  }, [isDigitalOnlyCart, user, shippingData]);

  const handleCheckout = async () => {
    if (!hasItems) return;
    
    try {
      // Add haptic feedback for checkout action
      try {
        const capabilities = await sdk.getCapabilities();
        if (capabilities.includes('haptics.impactOccurred')) {
          await sdk.haptics.impactOccurred('medium');
        }
      } catch (error) {
        // Haptics not available, continue without feedback
        console.log('Haptics not available:', error);
      }
      
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
    
    // Check if cart contains only digital products
    const digitalOnly = isDigitalOnlyCart();
    
    if (digitalOnly) {
      console.log('🎁 Digital-only cart detected, skipping shipping calculation and going to payment');
      
      // Save shipping data (billing address) to cart context
      updateShipping(shippingData);
      
      // For digital products, ensure we have minimal required fields for backend compatibility
      const digitalShippingData = {
        ...shippingData,
        // Set default address values for digital products (not displayed to user)
        address1: 'Digital Delivery',
        address2: '',
        city: 'Digital',
        province: 'Digital',
        zip: '00000',
        country: 'US'
      };
      
      updateShipping(digitalShippingData);
      
      // Create a mock checkout for digital products (no shipping, no tax for now)
      const mockCheckout = {
        subtotal: { amount: cartSubtotal, currencyCode: 'USD' },
        total: { amount: cartTotal, currencyCode: 'USD' },
        tax: { amount: 0, currencyCode: 'USD' },
        shippingRates: [],
        isDigitalOnly: true
      };
      
      updateCheckout(mockCheckout);
      
      // Set a mock "no shipping" option for digital products to satisfy validation
      const mockShipping = {
        handle: 'digital-no-shipping',
        title: 'Digital Delivery',
        price: { amount: 0, currencyCode: 'USD' },
        description: 'Digital products delivered via email'
      };
      updateSelectedShipping(mockShipping);
      
      // Skip directly to payment for digital products
      setCheckoutStep('payment');
      return;
    }
    
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
      
      // Check if applied discount includes free shipping
      if (appliedDiscount && appliedDiscount.freeShipping) {
        console.log('🚚 Free shipping discount detected, adding free shipping option');
        
        // Add free shipping option to the beginning of shipping rates
        const freeShippingOption = {
          handle: 'discount-free-shipping',
          title: 'FREE Shipping (Discount Applied)',
          price: { amount: 0, currencyCode: 'USD' },
          description: 'Free shipping provided by discount code'
        };
        
        // Add free shipping as first option and remove duplicates
        checkoutData.shippingRates = [
          freeShippingOption,
          ...checkoutData.shippingRates.filter(rate => rate.price.amount > 0)
        ];
        
        console.log('🚚 Updated shipping rates with free shipping:', checkoutData.shippingRates);
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
    // For digital products, go back to shipping (billing) step
    // For physical products, go back to shipping method selection
    setCheckoutStep(isDigitalOnlyCart() ? 'shipping' : 'shipping-method');
    setCheckoutError(null);
  };

  const handlePayment = async () => {
    try {
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

      console.log('💳 Executing payment:', {
        total: finalTotal,
        isConnected,
        address
      });

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
      
    } catch (error) {
      console.error('💥 Payment error:', error);
      
      // Provide specific error handling for connector issues
      if (error.message.includes('connector.getChainId is not a function')) {
        throw new Error('Wallet connection issue. Please try refreshing the page. If the problem persists, this may be a temporary issue with the Farcaster wallet integration.');
      }
      
      // Re-throw the original error if it's not the connector issue
      throw error;
    }
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
      
      // Enhanced FID resolution with multiple fallback methods
      let userFid = getFid();
      
      // Fallback 1: Try to get FID from stored Farcaster user
      if (!userFid && user?.fid) {
        userFid = user.fid;
        console.log('🔄 FID recovered from user object:', userFid);
      }
      
      // Fallback 2: Try to get FID from Farcaster context
      if (!userFid && context?.user?.fid) {
        userFid = context.user.fid;
        console.log('🔄 FID recovered from context:', userFid);
      }
      
      // Fallback 3: Try to get FID from window.userFid (frame initialization)
      if (!userFid && typeof window !== 'undefined' && window.userFid) {
        userFid = window.userFid;
        console.log('🔄 FID recovered from window.userFid:', userFid);
      }
      
      // Fallback 4: Try to get FID from localStorage persistence
      if (!userFid && typeof window !== 'undefined') {
        const storedFid = localStorage.getItem('farcaster_fid');
        if (storedFid && !isNaN(parseInt(storedFid))) {
          userFid = parseInt(storedFid);
          console.log('🔄 FID recovered from localStorage:', userFid);
        }
      }
      
      console.log('🔍 Enhanced FID Debug at order creation:', {
        fid: userFid,
        fidType: typeof userFid,
        fidIsNull: userFid === null,
        fidIsUndefined: userFid === undefined,
        getFidResult: getFid(),
        userFid: user?.fid,
        contextFid: context?.user?.fid,
        windowFid: typeof window !== 'undefined' ? window.userFid : 'N/A',
        storedFid: typeof window !== 'undefined' ? localStorage.getItem('farcaster_fid') : 'N/A',
        isInFarcaster: isInFarcaster,
        hasUser: !!user,
        hasContext: !!context
      });
      
      // Store FID in localStorage for future sessions (if we have one)
      if (userFid && typeof window !== 'undefined') {
        localStorage.setItem('farcaster_fid', userFid.toString());
      }
      
      // CRITICAL: Validate FID before order creation with better error handling
      if (!userFid) {
        console.error('❌ CRITICAL: No FID available for order creation after all fallbacks!', {
          fid: userFid,
          isInFarcaster: isInFarcaster,
          hasUser: !!user,
          hasContext: !!context,
          user: user,
          context: context,
          allFallbacks: {
            getFid: getFid(),
            userFid: user?.fid,
            contextFid: context?.user?.fid,
            windowFid: typeof window !== 'undefined' ? window.userFid : null,
            storedFid: typeof window !== 'undefined' ? localStorage.getItem('farcaster_fid') : null
          }
        });
        
        // More user-friendly error with debugging info
        const errorMessage = `Unable to create order: User authentication lost during checkout.
        
Debug Info:
- In Farcaster: ${isInFarcaster}
- Has User: ${!!user}
- Has Context: ${!!context}

Please try:
1. Refresh the page
2. Re-open the mini app
3. Contact support if issue persists

Transaction Hash: ${transactionHash}`;
        
        alert(errorMessage);
        
        // Don't return immediately - try to create order anyway with FID as null
        // This will at least create the Shopify order and we can manually fix the Supabase entry
        console.log('⚠️ Attempting order creation without FID as fallback...');
        userFid = null;
      }
      
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
        fid: userFid, // Add user's Farcaster ID for notifications (may be null)
        appliedDiscount: appliedDiscount, // Include discount information from CartContext
        discountAmount: calculateProductAwareDiscountAmount(),
        appliedGiftCard: appliedGiftCard, // Include gift card information (for display)
        // SECURITY: Gift card amounts will be calculated server-side
        giftCards: appliedGiftCard ? [{
          code: appliedGiftCard.code,
          // Don't send amountUsed - server will calculate this
          balance: appliedGiftCard.balance
        }] : []
      };

      const response = await fetch('/api/shopify/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      // Check for both success flag and HTTP status
      if (result.success && response.ok) {
        console.log('Order created successfully:', result.order.name);
        
        // Calculate final total with discount, gift card, and free shipping
        let shippingCost = cart.selectedShipping ? cart.selectedShipping.price.amount : 0;
        
        // Override shipping to 0 if discount includes free shipping
        if (appliedDiscount?.freeShipping) {
          shippingCost = 0;
        }
        
        let finalOrderTotal = cart.checkout && cart.checkout.subtotal ? cart.checkout.subtotal.amount : cartSubtotal;
        
        // Apply regular discount
        if (appliedDiscount) {
          finalOrderTotal -= calculateProductAwareDiscountAmount();
        }
        
        // SECURITY: Gift card discount will be calculated server-side
        // Frontend only estimates for display purposes
        if (appliedGiftCard) {
          const estimatedGiftCardDiscount = Math.min(appliedGiftCard.balance, finalOrderTotal);
          finalOrderTotal -= estimatedGiftCardDiscount;
        }
        
        // Add taxes and shipping
        finalOrderTotal += calculateAdjustedTax() + shippingCost;
        
        // Ensure total doesn't go negative
        finalOrderTotal = Math.max(0, finalOrderTotal);
        
        // MINIMUM CHARGE: If total would be $0.00, charge $0.01 for payment processing
        // Use <= 0.01 to handle floating point precision issues
        const isCartFree = cartTotal <= 0.01;
        if (finalOrderTotal <= 0.01 && (isCartFree || (appliedGiftCard && appliedGiftCard.balance > 0))) {
          finalOrderTotal = 0.01;
          console.log('💰 Applied minimum charge of $0.01 for free giveaway order processing');
        }
        
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
          lineItems: (Array.isArray(cart.items) ? cart.items : []).map(item => ({
            title: item.product?.title || item.title || 'Unknown Item',
            variantTitle: item.variant?.title || item.variantTitle,
            quantity: item.quantity,
            price: item.price
          })),
          shippingAddress: shippingData,
          selectedShipping: cart.selectedShipping,
          appliedDiscount: appliedDiscount,
          appliedGiftCard: appliedGiftCard
        };
        
        // Order is automatically saved to database via the order creation API
        
        // Show order confirmation
        setOrderDetails(orderDetailsData);
        setCheckoutStep('success');
        
      } else {
        console.error('Order creation failed:', result.error);
        console.error('Order creation response:', result);
        console.error('HTTP status:', response.status);
        
        // Show specific error message based on the error type
        let errorMessage = 'Payment successful but order creation failed.';
        if (result.error) {
          errorMessage += `\n\nError: ${result.error}`;
        }
        if (result.step) {
          errorMessage += `\n\nStep: ${result.step}`;
        }
        errorMessage += `\n\nPlease contact support with your transaction hash: ${transactionHash}`;
        
        alert(errorMessage);
        clearCart();
        setIsCheckoutOpen(false);
        resetPayment();
      }
      
    } catch (error) {
      console.error('Error creating order:', error);
      // Still clear cart but show warning
      alert(`Payment successful but order creation failed due to a network error.\n\nError: ${error.message}\n\nPlease contact support with your transaction hash: ${transactionHash}`);
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
    if (!orderDetails) return;

    // Add small delay to ensure order is fully processed in database
    // This prevents sharing before metadata is ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!isInFarcaster) {
      // Fallback for non-Farcaster environments
      if (navigator.share) {
        try {
          // Get the main product name from the order
          const mainProduct = orderDetails.lineItems?.[0]?.title || orderDetails.lineItems?.[0]?.name || 'item';
          await navigator.share({
            title: `Order ${orderDetails.name} Confirmed - Minted Merch`,
            text: `Just ordered my new ${mainProduct}! You get 15% off your first order when you add the $mintedmerch mini app! 👀 Shop on /mintedmerch - pay onchain 🟦`,
            url: `${window.location.origin}/order/${orderDetails.name.startsWith('#') ? orderDetails.name.substring(1) : orderDetails.name}`,
          });
        } catch (err) {
          console.log('Error sharing:', err);
        }
      } else {
        // Copy link to clipboard with cache-busting parameter
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/order/${orderDetails.name.startsWith('#') ? orderDetails.name.substring(1) : orderDetails.name}?t=${Date.now()}`);
          alert('Order link copied to clipboard!');
        } catch (err) {
          console.log('Error copying to clipboard:', err);
        }
      }
      return;
    }

    // Farcaster sharing using SDK composeCast action
    try {
              // Add cache-busting parameter to ensure fresh metadata
        const orderNumber = orderDetails.name.startsWith('#') ? orderDetails.name.substring(1) : orderDetails.name;
        const orderUrl = `${window.location.origin}/order/${orderNumber}?t=${Date.now()}`;
        // Get the main product name from the order
        const mainProduct = orderDetails.lineItems?.[0]?.title || orderDetails.lineItems?.[0]?.name || 'item';
        const shareText = `Just ordered my new ${mainProduct}!\n\nYou get 15% off your first order when you add the $mintedmerch mini app! 👀\n\nShop on /mintedmerch - pay onchain 🟦`;
      
      // Use the Farcaster SDK composeCast action
      const { sdk } = await import('../lib/frame');
      const result = await sdk.actions.composeCast({
        text: shareText,
        embeds: [orderUrl],
      });
      
      console.log('Order cast composed:', result);
    } catch (error) {
      console.error('Error sharing order:', error);
      // Fallback to copying link with cache-busting parameter
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/order/${orderDetails.name.startsWith('#') ? orderDetails.name.substring(1) : orderDetails.name}?t=${Date.now()}`);
        alert('Order link copied to clipboard!');
      } catch (err) {
        console.log('Error copying to clipboard:', err);
      }
    }
  };

  const handleShippingMethodSelect = (shippingMethod) => {
    updateSelectedShipping(shippingMethod);
  };

  // Auto-select free shipping when discount includes it
  useEffect(() => {
    if (cart.checkout?.shippingRates && appliedDiscount?.freeShipping && !cart.selectedShipping) {
      // Find the free shipping option
      const freeShippingOption = cart.checkout.shippingRates.find(rate => rate.price.amount === 0);
      if (freeShippingOption) {
        console.log('🚚 Auto-selecting free shipping option:', freeShippingOption);
        updateSelectedShipping(freeShippingOption);
      }
    }
  }, [cart.checkout?.shippingRates, appliedDiscount?.freeShipping, cart.selectedShipping]);

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
        {!isConnected ? 'Connect Wallet to Pay' : (() => {
          // Check if cart total is effectively free (considering product-specific discounts)
          const isCartFree = cartTotal <= 0.01;
          const isFreeWithShipping = isCartFree && appliedDiscount?.freeShipping;
          
          if (isFreeWithShipping) {
            return 'Checkout (FREE + $0.01 processing fee)';
          } else if (appliedDiscount?.freeShipping) {
            return `Checkout (${cartTotal.toFixed(2)} USDC + free shipping)`;
          } else if (appliedDiscount) {
            return `Checkout (${cartTotal.toFixed(2)} USDC + shipping & taxes)`;
          } else {
            return `Checkout (${cartTotal.toFixed(2)} USDC + shipping & taxes)`;
          }
        })()}
      </button>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6), 0 10px 30px rgba(0, 0, 0, 0.4)' }}>
            
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {checkoutStep === 'shipping' && (isDigitalOnlyCart() ? 'Billing Information' : 'Shipping Information')}
                    {checkoutStep === 'shipping-method' && 'Select Shipping Method'}
                    {checkoutStep === 'payment' && 'Complete Payment'}
                    {checkoutStep === 'success' && 'Order Confirmed!'}
                  </h2>
                  <div className="flex items-center space-x-1 mt-1">
                    <div className={`w-2 h-2 rounded-full ${checkoutStep === 'shipping' ? 'bg-[#3eb489]' : 'bg-gray-300'}`}></div>
                    <span className="text-xs text-gray-500">{isDigitalOnlyCart() ? 'Billing' : 'Address'}</span>
                    {!isDigitalOnlyCart() && (
                      <>
                        <div className="w-3 h-px bg-gray-300"></div>
                        <div className={`w-2 h-2 rounded-full ${checkoutStep === 'shipping-method' ? 'bg-[#3eb489]' : 'bg-gray-300'}`}></div>
                        <span className="text-xs text-gray-500">Shipping</span>
                      </>
                    )}
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
                  {/* Conditional Form - Simple for Digital Products, Full for Physical */}
                  {isDigitalOnlyCart() ? (
                    /* Digital Product Form - Name and Email Only */
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Delivery Information</h3>
                      <p className="text-sm text-gray-600">
                        🎁 Digital products will be delivered via email - no shipping address needed!
                      </p>
                      
                      {/* Name Fields */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            First Name *
                          </label>
                          <input
                            type="text"
                            value={shippingData?.firstName || ''}
                            onChange={(e) => {
                              const newData = { ...shippingData, firstName: e.target.value };
                              setShippingData(newData);
                              const isValid = newData.firstName && newData.lastName && newData.email && 
                                             newData.email.includes('@') && newData.email.includes('.');
                              setIsShippingValid(isValid);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                            placeholder="First name"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name *
                          </label>
                          <input
                            type="text"
                            value={shippingData?.lastName || ''}
                            onChange={(e) => {
                              const newData = { ...shippingData, lastName: e.target.value };
                              setShippingData(newData);
                              const isValid = newData.firstName && newData.lastName && newData.email && 
                                             newData.email.includes('@') && newData.email.includes('.');
                              setIsShippingValid(isValid);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                            placeholder="Last name"
                          />
                        </div>
                      </div>

                      {/* Email Field - Required and Prominent */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={shippingData?.email || ''}
                          onChange={(e) => {
                            const newData = { ...shippingData, email: e.target.value };
                            setShippingData(newData);
                            const isValid = newData.firstName && newData.lastName && newData.email && 
                                           newData.email.includes('@') && newData.email.includes('.');
                            setIsShippingValid(isValid);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                          placeholder="email@example.com"
                        />
                        <p className="text-gray-500 text-xs mt-1">
                          Your digital products will be delivered to this email address
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Physical Product Form - Full Shipping Address */
                    <ShippingForm
                      onShippingChange={handleShippingChange}
                      initialShipping={shippingData}
                    />
                  )}
                  
                  {/* Order Summary */}
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="font-medium">Order Summary</h3>
                    {(Array.isArray(cart.items) ? cart.items : []).map((item) => (
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
                      {appliedGiftCard && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Gift Card (${appliedGiftCard.discount.discountAmount.toFixed(2)})</span>
                          <span>-${appliedGiftCard.discount.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span>
                          {(cartTotal <= 0.01) || 
                           (appliedGiftCard && appliedGiftCard.discount.discountAmount >= cartTotal) ? (
                            (appliedDiscount?.freeShipping || appliedGiftCard) ? (
                              <span className="text-green-600">$0.01 <span className="text-xs">(min processing fee)</span></span>
                            ) : (
                              <span className="text-green-600">FREE</span>
                            )
                          ) : (
                            `$${cartTotal.toFixed(2)}`
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {isDigitalOnlyCart() ? (
                        <span className="text-blue-600 font-medium">🎁 Digital products - no shipping required!</span>
                      ) : appliedDiscount?.freeShipping ? (
                        <span className="text-green-600 font-medium">Free shipping included! Taxes will be calculated in the next step</span>
                      ) : (
                        'Shipping and taxes will be calculated in the next step'
                      )}
                    </div>
                  </div>
                  
                  {/* Gift Card Section */}
                  <GiftCardSection 
                    onGiftCardApplied={handleGiftCardApplied}
                    cartTotal={cartTotal}
                    className="border-t pt-4"
                  />
                  
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
                    {isCalculatingCheckout ? 'Calculating shipping & taxes...' : 
                     isDigitalOnlyCart() ? 'Continue to Payment' : 'Continue to Shipping Options'}
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
                    {(Array.isArray(cart.items) ? cart.items : []).map((item) => (
                      <div key={item.key} className="flex justify-between text-sm">
                        <span>{item.product?.title || item.title} {item.variant?.title && item.variant.title !== 'Default Title' && `(${item.variant.title})`} × {item.quantity}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>${cart.checkout && cart.checkout.subtotal ? cart.checkout.subtotal.amount.toFixed(2) : cartSubtotal.toFixed(2)}</span>
                      </div>
                      {appliedDiscount && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Discount ({appliedDiscount.discountValue}%)</span>
                          <span>-${calculateProductAwareDiscountAmount().toFixed(2)}</span>
                        </div>
                      )}
                      {appliedGiftCard && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Gift Card (${appliedGiftCard.discount.discountAmount.toFixed(2)})</span>
                          <span>-${appliedGiftCard.discount.discountAmount.toFixed(2)}</span>
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
                    {cart.checkout?.shippingRates && cart.checkout.shippingRates.length > 0 ? (
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
                              <div className="font-medium">
                                {rate.price.amount === 0 ? (
                                  <span className="text-green-600 font-bold">FREE</span>
                                ) : (
                                  `$${rate.price.amount.toFixed(2)}`
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="text-orange-800 text-sm font-medium mb-2">No Shipping Methods Available</div>
                        <div className="text-orange-700 text-xs mb-3">
                          We're unable to calculate shipping to your location at this time. This may be due to:
                        </div>
                        <ul className="text-orange-700 text-xs space-y-1 mb-3 ml-4">
                          <li>• Shipping restrictions to your country/region</li>
                          <li>• Temporary service unavailability</li>
                          <li>• Address validation issues</li>
                        </ul>
                        <div className="text-orange-700 text-xs">
                          Please try a different address or contact support for assistance.
                        </div>
                      </div>
                    )}

                    {/* Total with Selected Shipping */}
                    {cart.selectedShipping && cart.checkout && (
                      <div className="border-t pt-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>${cart.checkout && cart.checkout.subtotal ? cart.checkout.subtotal.amount.toFixed(2) : cartSubtotal.toFixed(2)}</span>
                          </div>
                          {appliedDiscount && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Discount ({appliedDiscount.discountValue}%)</span>
                              <span>-${calculateProductAwareDiscountAmount().toFixed(2)}</span>
                            </div>
                          )}
                          {appliedGiftCard && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Gift Card (${appliedGiftCard.balance.toFixed(2)} balance)</span>
                              <span>-${giftCardDiscount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span>Shipping ({cart.selectedShipping.title})</span>
                            <span>
                              {cart.selectedShipping.price.amount === 0 || appliedDiscount?.freeShipping ? (
                                <span className="text-green-600 font-medium">FREE</span>
                              ) : (
                                `$${cart.selectedShipping.price.amount.toFixed(2)}`
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Taxes</span>
                            <span>${calculateAdjustedTax().toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-medium text-lg border-t pt-1">
                            <span>Total</span>
                            <span>
                              ${(() => {
                                // Safe access to checkout data
                                if (!cart.checkout || !cart.checkout.subtotal) {
                                  return cartTotal.toFixed(2);
                                }
                                
                                const subtotal = cart.checkout.subtotal.amount;
                                const discount = calculateProductAwareDiscountAmount();
                                const giftCardDiscount = appliedGiftCard ? Math.min(appliedGiftCard.balance, subtotal - discount) : 0;
                                let shipping = cart.selectedShipping.price.amount;
                                
                                // Override shipping to 0 if discount includes free shipping
                                if (appliedDiscount?.freeShipping) {
                                  shipping = 0;
                                }
                                
                                const discountedSubtotal = subtotal - discount - giftCardDiscount;
                                const adjustedTax = calculateAdjustedTax();
                                let finalTotal = Math.max(0, discountedSubtotal + shipping + adjustedTax);
                                
                                // MINIMUM CHARGE: If total would be $0.00, charge $0.01 for payment processing
                                // Use <= 0.01 to handle floating point precision issues
                                const isCartFree = cartTotal <= 0.01;
                                if (finalTotal <= 0.01 && (isCartFree || giftCardDiscount > 0)) {
                                  finalTotal = 0.01;
                                }
                                
                                return finalTotal.toFixed(2);
                              })()} USDC
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Continue to Payment Button or Back Button */}
                  {cart.checkout?.shippingRates && cart.checkout.shippingRates.length > 0 ? (
                    <button
                      onClick={handleContinueToPayment}
                      disabled={!cart.selectedShipping}
                      className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      Continue to Payment
                    </button>
                  ) : (
                    <button
                      onClick={handleBackToShipping}
                      className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      ← Back to Shipping Address
                    </button>
                  )}
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
                    {isDigitalOnlyCart() ? 'Back to Billing Information' : 'Back to Shipping Method'}
                  </button>

                  {/* Customer Info Summary */}
                  {shippingData && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-700 mb-1">
                        {isDigitalOnlyCart() ? 'Customer Information:' : 'Shipping to:'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {shippingData.firstName} {shippingData.lastName}<br />
                        {!isDigitalOnlyCart() && (
                          <>
                            {shippingData.address1}{shippingData.address2 && `, ${shippingData.address2}`}<br />
                            {shippingData.city}, {shippingData.province} {shippingData.zip}<br />
                            {shippingData.country}
                          </>
                        )}
                        {isDigitalOnlyCart() && shippingData.email && (
                          <>
                            Email: {shippingData.email}<br />
                            <span className="text-green-600 text-xs">🎁 Digital delivery via email</span>
                          </>
                        )}
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
                    {(Array.isArray(cart.items) ? cart.items : []).map((item) => (
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
                        <span>${cart.checkout && cart.checkout.subtotal ? cart.checkout.subtotal.amount.toFixed(2) : cartSubtotal.toFixed(2)}</span>
                      </div>
                      
                      {/* Discount Line Item */}
                      {appliedDiscount && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Discount ({appliedDiscount.discountValue}%)</span>
                          <span>-${calculateProductAwareDiscountAmount().toFixed(2)}</span>
                        </div>
                      )}
                      
                      {/* Gift Card Line Item */}
                      {appliedGiftCard && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Gift Card (${appliedGiftCard.balance.toFixed(2)} balance)</span>
                          <span>-${giftCardDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {/* Selected Shipping Method - Hide for digital products */}
                      {!isDigitalOnlyCart() && (
                        cart.selectedShipping ? (
                          <div className="flex justify-between text-sm">
                            <span>Shipping ({cart.selectedShipping.title})</span>
                            <span>
                              {cart.selectedShipping.price.amount === 0 || appliedDiscount?.freeShipping ? (
                                <span className="text-green-600 font-medium">FREE</span>
                              ) : (
                                `$${cart.selectedShipping.price.amount.toFixed(2)}`
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>Shipping</span>
                            <span>Not selected</span>
                          </div>
                        )
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
                    disabled={!cart.checkout || !hasSufficientBalance(calculateFinalTotal()) || isPending}
                    className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    {isPending ? 'Processing...' : `Pay ${calculateFinalTotal().toFixed(2)} USDC`}
                  </button>
                </div>
              )}

              {/* Success Step */}
              {checkoutStep === 'success' && orderDetails && (() => {
                // Generate product text for order page link
                const productNames = (Array.isArray(cart.items) ? cart.items : []).map(item => {
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