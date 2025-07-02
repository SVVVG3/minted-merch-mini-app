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
            image: variant?.image || product.images?.edges?.[0]?.node || null
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

  // Helper function to re-evaluate discounts when cart changes
  const reEvaluateDiscounts = async () => {
    try {
      // Get user FID from session storage
      const userDiscountContext = sessionStorage.getItem('userDiscountContext');
      if (!userDiscountContext) return;
      
      const { fid, hasNotifications } = JSON.parse(userDiscountContext);
      if (!fid || !hasNotifications) return;
      
      // Get all unique Supabase product IDs from cart items
      const productIds = [];
      cart.items.forEach(item => {
        if (item.product.supabaseId && !productIds.includes(item.product.supabaseId)) {
          productIds.push(item.product.supabaseId);
        }
      });
      
      console.log('🔄 Re-evaluating discounts for cart items:', productIds);
      
      if (productIds.length === 0) {
        // No Supabase IDs available, check site-wide only
        const bestDiscount = await getBestAvailableDiscount(fid, 'site_wide');
        if (bestDiscount.success && bestDiscount.discountCode) {
          updateCartDiscount(bestDiscount.discountCode, 'site_wide');
        }
        return;
      }
      
      // Check for product-specific discounts first
      const productSpecificDiscount = await getBestAvailableDiscount(fid, 'product', productIds);
      
      if (productSpecificDiscount.success && productSpecificDiscount.discountCode) {
        console.log('🎯 Found better product-specific discount:', productSpecificDiscount.discountCode.code);
        updateCartDiscount(productSpecificDiscount.discountCode, 'product');
        return;
      }
      
      // Fall back to site-wide discounts
      const siteWideDiscount = await getBestAvailableDiscount(fid, 'site_wide');
      if (siteWideDiscount.success && siteWideDiscount.discountCode) {
        console.log('🌐 Using site-wide discount:', siteWideDiscount.discountCode.code);
        updateCartDiscount(siteWideDiscount.discountCode, 'site_wide');
      }
      
    } catch (error) {
      console.error('❌ Error re-evaluating discounts:', error);
    }
  };
  
  // Helper function to update cart discount and session storage
  const updateCartDiscount = (discountCode, scope) => {
    const currentDiscount = cart.appliedDiscount;
    
    // Check if this is actually a better discount
    if (currentDiscount) {
      const currentValue = parseFloat(currentDiscount.discountValue || 0);
      const newValue = parseFloat(discountCode.discount_value || 0);
      
      // Only update if new discount is significantly better
      if (newValue <= currentValue) {
        console.log('💡 Current discount is still better, keeping it');
        return;
      }
    }
    
    const newDiscountData = {
      code: discountCode.code,
      source: scope === 'product' ? 'cart_product_specific' : 'cart_site_wide',
      displayText: `${discountCode.discount_value}% off`,
      discountType: discountCode.discount_type,
      discountValue: discountCode.discount_value,
      timestamp: new Date().toISOString(),
      autoApplied: true
    };
    
    // Update session storage
    sessionStorage.setItem('activeDiscountCode', JSON.stringify(newDiscountData));
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('sessionStorageUpdate'));
    
    console.log('✅ Updated cart discount:', discountCode.code);
  };

  // Cart actions
  const addItem = (product, variant, quantity = 1) => {
    dispatch({
      type: CART_ACTIONS.ADD_ITEM,
      payload: { product, variant, quantity }
    });
    
    // Re-evaluate discounts after adding item
    setTimeout(() => reEvaluateDiscounts(), 100); // Small delay to ensure cart state is updated
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
  };

  const removeDiscount = () => {
    dispatch({ type: CART_ACTIONS.REMOVE_DISCOUNT });
  };

  // Cart calculations
  const cartSubtotal = cart.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  const cartTotal = (() => {
    if (cart.appliedDiscount && cart.appliedDiscount.discountAmount) {
      return Math.max(0, cartSubtotal - cart.appliedDiscount.discountAmount);
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