'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { getBestAvailableDiscount } from './discounts';

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
      const { product, variant, quantity = 1 } = action.payload;
      
      // Create unique item key based on product ID and variant ID
      const itemKey = `${product.id}-${variant?.id || 'default'}`;
      
      // Check if item already exists in cart
      const existingItemIndex = state.items.findIndex(item => item.key === itemKey);
      
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
          price: parseFloat(variant?.price?.amount || product.priceRange?.minVariantPrice?.amount || '0')
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

  // Simplified cart logic - discounts are now pre-calculated by enhanced API
  // No more complex re-evaluation needed!

  // Cart actions
  const addItem = (product, variant, quantity = 1) => {
    dispatch({
      type: CART_ACTIONS.ADD_ITEM,
      payload: { product, variant, quantity }
    });
    
    console.log('✅ Added item to cart:', product.title);
    // No re-evaluation needed - discounts are pre-calculated by enhanced API
  };

  const removeItem = (itemKey) => {
    dispatch({
      type: CART_ACTIONS.REMOVE_ITEM,
      payload: { itemKey }
    });
  };

  const updateQuantity = (itemKey, quantity) => {
    dispatch({
      type: CART_ACTIONS.UPDATE_QUANTITY,
      payload: { itemKey, quantity }
    });
  };

  const clearCart = () => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART });
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

  // Cart calculations
  const cartSubtotal = cart.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Helper function to calculate product-aware discount amount
  const calculateProductAwareDiscount = () => {
    if (!cart.appliedDiscount) return 0;
    
    const { code, discountType, discountValue, discountAmount, source } = cart.appliedDiscount;
    
    // FIRST: If we have a pre-calculated discountAmount from the API, use it
    // BUT only for cart-wide discounts, not product-specific ones
    // For product-specific discounts, we need to calculate based on qualifying products only
    if (discountAmount && typeof discountAmount === 'number' && discountAmount > 0) {
      // Check if this is a product-specific or token-gated discount that needs product-aware calculation
      const isProductSpecific = source === 'product_specific_api' || source === 'token_gated';
      
      if (!isProductSpecific) {
        console.log(`💰 Using pre-calculated discount amount from API (cart-wide): $${discountAmount.toFixed(2)}`);
        return discountAmount;
      } else {
        console.log(`🎯 Product-specific discount detected - using product-aware calculation instead of pre-calculated amount`);
      }
    }
    
    // Check if this is a product-specific discount from session storage
    try {
      const activeDiscountData = sessionStorage.getItem('activeDiscountCode');
      if (activeDiscountData) {
        const activeDiscount = JSON.parse(activeDiscountData);
        
        // For product-specific discounts AND token-gated discounts, only apply to qualifying products
        if ((activeDiscount.source === 'product_specific_api' || activeDiscount.source === 'token_gated') && activeDiscount.code === code) {
          console.log(`🎯 Processing ${activeDiscount.source === 'token_gated' ? 'token-gated' : 'product-specific'} discount: ${code}`);
          
          // Get the target products from the active discount data
          const targetProducts = activeDiscount.target_products || [];
          console.log(`🎯 Target products for ${code}:`, targetProducts);
          
          let qualifyingSubtotal = 0;
          let discountAppliedCount = 0;
          
          // For 100% discounts, limit to 1 item per discount to prevent abuse
          const isFullDiscount = discountValue >= 100;
          const maxDiscountableItems = isFullDiscount ? 1 : 999; // No limit for partial discounts
          
          cart.items.forEach(item => {
            const productHandle = item.product?.handle;
            const productTitle = item.product?.title || item.title;
            
            console.log(`🔍 Checking item: ${productTitle} (handle: ${productHandle})`);
            
            // Check if this product qualifies for the discount
            let qualifies = false;
            
            if (targetProducts.length > 0) {
              // Check against target_products array (handles or IDs)
              qualifies = targetProducts.some(target => {
                // Check handle match
                if (productHandle && productHandle === target) return true;
                // Check title match (partial)
                if (productTitle && productTitle.toLowerCase().includes(target.toLowerCase())) return true;
                // Check exact title match
                if (productTitle && productTitle === target) return true;
                return false;
              });
            } else {
              // Fallback: check specific discount codes
              if (code === 'SNAPSHOT-TINY-HYPER-FREE') {
                qualifies = productHandle === 'tiny-hyper-tee' || productTitle?.includes('Tiny Hyper Tee');
              } else if (code === 'DICKBUTT-FREE') {
                qualifies = productHandle === 'dickbutt-cap' || productTitle?.includes('Dickbutt Cap');
              } else if (code === 'DICKBUTT20') {
                // NFT token-gated discount for CryptaDickButtz products
                qualifies = productHandle === 'cryptoadickbuttz-og-tee' || productTitle?.includes('CryptaDickButtz');
              } else if (code.includes('BANKR')) {
                qualifies = productHandle === 'bankr-cap' || productHandle === 'bankr-hoodie' || 
                           productTitle?.includes('Bankr');
              }
            }
            
            if (qualifies) {
              // Only apply discount if we haven't reached the limit
              if (discountAppliedCount < maxDiscountableItems) {
                const remainingDiscountableItems = maxDiscountableItems - discountAppliedCount;
                const discountableQuantity = Math.min(remainingDiscountableItems, item.quantity);
                const discountableAmount = item.price * discountableQuantity;
                
                qualifyingSubtotal += discountableAmount;
                discountAppliedCount += discountableQuantity;
                
                console.log(`✅ Product qualifies: ${productTitle} (${discountableQuantity} of ${item.quantity} items = $${discountableAmount.toFixed(2)}) [Total discounted: ${discountAppliedCount}]`);
              } else {
                console.log(`⏭️ Product qualifies but discount limit reached: ${productTitle} (0 of ${item.quantity} items discounted)`);
              }
            } else {
              console.log(`❌ Product does NOT qualify: ${productTitle}`);
            }
          });
          
          console.log(`💰 Qualifying subtotal for ${code}: $${qualifyingSubtotal.toFixed(2)} (vs cart total: $${cartSubtotal.toFixed(2)})`);
          
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
    
    // Fallback for site-wide discounts or when product-specific logic fails
    console.log(`🌐 Applying site-wide discount calculation for ${code}`);
    if (discountType === 'percentage') {
      return (cartSubtotal * discountValue) / 100;
    } else if (discountType === 'fixed') {
      return Math.min(discountValue, cartSubtotal);
    }
    
    return cart.appliedDiscount.discountAmount || 0;
  };

  const cartTotal = (() => {
    if (cart.appliedDiscount) {
      const productAwareDiscountAmount = calculateProductAwareDiscount();
      return Math.max(0, cartSubtotal - productAwareDiscountAmount);
    }
    return cartSubtotal;
  })();

  const itemCount = cart.items.reduce((count, item) => {
    return count + item.quantity;
  }, 0);

  // Helper function to check if a specific variant is in cart
  const isInCart = (productId, variantId = null) => {
    const itemKey = `${productId}-${variantId || 'default'}`;
    return cart.items.some(item => item.key === itemKey);
  };

  // Helper function to get quantity of specific item in cart
  const getItemQuantity = (productId, variantId = null) => {
    const itemKey = `${productId}-${variantId || 'default'}`;
    const item = cart.items.find(item => item.key === itemKey);
    return item ? item.quantity : 0;
  };

  const contextValue = {
    cart,
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
    getItemQuantity
  };

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