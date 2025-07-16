'use client';

import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
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
  const [isEvaluatingDiscount, setIsEvaluatingDiscount] = useState(false);

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

  // TEMPORARILY DISABLED - AUTO-EVALUATE DISCOUNT (CAUSING CRASHES)
  // TODO: Re-enable after fixing the undefined length access bug
  // Auto-evaluation logic has been completely removed to prevent cart crashes
  // Users can still manually enter discount codes in the cart
  // CACHE REFRESH: 2024-01-02 - Force fresh deployment to clear cached JavaScript

  // Helper function to get user FID (you might need to adjust this based on your auth system)
  const getUserFid = () => {
    try {
      // Method 1: Check if we have user FID in sessionStorage from the Farcaster hook
      const userContextData = sessionStorage.getItem('userDiscountContext');
      if (userContextData) {
        const userData = JSON.parse(userContextData);
        return userData.fid;
      }
      
      // Method 2: Check for FID in active discount data
      const activeDiscountData = sessionStorage.getItem('activeDiscountCode');
      if (activeDiscountData) {
        const discountData = JSON.parse(activeDiscountData);
        if (discountData.fid) return discountData.fid;
      }
      
      // Method 3: Access Farcaster context directly from window
      if (typeof window !== 'undefined' && window.farcaster) {
        const fid = window.farcaster.user?.fid;
        if (fid && typeof fid === 'number') return fid;
      }
      
      // Method 4: Check for FID in localStorage (fallback)
      const storedFid = localStorage.getItem('farcaster_fid');
      if (storedFid) {
        const fid = parseInt(storedFid);
        if (!isNaN(fid)) return fid;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user FID:', error);
      return null;
    }
  };

  // Simplified cart logic - discounts are now pre-calculated by enhanced API
  // No more complex re-evaluation needed!

  // Cart actions
  const addItem = (product, variant, quantity = 1) => {
    dispatch({
      type: CART_ACTIONS.ADD_ITEM,
      payload: { product, variant, quantity }
    });
    
    console.log('✅ Added item to cart:', product.title);
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
  const safeCart = {
    ...cart,
    items: Array.isArray(cart.items) ? cart.items : []
  };

  // Cart calculations using safeCart
  const cartSubtotal = safeCart.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Helper function to calculate product-aware discount amount
  const calculateProductAwareDiscount = () => {
    if (!safeCart.appliedDiscount) return 0;
    
    const { code, discountType, discountValue, source } = safeCart.appliedDiscount;
    
    // Check if this is a product-specific discount using proper database fields
    const isProductSpecific = safeCart.appliedDiscount.discount_scope === 'product' || 
                              (safeCart.appliedDiscount.target_products && 
                               Array.isArray(safeCart.appliedDiscount.target_products) && 
                               safeCart.appliedDiscount.target_products.length > 0);
    
    if (isProductSpecific) {
      // Apply discount only to qualifying products
      const targetProducts = Array.isArray(safeCart.appliedDiscount.target_products) ? 
                             safeCart.appliedDiscount.target_products : [];
      
      let qualifyingSubtotal = 0;
      
      safeCart.items.forEach(item => {
        const productHandle = item.product?.handle;
        const productTitle = item.product?.title;
        
        // Check if this item qualifies for the discount
        const qualifies = targetProducts.some(target => {
          // Handle different target formats
          if (typeof target === 'string') {
            return target === productHandle || target === productTitle;
          } else if (typeof target === 'object' && target.handle) {
            return target.handle === productHandle;
          }
          return false;
        });
        
        if (qualifies) {
          qualifyingSubtotal += (item.price * item.quantity);
        }
      });
      
      return qualifyingSubtotal * (discountValue / 100);
    } else {
      // Site-wide discount applies to entire cart
      return cartSubtotal * (discountValue / 100);
    }
  };

  const cartTotal = (() => {
    const discountAmount = calculateProductAwareDiscount();
    return Math.max(0, cartSubtotal - discountAmount);
  })();

  const itemCount = safeCart.items.reduce((count, item) => {
    return count + item.quantity;
  }, 0);

  // Helper function to check if a specific variant is in cart
  const isInCart = (productId, variantId = null) => {
    const itemKey = `${productId}-${variantId || 'default'}`;
    return (cart.items || []).some(item => item.key === itemKey);
  };

  // Helper function to get quantity of specific item in cart
  const getItemQuantity = (productId, variantId = null) => {
    const itemKey = `${productId}-${variantId || 'default'}`;
    const item = (cart.items || []).find(item => item.key === itemKey);
    return item ? item.quantity : 0;
  };

  // DISABLED: New function to evaluate and select the optimal discount for current cart
  const evaluateOptimalDiscount = async (userFid) => {
    // Completely disabled to prevent cart crashes
    console.log('🚫 Auto-evaluation is disabled to prevent cart crashes');
    return null;
  };

  const contextValue = {
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
    evaluateOptimalDiscount
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