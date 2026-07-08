'use client';

import React, { createContext, useContext, useReducer, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getBestAvailableDiscount } from './discounts';
import {
  resolveSupabaseIdsForCustomItems,
  cartItemQualifiesForDiscount,
  formatDiscountForCart,
  isProductScopedDiscount,
  isDesignStudioCartItem,
} from './customDesignDiscounts';
import { useFarcaster } from './useFarcaster';

// Cart Context
const CartContext = createContext();

// Cart action types
const CART_ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  LOAD_CART: 'LOAD_CART',
  UPDATE_NOTES: 'UPDATE_NOTES',
  UPDATE_SHIPPING: 'UPDATE_SHIPPING',
  UPDATE_CHECKOUT: 'UPDATE_CHECKOUT',
  UPDATE_SELECTED_SHIPPING: 'UPDATE_SELECTED_SHIPPING',
  CLEAR_CHECKOUT: 'CLEAR_CHECKOUT',
  APPLY_DISCOUNT: 'APPLY_DISCOUNT',
  REMOVE_DISCOUNT: 'REMOVE_DISCOUNT'
};

// Cart reducer function
function cartReducer(state, action) {
  switch (action.type) {
    case CART_ACTIONS.ADD_ITEM: {
      const { product, variant, quantity = 1, options = {} } = action.payload;
      
      // Custom design items always get a unique key so the same product can be
      // ordered multiple times with different designs (no quantity merging).
      const itemKey = options?.customMeta?.designRequestId
        ? `${product.id}-custom-${options.customMeta.designRequestId}`
        : `${product.id}-${variant?.id || 'default'}`;
      
      // Check if item already exists in cart (only merge non-custom items)
      const existingItemIndex = !options?.customMeta?.designRequestId
        ? state.items.findIndex(item => item.key === itemKey)
        : -1;
      
      if (existingItemIndex >= 0) {
        // Update quantity of existing item
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex].quantity += quantity;
        return {
          ...state,
          items: updatedItems
        };
      } else {
        // Add new item to cart
        const newItem = {
          key: itemKey,
          product: {
            id: product.id,
            title: product.title,
            handle: product.handle,
            image: variant?.image || product.images?.edges?.[0]?.node || null,
            supabaseId: product.supabaseId || null // Preserve Supabase ID for discount targeting
          },
          variant: variant || null,
          quantity: quantity,
          price: parseFloat(variant?.price?.amount || product.priceRange?.minVariantPrice?.amount || '0'),
          // Custom design studio fields — null for regular products
          customImageUrl: options?.customImageUrl || null,
          customMeta: options?.customMeta || null, // { designRequestId, productType, size }
        };
        
        return {
          ...state,
          items: [...state.items, newItem]
        };
      }
    }
    
    case CART_ACTIONS.REMOVE_ITEM: {
      const { itemKey } = action.payload;
      return {
        ...state,
        items: state.items.filter(item => item.key !== itemKey)
      };
    }
    
    case CART_ACTIONS.UPDATE_QUANTITY: {
      const { itemKey, quantity } = action.payload;
      
      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        return {
          ...state,
          items: state.items.filter(item => item.key !== itemKey)
        };
      }
      
      const updatedItems = state.items.map(item =>
        item.key === itemKey ? { ...item, quantity } : item
      );
      
      return {
        ...state,
        items: updatedItems
      };
    }
    
    case CART_ACTIONS.CLEAR_CART: {
      return {
        ...state,
        items: [],
        notes: '',
        shipping: null,
        checkout: null,
        selectedShipping: null,
        appliedDiscount: null
      };
    }
    
    case CART_ACTIONS.UPDATE_NOTES: {
      return {
        ...state,
        notes: action.payload.notes
      };
    }
    
    case CART_ACTIONS.UPDATE_SHIPPING: {
      return {
        ...state,
        shipping: action.payload.shipping
      };
    }
    
    case CART_ACTIONS.UPDATE_CHECKOUT: {
      return {
        ...state,
        checkout: action.payload.checkout
      };
    }
    
    case CART_ACTIONS.UPDATE_SELECTED_SHIPPING: {
      return {
        ...state,
        selectedShipping: action.payload.selectedShipping
      };
    }
    
        case CART_ACTIONS.CLEAR_CHECKOUT: {
      return {
        ...state,
        checkout: null,
        selectedShipping: null
      };
    }

    case CART_ACTIONS.APPLY_DISCOUNT: {
      return {
        ...state,
        appliedDiscount: action.payload.discount
      };
    }

    case CART_ACTIONS.REMOVE_DISCOUNT: {
      return {
        ...state,
        appliedDiscount: null
      };
    }

    case CART_ACTIONS.LOAD_CART: {
      return {
        ...state,
        items: action.payload.items || [],
        notes: action.payload.notes || '',
        shipping: action.payload.shipping || null,
        checkout: action.payload.checkout || null,
        selectedShipping: action.payload.selectedShipping || null,
        appliedDiscount: action.payload.appliedDiscount || null
      };
    }
    
    default:
      return state;
  }
}

// Initial cart state
const initialCartState = {
  items: [],
  notes: '',
  shipping: null,
  checkout: null,
  selectedShipping: null,
  appliedDiscount: null
};

// Cart Provider Component
export function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, initialCartState);
  const [isEvaluatingDiscount, setIsEvaluatingDiscount] = useState(false);
  const customSupabaseIdsRef = useRef(new Map());
  const [customSupabaseIds, setCustomSupabaseIds] = useState(() => new Map());
  
  // Get Farcaster context for FID access
  const { getFid, user, context, isReady } = useFarcaster();

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('mintedmerch-cart');
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        dispatch({ type: CART_ACTIONS.LOAD_CART, payload: parsedCart });
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
    }
  }, []);

  // Save cart to localStorage whenever cart changes
  useEffect(() => {
    try {
      localStorage.setItem('mintedmerch-cart', JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
      // In Mini App environments, localStorage might be restricted
      // We'll continue without persistence rather than breaking the app
    }
  }, [cart]);

  // Resolve Supabase product IDs for custom design lines as soon as they enter the cart
  useEffect(() => {
    const designItems = (cart.items || []).filter((item) => isDesignStudioCartItem(item));
    if (designItems.length === 0) {
      customSupabaseIdsRef.current = new Map();
      setCustomSupabaseIds(new Map());
      return;
    }

    let cancelled = false;
    resolveSupabaseIdsForCustomItems(cart.items).then((resolved) => {
      if (cancelled) return;
      customSupabaseIdsRef.current = resolved;
      setCustomSupabaseIds(new Map(resolved));
    });

    return () => {
      cancelled = true;
    };
  }, [cart.items]);

  // AUTO-EVALUATE DISCOUNT - OPTIMIZED WITH BETTER DEBOUNCING
  useEffect(() => {
    // Defensive checks to prevent crashes
    if (!cart || typeof cart !== 'object') {
      return;
    }
    
    const safeItems = Array.isArray(cart.items) ? cart.items : [];
    
    // Only trigger if we have items
    if (safeItems.length === 0) {
      return;
    }
    
    if (isEvaluatingDiscount) {
      return;
    }
    
    const userFid = getUserFid();
    if (!userFid) {
      return;
    }
    
    // Create a stable key for cart contents to prevent unnecessary re-evaluations
    const cartKey = safeItems.map(item => `${item.product?.handle}-${item.quantity}`).sort().join('|');
    const currentDiscountCode = cart.appliedDiscount?.code || 'none';
    
    // Check if we've already evaluated this exact cart state recently
    const lastEvaluationKey = `${cartKey}-${currentDiscountCode}`;
    const lastEvaluation = sessionStorage.getItem('lastDiscountEvaluation');
    
    if (lastEvaluation === lastEvaluationKey) {
      return; // Skip if we've already evaluated this exact state
    }
    
    // Debounce the evaluation to prevent too many API calls
    const timeoutId = setTimeout(async () => {
      try {
        setIsEvaluatingDiscount(true);
        
        // Add rate limiting to prevent excessive API calls
        const now = Date.now();
        const lastApiCall = sessionStorage.getItem('lastDiscountApiCall');
        const minInterval = 15000; // Reduced to 15 seconds for better UX (was 30s)
        
        if (lastApiCall && (now - parseInt(lastApiCall)) < minInterval) {
          console.log('⏸️ Skipping discount evaluation - too soon since last API call');
          return;
        }
        
        sessionStorage.setItem('lastDiscountApiCall', now.toString());
        
        const bestDiscount = await evaluateOptimalDiscount(userFid);
        const currentDiscount = cart.appliedDiscount;
        
        if (bestDiscount) {
          // Check if we need to apply/update the discount
          if (!currentDiscount || currentDiscount.code !== bestDiscount.code) {
            applyDiscount(bestDiscount);
            
            // Store in session storage for consistency
            sessionStorage.setItem('activeDiscountCode', JSON.stringify({
              code: bestDiscount.code,
              source: 'auto_cart_evaluation',
              discountType: bestDiscount.discountType,
              discountValue: bestDiscount.discountValue,
              timestamp: new Date().toISOString(),
              isTokenGated: bestDiscount.isTokenGated,
              gatingType: bestDiscount.gating_type
            }));
          }
        } else {
          // No discount found - remove current discount if any
          if (currentDiscount) {
            removeDiscount();
          }
        }
        
        // Store the evaluation key to prevent re-evaluation of same state
        sessionStorage.setItem('lastDiscountEvaluation', lastEvaluationKey);
        
      } catch (error) {
        console.error('❌ Error in auto-evaluation:', error);
      } finally {
        setIsEvaluatingDiscount(false);
      }
    }, 1000); // Increased debounce to 1 second

    return () => clearTimeout(timeoutId);
  }, [cart.items, cart.appliedDiscount, isReady, getFid, user, context]);

  // Helper function to get user FID using Farcaster hook (same logic as CheckoutFlow)
  const getUserFid = () => {
    try {
      // Method 1: Try to get FID from Farcaster hook
      let userFid = getFid();
      
      // Fallback 1: Try to get FID from stored Farcaster user
      if (!userFid && user?.fid) {
        userFid = user.fid;
        console.log('🔄 Cart: FID recovered from user object:', userFid);
      }
      
      // Fallback 2: Try to get FID from Farcaster context
      if (!userFid && context?.user?.fid) {
        userFid = context.user.fid;
        console.log('🔄 Cart: FID recovered from context:', userFid);
      }
      
      // Fallback 3: Try to get FID from window.userFid (frame initialization)
      if (!userFid && typeof window !== 'undefined' && window.userFid) {
        userFid = window.userFid;
        console.log('🔄 Cart: FID recovered from window.userFid:', userFid);
      }
      
      // Fallback 4: Try to get FID from localStorage persistence
      if (!userFid && typeof window !== 'undefined') {
        const storedFid = localStorage.getItem('farcaster_fid');
        if (storedFid && !isNaN(parseInt(storedFid))) {
          userFid = parseInt(storedFid);
          console.log('🔄 Cart: FID recovered from localStorage:', userFid);
        }
      }
      
      // Fallback 5: Check for FID in active discount data
      if (!userFid) {
        const activeDiscountData = sessionStorage.getItem('activeDiscountCode');
        if (activeDiscountData) {
          const discountData = JSON.parse(activeDiscountData);
          if (discountData.fid) {
            userFid = discountData.fid;
            console.log('🔄 Cart: FID recovered from active discount data:', userFid);
          }
        }
      }
      
      // Store FID in localStorage for future sessions (if we have one)
      if (userFid && typeof window !== 'undefined') {
        localStorage.setItem('farcaster_fid', userFid.toString());
      }
      
      console.log('🔍 Cart: Final FID result:', userFid);
      return userFid;
    } catch (error) {
      console.error('Error getting user FID in cart:', error);
      return null;
    }
  };

  // Simplified cart logic - discounts are now pre-calculated by enhanced API
  // No more complex re-evaluation needed!

  // Cart actions
  const addItem = (product, variant, quantity = 1, options = {}) => {
    dispatch({
      type: CART_ACTIONS.ADD_ITEM,
      payload: { product, variant, quantity, options }
    });
    
    console.log('✅ Added item to cart:', product.title, options?.customMeta ? `(custom design ${options.customMeta.designRequestId})` : '');
    // Auto-evaluation will happen via useEffect
  };

  const removeItem = (itemKey) => {
    dispatch({
      type: CART_ACTIONS.REMOVE_ITEM,
      payload: { itemKey }
    });
    // Auto-evaluation will happen via useEffect
  };

  const updateQuantity = (itemKey, quantity) => {
    dispatch({
      type: CART_ACTIONS.UPDATE_QUANTITY,
      payload: { itemKey, quantity }
    });
    // Auto-evaluation will happen via useEffect
  };

  const clearCart = () => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART });
    
    // Clear discount evaluation tracking from sessionStorage
    // This ensures discounts are properly re-evaluated when items are added to a new cart
    sessionStorage.removeItem('lastDiscountEvaluation');
    sessionStorage.removeItem('lastDiscountApiCall');
    sessionStorage.removeItem('activeDiscountCode');
    
    console.log('🧹 Cart cleared - discount evaluation cache cleared');
  };

  const updateNotes = (notes) => {
    dispatch({
      type: CART_ACTIONS.UPDATE_NOTES,
      payload: { notes }
    });
  };

  const updateShipping = (shipping) => {
    dispatch({
      type: CART_ACTIONS.UPDATE_SHIPPING,
      payload: { shipping }
    });
  };

  const updateCheckout = (checkout) => {
    dispatch({
      type: CART_ACTIONS.UPDATE_CHECKOUT,
      payload: { checkout }
    });
  };

  const updateSelectedShipping = (selectedShipping) => {
    dispatch({
      type: CART_ACTIONS.UPDATE_SELECTED_SHIPPING,
      payload: { selectedShipping }
    });
  };

  const clearCheckout = () => {
    dispatch({ type: CART_ACTIONS.CLEAR_CHECKOUT });
  };

  const applyDiscount = (discount) => {
    dispatch({
      type: CART_ACTIONS.APPLY_DISCOUNT,
      payload: { discount }
    });
    
    // If discount includes free shipping, update shipping rates to include free option
    if (discount.freeShipping && cart.checkout?.shippingRates) {
      const freeShippingRate = cart.checkout.shippingRates.find(rate => rate.price.amount === 0);
      if (!freeShippingRate) {
        // Create a free shipping rate
        const discountFreeShipping = {
          handle: 'discount-free-shipping',
          title: 'FREE Shipping (Discount Applied)',
          price: { amount: 0, currencyCode: 'USD' },
          description: 'Free shipping provided by discount code'
        };
        
        // Add the free shipping rate to available rates and select it
        dispatch({
          type: CART_ACTIONS.UPDATE_CHECKOUT,
          payload: { 
            checkout: {
              ...cart.checkout,
              shippingRates: [discountFreeShipping, ...(cart.checkout?.shippingRates || [])]
            }
          }
        });
        
        dispatch({
          type: CART_ACTIONS.UPDATE_SELECTED_SHIPPING,
          payload: { selectedShipping: discountFreeShipping }
        });
      } else {
        // Select existing free shipping rate
        dispatch({
          type: CART_ACTIONS.UPDATE_SELECTED_SHIPPING,
          payload: { selectedShipping: freeShippingRate }
        });
      }
    }
  };

  const removeDiscount = () => {
    dispatch({ type: CART_ACTIONS.REMOVE_DISCOUNT });
  };

  // Safety wrapper to ensure cart always has valid items array
  // MEMOIZED to prevent infinite re-renders when used as useEffect dependency
  const safeCart = useMemo(() => ({
    ...cart,
    items: Array.isArray(cart.items) ? cart.items : []
  }), [cart]);

  // Cart calculations using safeCart
  // MEMOIZED to prevent infinite re-renders in CheckoutFlow
  const cartSubtotal = useMemo(() => {
    return safeCart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }, [safeCart.items]);

  // Helper function to calculate product-aware discount amount
  const calculateProductAwareDiscount = useMemo(() => {
    if (!safeCart.appliedDiscount) return 0;

    const { discountType, discountValue } = safeCart.appliedDiscount;
    const isProductSpecific = isProductScopedDiscount(safeCart.appliedDiscount);

    let discountAmount = 0;

    if (isProductSpecific) {
      let qualifyingSubtotal = 0;

      safeCart.items.forEach((item) => {
        if (cartItemQualifiesForDiscount(item, safeCart.appliedDiscount, customSupabaseIds)) {
          qualifyingSubtotal += item.price * item.quantity;
        }
      });

      // Fallback: token-gated / auto-matched product discount on a design-studio-only cart
      if (qualifyingSubtotal === 0) {
        const designItems = safeCart.items.filter(isDesignStudioCartItem);
        const autoMatched =
          safeCart.appliedDiscount.isTokenGated ||
          safeCart.appliedDiscount.sourceProduct?.startsWith('custom-design');
        if (autoMatched && designItems.length > 0 && designItems.length === safeCart.items.length) {
          qualifyingSubtotal = designItems.reduce((total, item) => total + item.price * item.quantity, 0);
        }
      }

      if (discountType === 'fixed') {
        discountAmount = Math.min(discountValue, qualifyingSubtotal);
      } else {
        discountAmount = qualifyingSubtotal * (discountValue / 100);
      }
    } else {
      if (discountType === 'fixed') {
        discountAmount = Math.min(discountValue, cartSubtotal);
      } else {
        discountAmount = cartSubtotal * (discountValue / 100);
      }
    }

    return Math.round(discountAmount * 100) / 100;
  }, [safeCart.appliedDiscount, safeCart.items, cartSubtotal, customSupabaseIds]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - calculateProductAwareDiscount);
  }, [cartSubtotal, calculateProductAwareDiscount]);

  const itemCount = useMemo(() => {
    return safeCart.items.reduce((count, item) => {
      return count + item.quantity;
    }, 0);
  }, [safeCart.items]);

  // Helper function to check if a specific variant is in cart
  // MEMOIZED to prevent infinite re-renders in consuming components
  const isInCart = useCallback((productId, variantId = null) => {
    const itemKey = `${productId}-${variantId || 'default'}`;
    return (cart.items || []).some(item => item.key === itemKey);
  }, [cart.items]);

  // Helper function to get quantity of specific item in cart
  // MEMOIZED to prevent infinite re-renders in consuming components
  const getItemQuantity = useCallback((productId, variantId = null) => {
    const itemKey = `${productId}-${variantId || 'default'}`;
    const item = (cart.items || []).find(item => item.key === itemKey);
    return item ? item.quantity : 0;
  }, [cart.items]);

  // Re-enabled: Function to evaluate and select the optimal discount for current cart
  // MEMOIZED to prevent infinite re-renders in consuming components
  const evaluateOptimalDiscount = useCallback(async (userFid) => {
    try {
      console.log('🎯 Evaluating optimal discount for cart:', safeCart.items.map(item => item.product?.handle || 'unknown'));
      
      // Validate input
      if (!userFid || typeof userFid !== 'number') {
        console.log('❌ Invalid user FID provided:', userFid);
        return null;
      }
      
      if (safeCart.items.length === 0) {
        console.log('❌ Cart is empty, no discount evaluation needed');
        return null;
      }
      
      // Check if cart contains gift cards - if so, don't auto-apply discounts
      const { cartContainsGiftCards } = await import('./discounts');
      if (cartContainsGiftCards(safeCart.items)) {
        console.log('🚫 Cart contains gift cards - skipping auto-discount evaluation');
        return null;
      }
      
      // Custom design items use fake handles — resolve their real Supabase product IDs
      // so product-scoped discounts (e.g. Design Studio Custom T-Shirt) can match.
      const customItems = safeCart.items.filter((item) => isDesignStudioCartItem(item));
      const hasCustomItems = customItems.length > 0;

      if (hasCustomItems) {
        const resolvedIds = await resolveSupabaseIdsForCustomItems(safeCart.items);
        customSupabaseIdsRef.current = resolvedIds;
        setCustomSupabaseIds(new Map(resolvedIds));
        console.log('🎨 Resolved custom design Supabase IDs:', Object.fromEntries(resolvedIds));
      }

      const regularItems = safeCart.items.filter((item) => !isDesignStudioCartItem(item));
      
      // Get unique product handles and their Supabase IDs
      const uniqueProducts = [];
      const productHandles = [...new Set(regularItems.map(item => item.product?.handle).filter(Boolean))];
      
      console.log('🔍 Unique products in cart:', productHandles, hasCustomItems ? '(+ custom design items)' : '');
      
      // For each regular product, get its Supabase ID and discount data
      for (const handle of productHandles) {
        try {
          const response = await fetch(`/api/shopify/products?handle=${handle}&fid=${userFid}`);
          if (response.ok) {
            const productData = await response.json();
            if (productData.supabaseId && productData.availableDiscounts) {
              uniqueProducts.push({
                handle,
                supabaseId: productData.supabaseId,
                availableDiscounts: productData.availableDiscounts
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching discount data for product ${handle}:`, error);
        }
      }
      
      console.log('📊 Products with discount data:', uniqueProducts.map(p => ({ handle: p.handle, hasBest: !!p.availableDiscounts?.best })));
      
      // Collect all available discounts from all products
      const allAvailableDiscounts = [];
      
      uniqueProducts.forEach(product => {
        if (product.availableDiscounts?.best) {
          allAvailableDiscounts.push({
            ...product.availableDiscounts.best,
            sourceProduct: product.handle
          });
        }
      });

      // Product-specific discounts for custom design / Limited Drop lines
      if (hasCustomItems) {
        const customSupabaseIds = [...new Set(customSupabaseIdsRef.current.values())];
        for (const supabaseId of customSupabaseIds) {
          try {
            const discountRes = await fetch(
              `/api/user-discounts?fid=${userFid}&mode=best&scope=product&productIds=${encodeURIComponent(JSON.stringify([supabaseId]))}`
            );
            if (discountRes.ok) {
              const discountData = await discountRes.json();
              if (discountData.success && discountData.discountCode) {
                allAvailableDiscounts.push({
                  ...discountData.discountCode,
                  sourceProduct: `custom-design-${supabaseId}`,
                });
              }
            }
          } catch (discountErr) {
            console.error(`Error fetching custom design discount for product ${supabaseId}:`, discountErr);
          }
        }
      }

      // Token-gated discounts (site-wide + product-specific for custom lines)
      const customSupabaseIds = hasCustomItems ? [...new Set(customSupabaseIdsRef.current.values())] : [];
      const needsTokenGatedFallback =
        hasCustomItems &&
        (customSupabaseIds.length > 0 || allAvailableDiscounts.length === 0);

      if (needsTokenGatedFallback) {
        console.log('🎫 Checking token-gated discounts for custom design cart', customSupabaseIds);
        try {
          const tokenRes = await fetch('/api/check-token-gated-eligibility', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fid: userFid,
              scope: customSupabaseIds.length > 0 ? 'all' : 'site_wide',
              productIds: customSupabaseIds,
            }),
          });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            if (tokenData.success && tokenData.eligibleDiscounts?.length > 0) {
              console.log(`🎫 Found ${tokenData.eligibleDiscounts.length} token-gated discount(s) for custom design cart`);
              tokenData.eligibleDiscounts.forEach((d) => {
                const targetIds = Array.isArray(d.target_product_ids) ? d.target_product_ids : [];
                const matchedId = customSupabaseIds.find((id) =>
                  targetIds.some((targetId) => Number(targetId) === Number(id))
                );
                allAvailableDiscounts.push({
                  ...d,
                  isTokenGated: true,
                  sourceProduct: matchedId != null ? `custom-design-${matchedId}` : 'custom-design',
                });
              });
            }
          }
        } catch (tokenErr) {
          console.error('Token eligibility fallback error:', tokenErr);
        }
      }

      console.log('🎁 All available discounts:', allAvailableDiscounts.map(d => `${d.code} (${d.discount_value || d.value}% off, ${d.discount_scope || d.scope}, tokenGated: ${d.isTokenGated || false}, priority: ${d.priority_level || 0})`));
      
      if (allAvailableDiscounts.length === 0) {
        console.log('❌ No discounts available for current cart');
        return null;
      }
      
      // Find the best discount - HIGHEST VALUE WINS FIRST
      const bestDiscount = allAvailableDiscounts.reduce((best, current) => {
        // Normalize property names
        const currentValue = current.discount_value || current.value;
        const bestValue = best.discount_value || best.value;
        const currentScope = current.discount_scope || current.scope;
        const bestScope = best.discount_scope || best.scope;
        const currentPriority = current.priority_level || 0;
        const bestPriority = best.priority_level || 0;
        
        console.log(`🔍 Comparing discounts: ${current.code} (${currentValue}%, ${currentScope}, tokenGated: ${current.isTokenGated || false}, priority: ${currentPriority}) vs ${best.code} (${bestValue}%, ${bestScope}, tokenGated: ${best.isTokenGated || false}, priority: ${bestPriority})`);
        
        // 1. HIGHEST VALUE WINS - Users should always get the best discount
        if (currentValue > bestValue) {
          console.log(`✅ ${current.code} wins - higher discount value (${currentValue}% > ${bestValue}%)`);
          return current;
        }
        if (currentValue < bestValue) {
          console.log(`✅ ${best.code} wins - higher discount value (${bestValue}% > ${currentValue}%)`);
          return best;
        }
        
        // 2. Same value: Token-gated beats regular (they verified their holding)
        if (current.isTokenGated && !best.isTokenGated) {
          console.log(`✅ ${current.code} wins - token-gated beats non-token-gated`);
          return current;
        }
        if (!current.isTokenGated && best.isTokenGated) {
          console.log(`✅ ${best.code} wins - token-gated beats non-token-gated`);
          return best;
        }
        
        // 3. Same value and gating: Product-specific beats site-wide (more targeted)
        if (currentScope === 'product' && bestScope === 'site_wide') {
          console.log(`✅ ${current.code} wins - product-specific beats site-wide (same value)`);
          return current;
        }
        if (currentScope === 'site_wide' && bestScope === 'product') {
          console.log(`✅ ${best.code} wins - product-specific beats site-wide (same value)`);
          return best;
        }
        
        // 4. Tiebreaker: Priority level
        if (currentPriority > bestPriority) {
          console.log(`✅ ${current.code} wins - higher priority_level (${currentPriority} > ${bestPriority})`);
          return current;
        }
        
        console.log(`✅ ${best.code} wins - no change`);
        return best;
      });
      
      console.log('🏆 Best discount selected:', bestDiscount.code, `(${bestDiscount.discount_value || bestDiscount.value}% off, ${bestDiscount.discount_scope || bestDiscount.scope})`);
      
      // Format discount for cart context
      return formatDiscountForCart(bestDiscount, bestDiscount.sourceProduct);
      
    } catch (error) {
      console.error('❌ Error evaluating optimal discount:', error);
      return null;
    }
  }, [safeCart.items]); // Only re-create if cart items change

  // MEMOIZED context value to prevent infinite re-renders in consuming components
  const contextValue = useMemo(() => ({
    cart: safeCart,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    updateNotes,
    updateShipping,
    updateCheckout,
    updateSelectedShipping,
    clearCheckout,
    applyDiscount,
    removeDiscount,
    cartSubtotal,
    cartTotal,
    itemCount,
    isInCart,
    getItemQuantity,
    evaluateOptimalDiscount,
    isEvaluatingDiscount,
    customSupabaseIds,
  }), [
    safeCart,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    updateNotes,
    updateShipping,
    updateCheckout,
    updateSelectedShipping,
    clearCheckout,
    applyDiscount,
    removeDiscount,
    cartSubtotal,
    cartTotal,
    itemCount,
    isInCart,
    getItemQuantity,
    evaluateOptimalDiscount,
    isEvaluatingDiscount,
    customSupabaseIds,
  ]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

// Custom hook to use cart context
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

// Export cart actions for external use if needed
export { CART_ACTIONS }; 