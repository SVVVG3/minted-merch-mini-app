'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';

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
  UPDATE_SHIPPING: 'UPDATE_SHIPPING'
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
            image: product.images?.edges?.[0]?.node || null
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
        shipping: null
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
    
    case CART_ACTIONS.LOAD_CART: {
      return {
        ...state,
        items: action.payload.items || [],
        notes: action.payload.notes || '',
        shipping: action.payload.shipping || null
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
  shipping: null
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

  // Cart actions
  const addItem = (product, variant, quantity = 1) => {
    dispatch({
      type: CART_ACTIONS.ADD_ITEM,
      payload: { product, variant, quantity }
    });
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

  // Cart calculations
  const cartTotal = cart.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

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