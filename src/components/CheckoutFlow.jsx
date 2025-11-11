'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useCart } from '@/lib/CartContext';
import { useUSDCPayment } from '@/lib/useUSDCPayment';
import { useFarcaster } from '@/lib/useFarcaster';
import { useBaseAccount } from '@/components/BaseAccountProvider';
import { useWalletConnectContext } from './WalletConnectProvider';
import { debugBaseAccount } from '@/lib/baseAccount';
import { calculateCheckout } from '@/lib/shopify';
import { sdk } from '@farcaster/miniapp-sdk';

import { ShippingForm } from './ShippingForm';
import GiftCardSection, { GiftCardBalance } from './GiftCardSection';
import { SignInWithBaseButton, BasePayButton } from './BaseAccountButtons';
import { WalletConnectButton } from './WalletConnectButton';
import { DaimoPayButton } from './DaimoPayButton';
import { useDaimoPayUI } from '@daimo/pay';

export function CheckoutFlow({ checkoutData, onBack }) {
  const { cart, clearCart, updateShipping, updateCheckout, updateSelectedShipping, clearCheckout, addItem, cartSubtotal, cartTotal } = useCart();
  const { getFid, getSessionToken, isInFarcaster, user, context } = useFarcaster();
  const { isConnected: isWalletConnected, userAddress: walletConnectAddress, connectionMethod, getWalletProvider } = useWalletConnectContext();
  const { resetPayment: resetDaimoPayment } = useDaimoPayUI();
  // Re-enable Base Account integration with safe defaults
  const baseAccountContext = useBaseAccount();
  const { 
    isBaseApp = false, 
    baseAccountSDK = null, 
    isAuthenticated = false, 
    isLoading: isBaseLoading = false, 
    signInWithBase = null, 
    baseAccountProfile = null, 
    fetchBaseAccountProfile = null, 
    payWithBase = null,
    userAddress = null,
    debugInfo = '' 
  } = baseAccountContext || {};
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(checkoutData ? true : false);
  const [checkoutStep, setCheckoutStep] = useState('shipping'); // 'shipping', 'shipping-method', 'payment', or 'success'
  const [shippingData, setShippingData] = useState(cart.shipping || null);
  const [isShippingValid, setIsShippingValid] = useState(false);
  const [isCalculatingCheckout, setIsCalculatingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState(null);
  const [baseAccountDebugInfo, setBaseAccountDebugInfo] = useState('');
  const [isWalletConnectProcessing, setIsWalletConnectProcessing] = useState(false);
  const [walletConnectError, setWalletConnectError] = useState(null);
  const [isDaimoProcessing, setIsDaimoProcessing] = useState(false);
  const [daimoError, setDaimoError] = useState(null);
  const buyNowProcessed = useRef(false);
  const processedDaimoTxHashes = useRef(new Set());
  const daimoPaymentInitiated = useRef(false);
  const [daimoOrderId, setDaimoOrderId] = useState(`order-${Date.now()}`);

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
    try {
      console.log('🎁 Gift card applied to checkout:', giftCard);
      console.log('🎁 Gift card balance type:', typeof giftCard.balance, 'value:', giftCard.balance);
      setAppliedGiftCard(giftCard);
    } catch (error) {
      console.error('❌ Error in handleGiftCardApplied:', error);
      console.error('❌ Gift card data that caused error:', giftCard);
    }
  };

  // Helper function to calculate product-aware discount amount (excludes gift cards)
  const calculateProductAwareDiscountAmount = () => {
    if (!appliedDiscount) return 0;
    
    const discountValue = appliedDiscount.discountValue || appliedDiscount.discount_value;
    const discountType = appliedDiscount.discountType || appliedDiscount.discount_type;
    
    // Check if this is a product-specific discount
    const isProductSpecific = appliedDiscount.discount_scope === 'product' || 
                              (appliedDiscount.target_products && 
                               Array.isArray(appliedDiscount.target_products) && 
                               appliedDiscount.target_products.length > 0);
    
    let discountAmount = 0;
    
    if (isProductSpecific) {
      // For product-specific discounts, calculate by summing individual item discounts
      cart.items.forEach(item => {
        const originalPrice = item.price;
        const discountedPrice = calculateItemDiscountedPrice(item);
        const itemDiscount = (originalPrice - discountedPrice) * item.quantity;
        discountAmount += itemDiscount;
      });
    } else {
      // For cart-wide discounts, apply to entire subtotal
      const subtotal = cart.checkout && cart.checkout.subtotal ? cart.checkout.subtotal.amount : cartSubtotal;
      
      if (discountType === 'percentage') {
        discountAmount = (subtotal * discountValue) / 100;
      } else if (discountType === 'fixed') {
        discountAmount = Math.min(discountValue, subtotal);
      }
    }
    
    // Round to 2 decimal places to match server calculation
    discountAmount = Math.round(discountAmount * 100) / 100;
    
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

  // Helper function to calculate total before gift card
  const calculateTotalBeforeGiftCard = () => {
    if (!cart.checkout || !cart.checkout.subtotal || !cart.selectedShipping) return cartTotal;
    
    const subtotal = cart.checkout.subtotal.amount;
    const discount = calculateProductAwareDiscountAmount();
    let shipping = cart.selectedShipping.price.amount;
    const tax = calculateAdjustedTax();
    
    // Override shipping to 0 if discount includes free shipping
    if (appliedDiscount?.freeShipping) {
      shipping = 0;
    }
    
    return Math.max(0, subtotal - discount + shipping + tax);
  };

  // Helper function to calculate gift card discount
  const calculateGiftCardDiscount = () => {
    if (!appliedGiftCard || appliedGiftCard.balance === undefined) return 0;
    
    const giftCardBalance = typeof appliedGiftCard.balance === 'number' ? appliedGiftCard.balance : parseFloat(appliedGiftCard.balance);
    const totalBeforeGiftCard = calculateTotalBeforeGiftCard();
    
    return Math.min(giftCardBalance, totalBeforeGiftCard);
  };

  // Helper function to calculate total before shipping (for first checkout screen)
  const calculateTotalBeforeShipping = () => {
    // Start with cart total (which already includes discounts)
    let total = cartTotal;
    
    // Apply gift card discount if available
    if (appliedGiftCard && appliedGiftCard.balance !== undefined) {
      const giftCardBalance = typeof appliedGiftCard.balance === 'number' ? appliedGiftCard.balance : parseFloat(appliedGiftCard.balance);
      const giftCardDiscount = Math.min(giftCardBalance, total);
      total = Math.max(0, total - giftCardDiscount);
      
      if (giftCardDiscount > 0) {
        console.log('🎁 Gift card applied (pre-shipping discount):', giftCardDiscount);
      }
    }
    
    return total;
  };

  // Helper function to calculate discounted price for a cart item
  const calculateItemDiscountedPrice = (item) => {
    if (!appliedDiscount || !appliedDiscount.discountValue) {
      return item.price;
    }
    
    const originalPrice = item.price;
    let discountedPrice = originalPrice;
    
    // Check if this is a product-specific discount
    const isProductSpecific = appliedDiscount.discount_scope === 'product' || 
                              (appliedDiscount.target_products && 
                               Array.isArray(appliedDiscount.target_products) && 
                               appliedDiscount.target_products.length > 0);
    
    if (isProductSpecific) {
      // Check if this item qualifies for the discount
      const targetProducts = Array.isArray(appliedDiscount.target_products) ? 
                             appliedDiscount.target_products : [];
      
      const qualifies = targetProducts.some(target => {
        // Handle different target formats
        if (typeof target === 'string') {
          return target === item.product?.handle || target === item.product?.title;
        } else if (typeof target === 'object' && target.handle) {
          return target.handle === item.product?.handle;
        }
        return false;
      });
      
      if (!qualifies) {
        return originalPrice; // No discount for this item
      }
    }
    
    // Apply discount
    if (appliedDiscount.discountType === 'percentage') {
      const savings = originalPrice * (appliedDiscount.discountValue / 100);
      discountedPrice = originalPrice - savings;
    } else if (appliedDiscount.discountType === 'fixed') {
      const savings = Math.min(appliedDiscount.discountValue, originalPrice);
      discountedPrice = originalPrice - savings;
    }
    
    return Math.max(discountedPrice, 0); // Ensure non-negative
  };

  // Helper function to calculate discounted subtotal
  const calculateDiscountedSubtotal = () => {
    if (!appliedDiscount || !appliedDiscount.discountValue) {
      return cartSubtotal;
    }
    
    let discountedSubtotal = 0;
    
    // Sum up all discounted item prices
    cart.items.forEach(item => {
      const discountedPrice = calculateItemDiscountedPrice(item);
      discountedSubtotal += discountedPrice * item.quantity;
    });
    
    return Math.max(discountedSubtotal, 0);
  };

  // Helper function to calculate final total safely (never negative)
  const calculateFinalTotal = () => {
    if (!cart.checkout || !cart.checkout.subtotal || !cart.selectedShipping) {
      // If we don't have shipping info yet, use the pre-shipping calculation
      return calculateTotalBeforeShipping();
    }
    
    // Calculate total before gift card using helper function
    const totalBeforeGiftCard = calculateTotalBeforeGiftCard();
    
    // Calculate gift card discount using helper function
    const giftCardDiscount = calculateGiftCardDiscount();
    if (giftCardDiscount > 0) {
      console.log('🎁 Gift card applied (estimated discount):', giftCardDiscount);
    }
    
    // Calculate final total with gift card
    let finalTotal = Math.max(0, totalBeforeGiftCard - giftCardDiscount);
    
    // MINIMUM CHARGE: If total would be $0.00, charge $0.10 for payment processing
    // (Daimo Pay minimum is $0.10)
    // Use <= 0.10 to handle floating point precision issues
    const isCartFree = cartTotal <= 0.10;
    if (finalTotal <= 0.10 && (isCartFree || giftCardDiscount > 0)) {
      finalTotal = 0.10;
      console.log('💰 Applied minimum charge of $0.10 for free giveaway order processing (Daimo minimum)');
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
  
  // Reset Daimo payment state when cart changes (items added/removed/cleared)
  // This ensures Daimo always shows the correct amount
  // 
  // OPTIMIZATION: Create a stable "cart fingerprint" to detect real changes
  // This prevents infinite loops from Context re-renders
  const cartFingerprint = useMemo(() => {
    // Create a unique string representing cart state
    // Format: "handle1:qty1,handle2:qty2|total"
    if (cart.items.length === 0) return 'empty';
    
    const itemsKey = cart.items
      .map(item => `${item.product?.handle || item.key}:${item.quantity}`)
      .sort()
      .join(',');
    
    return `${itemsKey}|${cartTotal.toFixed(2)}`;
  }, [cart.items, cartTotal]);
  
  // Generate a fresh order ID when cart changes
  useEffect(() => {
    if (cart.items.length > 0) {
      const newOrderId = `order-${Date.now()}`;
      setDaimoOrderId(newOrderId);
      
      // Reset flags for fresh checkout
      daimoPaymentInitiated.current = false;
      processedDaimoTxHashes.current = new Set();
      
      console.log('🆕 New order ID for cart:', newOrderId);
    }
  }, [cart.items.length]);
  
  // NOTE: We no longer update Daimo here! Amount is updated when user clicks "Purchase Merch"
  // This fixes the race condition where discounts/shipping/taxes weren't reflected in the payment

  // Helper function to check if JWT is expired and refresh if needed
  const ensureValidToken = async () => {
    const token = getSessionToken();
    
    if (!token) {
      console.log('⚠️ No session token available');
      return null;
    }
    
    try {
      // Decode JWT to check expiration (JWT format: header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('❌ Invalid JWT format');
        return null;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      const expiresAt = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      
      // Check if token expires in less than 5 minutes (refresh proactively)
      if (expiresAt - now < 5 * 60 * 1000) {
        console.log('🔄 JWT expired or expiring soon, refreshing...');
        
        // Re-authenticate using Farcaster session
        if (isInFarcaster && context) {
          try {
            // Get fresh Quick Auth token
            const quickAuthToken = await sdk.actions.getQuickAuthToken();
            
            if (quickAuthToken) {
              const response = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ farcasterToken: quickAuthToken })
              });
              
              const result = await response.json();
              
              if (result.success && result.token) {
                console.log('✅ JWT refreshed successfully');
                localStorage.setItem('fc_session_token', result.token);
                return result.token;
              }
            }
          } catch (error) {
            console.error('❌ Failed to refresh JWT:', error);
          }
        }
        
        return null;
      }
      
      return token; // Token is still valid
    } catch (error) {
      console.error('❌ Error checking JWT expiration:', error);
      return token; // Return original token as fallback
    }
  };

  // Fetch user's previous shipping address for pre-population
  useEffect(() => {
    const fetchPreviousShippingAddress = async () => {
      const userFid = getFid();
      
      // Only fetch if we don't already have shipping data and user is identified
      if (!shippingData && userFid) {
        try {
          console.log('🔍 Fetching previous shipping address for returning user...');
          
          // Check and refresh JWT if needed
          const validToken = await ensureValidToken();
          
          if (!validToken) {
            console.log('⚠️ No valid session token - user needs to re-authenticate');
            return;
          }
          
          // PHASE 2: Include session JWT token in Authorization header (required)
          const headers = {
            'Authorization': `Bearer ${validToken}`
          };
          
          const response = await fetch(`/api/user-last-shipping?fid=${userFid}`, {
            headers
          });
          
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
  }, [getFid, shippingData, updateShipping, isInFarcaster, context]);
  
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

  // WalletConnect balance state
  const [walletConnectBalance, setWalletConnectBalance] = useState(null);
  const [isLoadingWCBalance, setIsLoadingWCBalance] = useState(false);

  // Load balance for WalletConnect wallets
  useEffect(() => {
    if (isWalletConnected && walletConnectAddress && !isConnected) {
      const loadWalletConnectBalance = async () => {
        try {
          setIsLoadingWCBalance(true);
          const { ethers } = await import('ethers');
          const { USDC_CONTRACT } = await import('@/lib/usdc');
          
          // Use public RPC to check balance
          const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
          const usdcContract = new ethers.Contract(USDC_CONTRACT.address, USDC_CONTRACT.abi, provider);
          const balance = await usdcContract.balanceOf(walletConnectAddress);
          const balanceFormatted = ethers.formatUnits(balance, 6);
          
          console.log('💰 WalletConnect balance loaded:', balanceFormatted);
          setWalletConnectBalance(parseFloat(balanceFormatted));
        } catch (error) {
          console.error('❌ Failed to load WalletConnect balance:', error);
          setWalletConnectBalance(0);
        } finally {
          setIsLoadingWCBalance(false);
        }
      };
      
      loadWalletConnectBalance();
    }
  }, [isWalletConnected, walletConnectAddress, isConnected]);

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

  // Fetch Base Account profile when authenticated
  useEffect(() => {
    const debugInfo = `Profile useEffect: auth=${isAuthenticated}, base=${isBaseApp}, func=${!!fetchBaseAccountProfile}`
    setBaseAccountDebugInfo(prev => prev + '\n' + debugInfo)
    
    if (isAuthenticated && isBaseApp && fetchBaseAccountProfile) {
      setBaseAccountDebugInfo(prev => prev + '\n🔄 Fetching Base Account profile...')
      fetchBaseAccountProfile()
    } else {
      setBaseAccountDebugInfo(prev => prev + '\n❌ Not fetching - conditions not met')
    }
  }, [isAuthenticated, isBaseApp, fetchBaseAccountProfile]);

  // Use Base Account profile data to pre-fill shipping form
  useEffect(() => {
    const debugInfo = `Pre-fill useEffect: profile=${!!baseAccountProfile}, address=${!!(baseAccountProfile?.shippingAddress)}, existing=${!!shippingData}`
    setBaseAccountDebugInfo(prev => prev + '\n' + debugInfo)
    
    if (baseAccountProfile && baseAccountProfile.shippingAddress && !shippingData) {
      setBaseAccountDebugInfo(prev => prev + '\n📦 Using Base Account profile to pre-fill!')
      
      setShippingData({
        firstName: baseAccountProfile.shippingAddress.firstName || '',
        lastName: baseAccountProfile.shippingAddress.lastName || '',
        address1: baseAccountProfile.shippingAddress.address1 || '',
        address2: baseAccountProfile.shippingAddress.address2 || '',
        city: baseAccountProfile.shippingAddress.city || '',
        province: baseAccountProfile.shippingAddress.province || '',
        zip: baseAccountProfile.shippingAddress.zip || '',
        country: baseAccountProfile.shippingAddress.country || 'US',
        phone: baseAccountProfile.shippingAddress.phone || ''
      });
    } else {
      setBaseAccountDebugInfo(prev => prev + '\n❌ Not pre-filling - conditions not met')
    }
  }, [baseAccountProfile, shippingData]);




  const handleCheckout = async () => {
    if (!hasItems) return;
    
    try {
      // Standard checkout flow
      console.log('🔄 Using standard checkout flow');
      proceedToCheckout();
      
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutError(`Checkout error: ${err.message}`);
    }
  };

  const proceedToCheckout = async () => {
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
      console.error('Proceed to checkout error:', err);
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
      // 🔧 FIX: Only apply free shipping if discount covers the ENTIRE cart
      if (appliedDiscount && appliedDiscount.freeShipping) {
        let shouldApplyFreeShipping = true;
        
        // For product-scoped discounts, check if discount covers all items
        if (appliedDiscount.discount_scope === 'product' && appliedDiscount.target_products && appliedDiscount.target_products.length > 0) {
          const subtotal = checkoutData.subtotal.amount;
          
          // Calculate total of targeted products only
          const discountableAmount = cart.items.reduce((total, item) => {
            const productHandle = item.product?.handle || item.handle || '';
            const isTargeted = appliedDiscount.target_products.some(targetHandle => 
              productHandle.includes(targetHandle) || targetHandle.includes(productHandle)
            );
            
            if (isTargeted) {
              const itemPrice = parseFloat(item.price || item.variant?.price || 0);
              const quantity = parseInt(item.quantity || 1);
              return total + (itemPrice * quantity);
            }
            return total;
          }, 0);
          
          // Only apply free shipping if discount covers the ENTIRE cart
          const tolerance = 0.01; // Allow 1 cent tolerance for rounding
          const coversEntireCart = Math.abs(discountableAmount - subtotal) < tolerance;
          
          if (!coversEntireCart) {
            console.log(`⚠️ Product-scoped discount doesn't cover entire cart - no free shipping`, {
              discountableAmount,
              subtotal,
              difference: subtotal - discountableAmount
            });
            shouldApplyFreeShipping = false;
          } else {
            console.log(`✅ Product-scoped discount covers entire cart - applying free shipping`);
          }
        }
        
        if (shouldApplyFreeShipping) {
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
        } else {
          console.log('💰 Free shipping NOT applied - user must pay for shipping');
        }
      }
      
      // Save checkout data to cart context
      updateCheckout(checkoutData);
      
      // AUTO-SELECT CHEAPEST SHIPPING OPTION
      // This skips the shipping selection screen for better UX
      if (checkoutData.shippingRates && checkoutData.shippingRates.length > 0) {
        // Sort by price (cheapest first)
        const sortedRates = [...checkoutData.shippingRates].sort((a, b) => 
          a.price.amount - b.price.amount
        );
        
        // Select the cheapest option (or free shipping if available)
        const cheapestRate = sortedRates[0];
        updateSelectedShipping(cheapestRate);
        
        console.log('🚀 Auto-selected cheapest shipping:', {
          option: cheapestRate.title,
          price: cheapestRate.price.amount === 0 ? 'FREE' : `$${cheapestRate.price.amount}`
        });
        
        // Skip shipping selection and go directly to payment
        setCheckoutStep('payment');
      } else {
        // No shipping rates available - show error
        setCheckoutStep('shipping-method');
      }
      
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

  const handleWalletConnectPayment = async () => {
    try {
      console.log('🔍 WalletConnect payment check:', {
        isWalletConnected,
        walletConnectAddress,
        connectionMethod,
        hasGetWalletProvider: !!getWalletProvider
      });
      
      if (!isWalletConnected || !walletConnectAddress) {
        console.error('❌ WalletConnect not ready:', {
          isWalletConnected,
          walletConnectAddress
        });
        throw new Error('WalletConnect not ready for payment');
      }

      if (!cart.checkout) {
        throw new Error('Checkout data not available');
      }

      if (!shippingData) {
        throw new Error('Shipping information is required');
      }

      setIsWalletConnectProcessing(true);
      setWalletConnectError(null);

      const finalTotal = calculateFinalTotal();
      const discountAmount = calculateProductAwareDiscountAmount();

      console.log('💳 Executing WalletConnect payment:', {
        total: finalTotal,
        walletAddress: walletConnectAddress,
        connectionMethod
      });

      // Get the provider and create a signer
      if (!getWalletProvider) {
        throw new Error('Wallet provider function not available');
      }
      
      const provider = await getWalletProvider();
      if (!provider) {
        throw new Error('Failed to get wallet provider');
      }

      // Import ethers and USDC contract details
      const { ethers } = await import('ethers');
      const { USDC_CONTRACT, PAYMENT_CONFIG, usdToUSDC } = await import('@/lib/usdc');

      // Create ethers provider and signer
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      
      // Verify the signer address matches our connected address
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== walletConnectAddress.toLowerCase()) {
        throw new Error('Wallet address mismatch');
      }

      // Check USDC balance
      const usdcContract = new ethers.Contract(USDC_CONTRACT.address, USDC_CONTRACT.abi, signer);
      const balance = await usdcContract.balanceOf(walletConnectAddress);
      const balanceFormatted = ethers.formatUnits(balance, 6); // USDC has 6 decimals
      
      console.log('💰 USDC Balance check:', {
        balance: balanceFormatted,
        required: finalTotal,
        sufficient: parseFloat(balanceFormatted) >= finalTotal
      });

      if (parseFloat(balanceFormatted) < finalTotal) {
        throw new Error(`Insufficient USDC balance. You need ${finalTotal} USDC but only have ${parseFloat(balanceFormatted).toFixed(2)} USDC`);
      }

      // Convert USD to USDC amount
      const usdcAmount = usdToUSDC(finalTotal);
      
      console.log('🚀 Initiating USDC transfer:', {
        from: walletConnectAddress,
        to: PAYMENT_CONFIG.merchantWallet,
        amount: finalTotal,
        usdcAmount: usdcAmount.toString(),
        contractAddress: USDC_CONTRACT.address,
        functionName: 'transfer'
      });

      // Execute the USDC transfer
      // Note: The amount should be visible in the wallet as this is a standard ERC-20 transfer
      // Some wallets may show "Transfer X USDC to address" in the transaction details
      const tx = await usdcContract.transfer(PAYMENT_CONFIG.merchantWallet, usdcAmount, {
        // Add gas limit to prevent estimation issues
        gasLimit: 100000n, // 100k gas should be enough for USDC transfer
      });
      
      console.log('📝 Transaction submitted:', tx.hash);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      console.log('✅ Transaction confirmed:', {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });

      // Enhanced FID resolution for WalletConnect users (same as handlePaymentSuccess)
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
      
      // Store FID in localStorage for future sessions (if we have one)
      if (userFid && typeof window !== 'undefined') {
        localStorage.setItem('farcaster_fid', userFid.toString());
      }
      
      // For WalletConnect users, FID might be null (anonymous) - this is fine
      if (!userFid) {
        console.log('ℹ️ WalletConnect order (no FID) - user not authenticated in Farcaster');
        userFid = null;
      }

      // Create order data with complete structure (same as handlePaymentSuccess)
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
        transactionHash: receipt.hash,
        notes: cart.notes || '',
        fid: userFid, // Add user's Farcaster ID for notifications (may be null)
        appliedDiscount: appliedDiscount, // Include discount information from CartContext
        discountAmount: discountAmount,
        appliedGiftCard: appliedGiftCard, // Include gift card information (for display)
        // SECURITY: Gift card amounts will be calculated server-side
        giftCards: appliedGiftCard ? [{
          code: appliedGiftCard.code,
          // Don't send amountUsed - server will calculate this
          balance: appliedGiftCard.balance
        }] : [],
        total: finalTotal, // Total amount that was actually paid
        paymentMethod: 'walletconnect',
        walletAddress: walletConnectAddress,
      };

      // Create order in Shopify (with authentication)
      const sessionToken = getSessionToken();
      const response = await fetch('/api/shopify/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ WalletConnect order created successfully:', result);
        setOrderDetails(result.order);
        setCheckoutStep('success');
        // DON'T clear cart here - it will be cleared when user clicks "Continue Shopping"
      } else {
        throw new Error(result.message || 'Order creation failed');
      }
      
    } catch (error) {
      console.error('💥 WalletConnect payment error:', error);
      setWalletConnectError(error.message);
    } finally {
      setIsWalletConnectProcessing(false);
    }
  };

  // Daimo Pay handlers
  const handleDaimoPaymentStarted = (event) => {
    console.log('💰 Daimo payment started:', event);
    daimoPaymentInitiated.current = true; // Mark that user initiated a payment
    setIsDaimoProcessing(true);
    setDaimoError(null);
  };

  const handleDaimoPaymentCompleted = async (event) => {
    console.log('✅ Daimo payment completed:', event);
    
    // CRITICAL: Only process if user actually initiated a payment
    if (!daimoPaymentInitiated.current) {
      console.log('⚠️ Ignoring cached Daimo payment - user did not initiate payment this session');
      return; // Ignore cached/auto-fired payments
    }
    
    // CRITICAL: Check if this transaction has already been processed
    const txHash = event.txHash || event.transactionHash;
    if (!txHash) {
      console.error('❌ No transaction hash in Daimo payment event!');
      setDaimoError('Invalid payment: no transaction hash');
      return;
    }
    
    if (processedDaimoTxHashes.current.has(txHash)) {
      console.log('⚠️ Transaction already processed, skipping duplicate:', txHash);
      return; // Skip duplicate processing
    }
    
    // Mark this transaction as processed immediately
    processedDaimoTxHashes.current.add(txHash);
    console.log('✅ Processing new transaction:', txHash);
    
    try {
      // Enhanced FID resolution (same as other payment methods)
      let userFid = getFid();
      
      if (!userFid && user?.fid) {
        userFid = user.fid;
        console.log('🔄 FID recovered from user object:', userFid);
      }
      
      if (!userFid && context?.user?.fid) {
        userFid = context.user.fid;
        console.log('🔄 FID recovered from context:', userFid);
      }
      
      if (!userFid && typeof window !== 'undefined' && window.userFid) {
        userFid = window.userFid;
        console.log('🔄 FID recovered from window.userFid:', userFid);
      }
      
      if (!userFid && typeof window !== 'undefined') {
        const storedFid = localStorage.getItem('farcaster_fid');
        if (storedFid && !isNaN(parseInt(storedFid))) {
          userFid = parseInt(storedFid);
          console.log('🔄 FID recovered from localStorage:', userFid);
        }
      }
      
      if (userFid && typeof window !== 'undefined') {
        localStorage.setItem('farcaster_fid', userFid.toString());
      }
      
      if (!userFid) {
        console.log('ℹ️ Daimo order (no FID) - user not authenticated in Farcaster');
        userFid = null;
      }

      const finalTotal = calculateFinalTotal();
      const discountAmount = calculateProductAwareDiscountAmount();

      // Create order data
      const orderData = {
        cartItems: cart.items,
        shippingAddress: shippingData,
        billingAddress: null,
        customer: {
          email: shippingData.email || '',
          phone: shippingData.phone || ''
        },
        checkout: cart.checkout,
        selectedShipping: cart.selectedShipping,
        transactionHash: event.txHash || event.transactionHash, // Daimo provides transaction hash
        notes: cart.notes || '',
        fid: userFid,
        appliedDiscount: appliedDiscount,
        discountAmount: discountAmount,
        appliedGiftCard: appliedGiftCard,
        giftCards: appliedGiftCard ? [{
          code: appliedGiftCard.code,
          balance: appliedGiftCard.balance
        }] : [],
        total: finalTotal,
        paymentMethod: 'daimo',
        paymentMetadata: {
          daimoPaymentId: event.paymentId || event.externalId,
          sourceChain: event.sourceChain,
          sourceToken: event.sourceToken
        }
      };

      // Create order in Shopify (with authentication)
      const sessionToken = getSessionToken();
      const response = await fetch('/api/shopify/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Daimo order created successfully:', result);
        
        // Set order details FIRST
        setOrderDetails(result.order);
        
        // Transition to success screen immediately (don't wait for modal)
        setCheckoutStep('success');
        
        // DON'T clear cart here - it will be cleared when user navigates away
        // or manually clears it. Clearing it here causes the success screen to disappear.
        
        // CRITICAL: Reset the payment initiation flag for next order in this session
        daimoPaymentInitiated.current = false;
        console.log('🔄 Reset payment initiation flag - ready for next order');
        
        // CRITICAL: Use Daimo's official resetPayment API to prepare for next payment
        const nextOrderId = `order-${Date.now()}`;
        setDaimoOrderId(nextOrderId);
        if (resetDaimoPayment) {
          resetDaimoPayment({
            externalId: nextOrderId,
          });
          console.log('🆕 Reset Daimo payment state for next order:', nextOrderId);
        }
      } else {
        throw new Error(result.message || 'Order creation failed');
      }
      
    } catch (error) {
      console.error('💥 Daimo payment error:', error);
      setDaimoError(error.message);
      // Reset flag on error too, so user can retry the payment
      daimoPaymentInitiated.current = false;
      // Generate new order ID for retry
      setDaimoOrderId(`order-${Date.now()}`);
    } finally {
      setIsDaimoProcessing(false);
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
      
      // Validate FID - only show error if user WAS authenticated but lost it
      // Anonymous users (dGEN1, desktop) can checkout without FID
      if (!userFid) {
        if (isInFarcaster || user) {
          // User was authenticated but lost FID - this is a problem
          console.error('❌ CRITICAL: Lost FID during checkout for authenticated user!', {
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
          userFid = null; // Proceed with anonymous order as fallback
        } else {
          // Anonymous user (dGEN1, desktop browser) - this is fine!
          console.log('ℹ️ Anonymous order (no FID) - user not authenticated in Farcaster/Base app');
          userFid = null;
        }
      }
      
      // Calculate the total that was actually paid (using the same logic as payment execution)
      const paidTotal = calculateFinalTotal();
      
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
        }] : [],
        total: paidTotal // CRITICAL: Total amount that was actually paid - used for payment reconciliation
      };

      const sessionToken = getSessionToken();
      const response = await fetch('/api/shopify/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
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
          const estimatedGiftCardDiscount = Math.min(typeof appliedGiftCard.balance === 'number' ? appliedGiftCard.balance : parseFloat(appliedGiftCard.balance), finalOrderTotal);
          finalOrderTotal -= estimatedGiftCardDiscount;
        }
        
        // Add taxes and shipping
        finalOrderTotal += calculateAdjustedTax() + shippingCost;
        
        // Ensure total doesn't go negative
        finalOrderTotal = Math.max(0, finalOrderTotal);
        
        // MINIMUM CHARGE: If total would be $0.00 or gift card covers entire order, charge $0.10 for payment processing
        // (Daimo Pay minimum is $0.10)
        const isCartFree = cartTotal <= 0.10;
        const totalBeforeGiftCard = (cart.checkout && cart.checkout.subtotal ? cart.checkout.subtotal.amount : cartSubtotal) - (appliedDiscount ? calculateProductAwareDiscountAmount() : 0) + calculateAdjustedTax() + shippingCost;
        const giftCardBalance = appliedGiftCard ? (typeof appliedGiftCard.balance === 'number' ? appliedGiftCard.balance : parseFloat(appliedGiftCard.balance)) : 0;
        
        if (giftCardBalance >= totalBeforeGiftCard && (isCartFree || giftCardBalance > 0)) {
          finalOrderTotal = 0.10;
          console.log('💰 Applied minimum charge of $0.10 for gift card order covering entire amount (Daimo minimum)');
        } else if (finalOrderTotal <= 0.10 && isCartFree) {
          finalOrderTotal = 0.10;
          console.log('💰 Applied minimum charge of $0.10 for free giveaway order processing (Daimo minimum)');
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
      // For non-mini-app environments, open Warpcast app with pre-filled cast
      try {
        const orderNumber = orderDetails.name.startsWith('#') ? orderDetails.name.substring(1) : orderDetails.name;
        const orderUrl = `${window.location.origin}/order/${orderNumber}?t=${Date.now()}`;
        const mainProduct = orderDetails.lineItems?.[0]?.title || orderDetails.lineItems?.[0]?.name || 'item';
        const shareText = `Just ordered my new ${mainProduct}!\n\nYou get 15% off your first order when you add the $mintedmerch mini app! 👀\n\nShop on @mintedmerch - pay onchain using 1200+ coins across 20+ chains ✨`;
        
        // Encode for URL
        const encodedText = encodeURIComponent(shareText);
        const encodedEmbed = encodeURIComponent(orderUrl);
        
        // Warpcast deep link format: warpcast://compose?text=...&embeds[]=...
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedEmbed}`;
        
        console.log('Opening Warpcast with share link:', warpcastUrl);
        
        // Open in new window/tab (will open Warpcast app on mobile)
        window.open(warpcastUrl, '_blank');
        
      } catch (err) {
        console.error('Error opening Warpcast:', err);
        
        // Fallback: copy link to clipboard
        try {
          const orderNumber = orderDetails.name.startsWith('#') ? orderDetails.name.substring(1) : orderDetails.name;
          await navigator.clipboard.writeText(`${window.location.origin}/order/${orderNumber}?t=${Date.now()}`);
          alert('Order link copied to clipboard!');
        } catch (clipErr) {
          console.log('Error copying to clipboard:', clipErr);
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
        const shareText = `Just ordered my new ${mainProduct}!\n\nYou get 15% off your first order when you add the $mintedmerch mini app! 👀\n\nShop on @mintedmerch - pay onchain using 1200+ coins across 20+ chains ✨`;
      
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
      {!isConnected && !isWalletConnected ? (
        // No wallet connected - show Connect Wallet button
        <div className="w-full space-y-2">
          <WalletConnectButton 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          />
          <p className="text-xs text-gray-500 text-center">
            Connect your wallet to proceed with checkout
          </p>
        </div>
      ) : isBaseApp && baseAccountSDK ? (
        // Base app experience - always show checkout button
        <div className="w-full space-y-2">
          <button
            onClick={handleCheckout}
            disabled={!hasItems}
            className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {(() => {
              const isCartFree = cartTotal <= 0.01;
              const isFreeWithShipping = isCartFree && appliedDiscount?.freeShipping;

              // Standard checkout button
              if (isFreeWithShipping) {
                return 'Checkout (FREE + $0.10 processing fee)';
              } else if (appliedDiscount?.freeShipping) {
                return `Checkout (${cartTotal.toFixed(2)} USDC + free shipping)`;
              } else if (appliedDiscount) {
                return `Checkout (${cartTotal.toFixed(2)} USDC + shipping & taxes)`;
              } else {
                return `Checkout (${cartTotal.toFixed(2)} USDC + shipping & taxes)`;
              }
            })()}
          </button>
        </div>
      ) : (
        // Standard Farcaster experience - wallet should be connected
        <div className="w-full space-y-2">
          <button
            onClick={handleCheckout}
            disabled={!hasItems}
            className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {(() => {
              const isCartFree = cartTotal <= 0.01;
              const isFreeWithShipping = isCartFree && appliedDiscount?.freeShipping;

              // Standard checkout button
              if (isFreeWithShipping) {
                return 'Checkout (FREE + $0.10 processing fee)';
              } else if (appliedDiscount?.freeShipping) {
                return `Checkout (${cartTotal.toFixed(2)} USDC + free shipping)`;
              } else if (appliedDiscount) {
                return `Checkout (${cartTotal.toFixed(2)} USDC + shipping & taxes)`;
              } else {
                return `Checkout (${cartTotal.toFixed(2)} USDC + shipping & taxes)`;
              }
            })()}
          </button>
        </div>
      )}


      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6), 0 10px 30px rgba(0, 0, 0, 0.4)' }}>
            
            {/* Header */}
            <div className="p-4 border-b">
                              {/* Base Account Status */}
              
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
                          <span>Gift Card (${(typeof appliedGiftCard.balance === 'number' ? appliedGiftCard.balance : parseFloat(appliedGiftCard.balance)).toFixed(2)} balance)</span>
                          <span>-${Math.min(typeof appliedGiftCard.balance === 'number' ? appliedGiftCard.balance : parseFloat(appliedGiftCard.balance), calculateTotalBeforeGiftCard()).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span>
                          {(() => {
                            const finalTotal = calculateFinalTotal();
                            if (finalTotal <= 0.10) {
                              return (appliedDiscount?.freeShipping || appliedGiftCard) ? (
                                <span className="text-green-600">$0.10 <span className="text-xs">(min processing fee)</span></span>
                              ) : (
                                <span className="text-green-600">FREE</span>
                              );
                            }
                            return `$${finalTotal.toFixed(2)}`;
                          })()}
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
                    {isCalculatingCheckout ? 'Calculating shipping & taxes...' : 'Continue to Payment'}
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

                  {/* Order Summary */}
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="font-medium">Order Summary</h3>
                    {(Array.isArray(cart.items) ? cart.items : []).map((item) => (
                      <div key={item.key} className="flex justify-between text-sm">
                        <span>{item.product?.title || item.title} {item.variant?.title && item.variant.title !== 'Default Title' && `(${item.variant.title})`} × {item.quantity}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 space-y-1">
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
                      
                      {/* Show shipping, taxes, and total once shipping is selected */}
                      {cart.selectedShipping && cart.checkout && (
                        <>
                          {appliedGiftCard && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Gift Card (${(typeof appliedGiftCard.balance === 'number' ? appliedGiftCard.balance : parseFloat(appliedGiftCard.balance)).toFixed(2)} balance)</span>
                              <span>-${calculateGiftCardDiscount().toFixed(2)}</span>
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
                          <div className="flex justify-between font-medium text-lg border-t pt-2 mt-2">
                            <span>Total</span>
                            <span>${calculateFinalTotal().toFixed(2)} USDC</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Shipping Methods */}
                  <div>
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
                  {(isConnected || isWalletConnected) && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600">Connected Wallet</div>
                      <div className="font-mono text-xs">
                        {isWalletConnected && connectionMethod === 'walletconnect' 
                          ? `${walletConnectAddress?.slice(0, 8)}...${walletConnectAddress?.slice(-6)}`
                          : `${address?.slice(0, 8)}...${address?.slice(-6)}`
                        }
                      </div>
                      {isConnected && (
                        <div className="text-sm mt-1">
                          Balance: {isLoadingBalance ? 'Loading...' : `${balanceNumber.toFixed(2)} USDC`}
                        </div>
                      )}
                      {isWalletConnected && connectionMethod === 'walletconnect' && (
                        <div className="text-sm mt-1">
                          Balance: {isLoadingWCBalance ? 'Loading...' : `${(walletConnectBalance || 0).toFixed(2)} USDC`}
                        </div>
                      )}
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
                        <span>${cartSubtotal.toFixed(2)}</span>
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
                          <span>Gift Card (${(typeof appliedGiftCard.balance === 'number' ? appliedGiftCard.balance : parseFloat(appliedGiftCard.balance)).toFixed(2)} balance)</span>
                          <span>-${calculateGiftCardDiscount().toFixed(2)}</span>
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

              {checkoutStep === 'payment' && walletConnectError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-red-800 text-sm font-medium">WalletConnect Payment Failed</div>
                  <div className="text-red-600 text-xs mt-1">{walletConnectError}</div>
                  <button
                    onClick={() => setWalletConnectError(null)}
                    className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {checkoutStep === 'payment' && isWalletConnectProcessing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-blue-800 text-sm">Processing WalletConnect payment...</div>
                </div>
              )}


              {/* Payment Actions - Only show in payment step */}
              {checkoutStep === 'payment' && paymentStatus === 'idle' && (isConnected || isWalletConnected) && (
                <div className="space-y-2">
                  {(() => {
                    const finalTotal = calculateFinalTotal();
                    
                    return isConnected && !hasSufficientBalance(finalTotal) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-red-800 text-sm">
                          Insufficient USDC balance. You need {finalTotal.toFixed(2)} USDC but only have {balanceNumber.toFixed(2)} USDC.
                        </div>
                      </div>
                    );
                  })()}

                  {/* Daimo Pay - Pay from ANY chain/token */}
                  {daimoError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-red-800 text-sm font-medium">Payment Failed</div>
                      <div className="text-red-600 text-xs mt-1">{daimoError}</div>
                      <button
                        onClick={() => setDaimoError(null)}
                        className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {isDaimoProcessing && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-blue-800 text-sm">Processing payment...</div>
                      <div className="text-blue-600 text-xs mt-1">Complete payment in the popup window</div>
                    </div>
                  )}

                  <DaimoPayButton
                    key={daimoOrderId} // Force remount when order ID changes (fixes amount update bug)
                    amount={calculateFinalTotal()}
                    orderId={daimoOrderId}
                    onPaymentStarted={handleDaimoPaymentStarted}
                    onPaymentCompleted={handleDaimoPaymentCompleted}
                    metadata={{
                      fid: String(getFid() || ''),
                      items: cart.items.map(i => i.product?.title || i.title).join(', '),
                      email: shippingData.email || ''
                    }}
                    disabled={!cart.checkout || isDaimoProcessing}
                  />
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
                        {orderDetails.status && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Status:</span>
                            <span className="font-medium text-green-600">{orderDetails.status}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium">
                            ${orderDetails.current_total_price || orderDetails.total?.amount || orderDetails.totalPrice || '0.00'} {orderDetails.total?.currencyCode || 'USD'}
                          </span>
                        </div>
                        {(orderDetails.customer?.email || shippingData.email) && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-medium">{orderDetails.customer?.email || shippingData.email}</span>
                          </div>
                        )}
                        {orderDetails.transactionHash && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Transaction:</span>
                            <span className="font-mono text-xs">{orderDetails.transactionHash.slice(0, 8)}...{orderDetails.transactionHash.slice(-6)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* Share Order Button */}
                      <button
                        onClick={handleShareOrder}
                        className="w-full bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                      >
                        {/* Official Farcaster Logo (2024 rebrand) */}
                        <svg className="w-5 h-5" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
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