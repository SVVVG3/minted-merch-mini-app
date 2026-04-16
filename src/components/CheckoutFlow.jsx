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
import { shareOrder } from '@/lib/farcasterShare';
import { useSignMessage, useAccount } from 'wagmi';
import { triggerHaptic } from '@/lib/haptics';
import { SwapPaymentSection } from './SwapPaymentSection';

import { ShippingForm } from './ShippingForm';
import GiftCardSection, { GiftCardBalance } from './GiftCardSection';
import { SignInWithBaseButton, BasePayButton } from './BaseAccountButtons';
import { WalletConnectButton } from './WalletConnectButton';
import { Portal } from './Portal';

export function CheckoutFlow({ checkoutData, onBack }) {
  const { cart, clearCart, updateShipping, updateCheckout, updateSelectedShipping, clearCheckout, addItem, cartSubtotal, cartTotal } = useCart();
  const { getFid, getSessionToken, isInFarcaster, user, context, getUsername, getDisplayName, getPfpUrl } = useFarcaster();
  const { isConnected: isWalletConnected, userAddress: walletConnectAddress, connectionMethod, getWalletProvider } = useWalletConnectContext();
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
  const [isUSDCProcessing, setIsUSDCProcessing] = useState(false);
  const [usdcError, setUSDCError] = useState(null);
  const [paymentTab, setPaymentTab] = useState('usdc'); // 'usdc' | 'swap'
  const buyNowProcessed = useRef(false);
  
  // Free order signature claim state
  const [isFreeOrderClaiming, setIsFreeOrderClaiming] = useState(false);
  const [freeOrderClaimError, setFreeOrderClaimError] = useState(null);
  
  // Get wagmi account for signature verification
  const { address: wagmiAddress } = useAccount();
  
  // Wagmi hook for personal_sign (for free order claims - more universally supported)
  const { signMessageAsync } = useSignMessage();

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
  // IMPORTANT: Always use cartSubtotal (from cart item prices) to match server-side calculation
  // Do NOT use cart.checkout.subtotal which can be stale or inconsistent
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
      // ALWAYS use cartSubtotal (calculated from cart item prices) to ensure 
      // client and server calculate the same discount amount
      const subtotal = cartSubtotal;
      
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
    if (!cart.checkout || !cart.checkout.tax) return 0;
    
    const originalTax = cart.checkout.tax.amount;
    
    // If no original tax, return 0
    if (originalTax <= 0 || cartSubtotal <= 0) return 0;
    
    // Use cartSubtotal for consistency with discount calculations
    // Calculate tax rate based on Shopify's calculated tax divided by our consistent subtotal
    const discount = calculateProductAwareDiscountAmount();
    const discountedSubtotal = cartSubtotal - discount;
    
    // If discounted subtotal is 0 or negative, no tax should be applied
    if (discountedSubtotal <= 0) return 0;
    
    // Use the tax rate from Shopify's calculation (tax / checkout subtotal if available, otherwise estimate)
    const checkoutSubtotal = cart.checkout.subtotal?.amount || cartSubtotal;
    const taxRate = checkoutSubtotal > 0 ? (originalTax / checkoutSubtotal) : 0;
    const adjustedTax = Math.max(0, discountedSubtotal * taxRate);
    
    return Math.round(adjustedTax * 100) / 100;
  };

  // Helper function to calculate total before gift card
  const calculateTotalBeforeGiftCard = () => {
    if (!cart.checkout || !cart.selectedShipping) return cartTotal;
    
    // Use cartSubtotal (from cart item prices) for consistency with server
    const subtotal = cartSubtotal;
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
  // $0 orders use signature claims; positive orders pay exact USDC amount
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
    
    // Return exact total (never negative); $0 orders use signature claim path
    return Math.max(0, totalBeforeGiftCard - giftCardDiscount);
  };
  
  // Check if this is a free order (for showing the right button)
  const isFreeOrder = () => {
    const total = calculateFinalTotal();
    return total === 0;
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
  
  // Reset USDC payment error when cart changes
  useEffect(() => {
    if (cart.items.length > 0) {
      setUSDCError(null);
    }
  }, [cart.items.length]);

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
    triggerHaptic('medium', isInFarcaster);
    try {
      setIsUSDCProcessing(true);
      setUSDCError(null);

      if (!isConnected) {
        throw new Error('Please connect your wallet to continue');
      }

      if (!shippingData) {
        throw new Error('Please provide shipping information');
      }

      if (!cart.checkout) {
        throw new Error('Checkout calculation not available');
      }

      const finalTotal = calculateFinalTotal();
      const discountAmount = calculateProductAwareDiscountAmount();

      console.log('💳 Executing USDC payment:', { total: finalTotal, isConnected, address });

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
      // setIsUSDCProcessing(false) handled by the useEffect watching paymentStatus

    } catch (error) {
      console.error('💥 Payment error:', error);
      setIsUSDCProcessing(false);
      triggerHaptic('error', isInFarcaster);

      const raw = error.message || '';
      let message;
      if (raw.includes('User rejected the request') || raw.includes('user rejected') || raw.includes('rejected')) {
        message = 'Payment cancelled. You rejected the transaction in your wallet.';
      } else if (raw.includes('connector.getChainId is not a function')) {
        message = 'Wallet connection issue. Please try refreshing the page.';
      } else if (raw.includes('Insufficient')) {
        message = raw; // keep our own balance error as-is
      } else {
        message = 'Payment failed. Please try again.';
      }
      setUSDCError(message);
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
        // 🔒 SAME FIX AS SPIN WHEEL: Send real Farcaster data from SDK
        userData: userFid ? {
          username: getUsername(),
          displayName: getDisplayName(),
          pfpUrl: getPfpUrl()
        } : null
      };

      // Create order in Shopify (with authentication)
      const sessionToken = getSessionToken();
      
      // Validate session token exists
      if (!sessionToken) {
        console.error('❌ No session token available for order creation');
        throw new Error('Authentication required. Please refresh the page and try again.');
      }
      
      console.log('📦 Creating order with authentication:', {
        hasToken: !!sessionToken,
        tokenLength: sessionToken?.length,
        hasOrderData: !!orderData,
        orderDataKeys: Object.keys(orderData)
      });
      
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

  // 🆓 FREE ORDER CLAIM HANDLER - For $0 orders using signature verification
  const handleFreeOrderClaim = async () => {
    try {
      setIsFreeOrderClaiming(true);
      setFreeOrderClaimError(null);
      
      console.log('🆓 Starting free order claim process...');
      
      // Get the user's wallet address
      const userWalletAddress = wagmiAddress || walletConnectAddress || userAddress;
      
      if (!userWalletAddress) {
        throw new Error('Please connect your wallet to claim this free order');
      }
      
      // Get FID with fallbacks
      let userFid = getFid();
      if (!userFid && user?.fid) userFid = user.fid;
      if (!userFid && context?.user?.fid) userFid = context.user.fid;
      
      if (!userFid) {
        throw new Error('Please sign in with Farcaster to claim this free order');
      }
      
      // Generate the order ID for this claim
      const orderId = `free-order-${Date.now()}`;
      const discountCode = appliedDiscount?.code || 'NONE';
      const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      const nonce = Date.now();
      
      // Create a simple message for personal_sign (more universally supported than EIP-712)
      // This message will be displayed to the user and signed
      const messageToSign = [
        'Minted Merch Free Order Claim',
        '',
        `Order ID: ${orderId}`,
        `Farcaster ID: ${userFid}`,
        `Discount Code: ${discountCode.toUpperCase()}`,
        `Item Count: ${itemCount}`,
        `Nonce: ${nonce}`,
        '',
        'Sign this message to confirm your free order.',
        'This does not cost any gas or funds.'
      ].join('\n');
      
      console.log('📝 Requesting signature for free order claim:', {
        orderId,
        fid: userFid,
        discountCode,
        itemCount,
        nonce,
        messagePreview: messageToSign.substring(0, 50) + '...',
        isInFarcaster: isInFarcaster
      });
      
      // Detect if we're in the Base app (not Farcaster/Warpcast)
      // Base app's embedded wallet doesn't support signing properly (returns all zeros)
      // Farcaster/Warpcast (clientFid 9152) works fine
      const isBaseApp = isInFarcaster && context?.client?.clientFid && context.client.clientFid !== 9152;
      
      console.log('🔍 Wallet context:', {
        isInFarcaster,
        clientFid: context?.client?.clientFid,
        isBaseApp
      });
      
      let signature = null;
      
      if (isBaseApp) {
        // Base app's embedded wallet doesn't support signing - skip it
        // Security is maintained through FID auth, discount validation, rate limiting
        console.log('ℹ️ Skipping signature for Base app (embedded wallet limitation)');
        signature = 'EMBEDDED_WALLET_SKIP';
      } else {
        // Farcaster/Warpcast and other contexts - signing works fine
        console.log('🔐 Requesting signature...');
        try {
          signature = await signMessageAsync({
            message: messageToSign,
          });
          
          // Validate signature isn't garbage
          if (!signature || signature.replace(/0x/i, '').replace(/0/g, '').length < 10) {
            console.warn('⚠️ Invalid signature received, using skip token');
            signature = 'EMBEDDED_WALLET_SKIP';
          }
        } catch (signError) {
          console.error('❌ Signing error:', signError);
          if (signError.message?.includes('rejected') || signError.message?.includes('cancelled') || signError.message?.includes('denied') || signError.code === 4001) {
            throw new Error('Signing was cancelled. Please try again.');
          }
          // For free orders, proceed without signature
          console.warn('⚠️ Signing failed, using skip token for free order');
          signature = 'EMBEDDED_WALLET_SKIP';
        }
      }
      
      console.log('✅ Signature ready:', signature.substring(0, 20) + '...');
      
      // Now submit the order with the signature
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error('Authentication required. Please refresh the page.');
      }
      
      const finalTotal = calculateFinalTotal();
      const discountAmount = calculateProductAwareDiscountAmount();
      
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
        paymentMethod: 'signature_claim',
        // Signature claim specific fields
        claimSignature: signature,
        claimSignatureMessage: JSON.stringify({
          orderId: orderId,
          fid: userFid.toString(),
          discountCode: discountCode.toUpperCase(),
          itemCount: itemCount.toString(),
          nonce: nonce.toString(),
        }),
        walletAddress: userWalletAddress,
        // User data for Farcaster profile
        userData: userFid ? {
          username: getUsername(),
          displayName: getDisplayName(),
          pfpUrl: getPfpUrl()
        } : null
      };
      
      console.log('📦 Submitting free order claim to API...');
      
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
        console.log('✅ Free order claimed successfully:', result);
        setOrderDetails(result.order);
        setCheckoutStep('success');
      } else {
        // Include details in error message for debugging
        let errorMsg = result.error || result.message || 'Order claim failed';
        if (result.details) {
          console.log('🔍 Error details:', result.details);
          errorMsg += ` (len: ${result.details.receivedLength || result.details.processedLength || 'unknown'})`;
        }
        throw new Error(errorMsg);
      }
      
    } catch (error) {
      console.error('💥 Free order claim error:', error);
      
      // Handle user rejection
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        setFreeOrderClaimError('Signature request was cancelled. Please try again.');
      } else {
        setFreeOrderClaimError(error.message || 'Failed to claim free order');
      }
    } finally {
      setIsFreeOrderClaiming(false);
    }
  };

  const handlePaymentSuccess = async (txHashOverride = null, paymentMethodOverride = 'usdc') => {
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

Transaction Hash: ${txHashOverride || transactionHash}`;
          
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
        transactionHash: txHashOverride || transactionHash,
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
        total: paidTotal, // CRITICAL: Total amount that was actually paid - used for payment reconciliation
        paymentMethod: paymentMethodOverride,
        // 🔒 SAME FIX AS SPIN WHEEL: Send real Farcaster data from SDK
        userData: userFid ? {
          username: getUsername(),
          displayName: getDisplayName(),
          pfpUrl: getPfpUrl()
        } : null
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
        
        // Always use cartSubtotal for consistency with server-side calculations
        let finalOrderTotal = cartSubtotal;
        
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
        
        // Ensure total doesn't go below zero
        finalOrderTotal = Math.max(0, finalOrderTotal);
        
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
        triggerHaptic('success', isInFarcaster);
        setOrderDetails(orderDetailsData);
        setCheckoutStep('success');
        setIsUSDCProcessing(false);
        
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
        
        setIsUSDCProcessing(false);
        alert(errorMessage);
        clearCart();
        setIsCheckoutOpen(false);
        resetPayment();
      }
      
    } catch (error) {
      console.error('Error creating order:', error);
      // Still clear cart but show warning
      setIsUSDCProcessing(false);
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
    // If closing from success screen, clear the cart
    if (checkoutStep === 'success') {
      clearCart();
    }
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

  // Share order - use exact same code path as product pages (shareOrder utility)
  const handleShareOrder = async () => {
    if (!orderDetails) return;

    // Add small delay to ensure order is fully processed in database
    await new Promise(resolve => setTimeout(resolve, 2000));

    const orderNumber = orderDetails.name.startsWith('#') ? orderDetails.name.substring(1) : orderDetails.name;
    const mainProduct = orderDetails.lineItems?.[0]?.title || orderDetails.lineItems?.[0]?.name || 'item';
    
    // Use the shared utility function - IDENTICAL to how ProductDetail uses shareProduct
    await shareOrder({
      orderNumber,
      mainProduct,
      isInFarcaster,
    });
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
              // NEW LOGIC:
              // - Exactly $0 with free shipping: Show "FREE" (signature claim)
              // - $0.01-$0.24 with free shipping: Show "$0.25 min fee"  
              // - Other amounts: Show actual amount
              const isExactlyFree = cartTotal === 0 && appliedDiscount?.freeShipping;
              const isUnderMinimum = cartTotal > 0 && cartTotal < 0.25 && appliedDiscount?.freeShipping;

              if (isExactlyFree) {
                return 'Checkout (FREE)';
              } else if (isUnderMinimum) {
                return 'Checkout ($0.25 USDC min + free shipping)';
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
              // NEW LOGIC:
              // - Exactly $0 with free shipping: Show "FREE" (signature claim)
              // - $0.01-$0.24 with free shipping: Show "$0.25 min fee"  
              // - Other amounts: Show actual amount
              const isExactlyFree = cartTotal === 0 && appliedDiscount?.freeShipping;
              const isUnderMinimum = cartTotal > 0 && cartTotal < 0.25 && appliedDiscount?.freeShipping;

              if (isExactlyFree) {
                return 'Checkout (FREE)';
              } else if (isUnderMinimum) {
                return 'Checkout ($0.25 USDC min + free shipping)';
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
        <Portal>
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
                        Digital products will be delivered via email - no shipping address needed!
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
                          <span>Discount ({appliedDiscount.discountType === 'fixed' ? `$${appliedDiscount.discountValue}` : `${appliedDiscount.discountValue}%`})</span>
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
                            // $0 = FREE (signature claim), $0.01-$0.24 = $0.25 min, $0.25+ = exact
                            if (finalTotal === 0) {
                              return <span className="text-green-600">FREE</span>;
                            }
                            return `$${finalTotal.toFixed(2)}`;
                          })()}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {isDigitalOnlyCart() ? (
                        <span className="text-blue-600 font-medium">Digital products - no shipping required!</span>
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
                          <span>Discount ({appliedDiscount.discountType === 'fixed' ? `$${appliedDiscount.discountValue}` : `${appliedDiscount.discountValue}%`})</span>
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
                            <span className="text-green-600 text-xs">Digital delivery via email</span>
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
                          <span>Discount ({appliedDiscount.discountType === 'fixed' ? `$${appliedDiscount.discountValue}` : `${appliedDiscount.discountValue}%`})</span>
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
                  {/* Insufficient balance warning */}
                  {(() => {
                    const finalTotal = calculateFinalTotal();
                    if (finalTotal === 0) return null;
                    return isConnected && !hasSufficientBalance(finalTotal) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-red-800 text-sm">
                          Insufficient USDC balance. You need {finalTotal.toFixed(2)} USDC but only have {balanceNumber.toFixed(2)} USDC.
                        </div>
                      </div>
                    );
                  })()}

                  {/* USDC payment error */}
                  {usdcError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                      <div className="text-red-800 text-sm font-semibold mb-1">Payment Failed</div>
                      <div className="text-red-600 text-sm">{usdcError}</div>
                      <button
                        onClick={() => setUSDCError(null)}
                        className="mt-3 bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {/* Free order claim - For $0 orders */}
                  {isFreeOrder() ? (
                    <div className="space-y-2">
                      {freeOrderClaimError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="text-red-800 text-sm font-medium">Claim Failed</div>
                          <div className="text-red-600 text-xs mt-1">{freeOrderClaimError}</div>
                          <button
                            onClick={() => setFreeOrderClaimError(null)}
                            className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                          >
                            Try Again
                          </button>
                        </div>
                      )}
                      
                      {isFreeOrderClaiming && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="text-green-800 text-sm">Claiming your free order...</div>
                          <div className="text-green-600 text-xs mt-1">Please sign the message in your wallet</div>
                        </div>
                      )}
                      
                      <button
                        onClick={handleFreeOrderClaim}
                        disabled={!cart.checkout || isFreeOrderClaiming}
                        className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                      >
                        <span>{isFreeOrderClaiming ? 'Claiming...' : 'Claim Free Order'}</span>
                      </button>
                      
                      <p className="text-xs text-gray-500 text-center">
                        Sign with your wallet to confirm your free order
                      </p>
                    </div>
                  ) : (
                    /* Payment method selector — USDC or token swap */
                    <div className="space-y-3">
                      {/* Payment tab selector */}
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => setPaymentTab('usdc')}
                          className={`flex-1 py-2 text-sm font-medium transition-colors ${paymentTab === 'usdc' ? 'bg-[#3eb489] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          USDC
                        </button>
                        <button
                          onClick={() => setPaymentTab('swap')}
                          className={`flex-1 py-2 text-sm font-medium transition-colors ${paymentTab === 'swap' ? 'bg-[#3eb489] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          Other Token
                        </button>
                      </div>

                      {paymentTab === 'usdc' ? (
                        /* Direct USDC payment */
                        <div className="space-y-2">
                          <button
                            onClick={handlePayment}
                            disabled={!cart.checkout || isUSDCProcessing || (isConnected && !hasSufficientBalance(calculateFinalTotal()))}
                            className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                          >
                            <span>{isUSDCProcessing ? 'Sending...' : `Pay $${calculateFinalTotal().toFixed(2)} USDC`}</span>
                          </button>
                          <p className="text-xs text-gray-500 text-center">
                            Pay directly with USDC on Base
                          </p>
                        </div>
                      ) : (
                        /* SwapPaymentSection is only mounted when this tab is active —
                           @spandex/core never loads for USDC-only checkouts */
                        <SwapPaymentSection
                          usdAmount={calculateFinalTotal()}
                          isProcessing={isUSDCProcessing}
                          onSwapStart={() => {
                            triggerHaptic('medium', isInFarcaster);
                            setIsUSDCProcessing(true);
                            setUSDCError(null);
                          }}
                          onSwapSuccess={async (txHash) => {
                            await handlePaymentSuccess(txHash, 'swap');
                          }}
                          onSwapError={(message) => {
                            setIsUSDCProcessing(false);
                            triggerHaptic('error', isInFarcaster);
                            setUSDCError(message);
                          }}
                        />
                      )}
                    </div>
                  )}
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
        </Portal>
      )}
    </>
  );
}