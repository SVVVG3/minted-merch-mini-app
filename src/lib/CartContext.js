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

  // New function to evaluate and select the optimal discount for current cart
  const evaluateOptimalDiscount = async (userFid) => {
    if (!userFid || cart.items.length === 0) return null;
    
    try {
      console.log('🎯 Evaluating optimal discount for cart:', cart.items.map(i => i.product?.handle));
      
      // Get all user's available discounts
      const userDiscountsResponse = await fetch(`/api/user-discounts?fid=${userFid}`);
      const userDiscountsData = await userDiscountsResponse.json();
      
      if (!userDiscountsData.success || !userDiscountsData.categorized?.usable) {
        console.log('❌ No usable discounts found for user');
        return null;
      }
      
      let eligibleDiscounts = userDiscountsData.categorized.usable;
      
      // Get user's wallet addresses for token-gated discounts
      const walletResponse = await fetch(`/api/user-wallet-data?fid=${userFid}`);
      const walletData = await walletResponse.json();
      const walletAddresses = walletData.success ? walletData.walletAddresses : [];
      
      // Check token-gated eligibility if user has wallets
      if (walletAddresses.length > 0) {
        const productIds = cart.items.map(item => parseInt(item.product?.id)).filter(Boolean);
        
        const tokenGatedResponse = await fetch('/api/check-token-gated-eligibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: userFid,
            walletAddresses: walletAddresses,
            scope: 'all',
            productIds: productIds
          })
        });
        
        const tokenGatedResult = await tokenGatedResponse.json();
        if (tokenGatedResult.success && tokenGatedResult.eligibleDiscounts) {
          // Add eligible token-gated discounts to the list
          eligibleDiscounts = [...eligibleDiscounts, ...tokenGatedResult.eligibleDiscounts];
        }
      }
      
      // Filter discounts that are relevant to current cart
      const cartRelevantDiscounts = eligibleDiscounts.filter(discount => {
        // Site-wide discounts always apply
        if (discount.discount_scope === 'site_wide' || !discount.target_products || discount.target_products.length === 0) {
          return true;
        }
        
        // Product-specific discounts - check if any cart items qualify
        if (discount.target_products && discount.target_products.length > 0) {
          const hasQualifyingProduct = cart.items.some(item => {
            const productHandle = item.product?.handle;
            const productTitle = item.product?.title;
            
            return discount.target_products.some(target => {
              if (productHandle && productHandle === target) return true;
              if (productTitle && productTitle.toLowerCase().includes(target.toLowerCase())) return true;
              return false;
            });
          });
          
          return hasQualifyingProduct;
        }
        
        return false;
      });
      
      if (cartRelevantDiscounts.length === 0) {
        console.log('❌ No discounts relevant to current cart contents');
        return null;
      }
      
      // Sort by priority_level (higher first), then by discount_value (higher first)
      const sortedDiscounts = cartRelevantDiscounts.sort((a, b) => {
        const priorityA = a.priority_level || 0;
        const priorityB = b.priority_level || 0;
        
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Higher priority first
        }
        
        // If same priority, prefer higher discount value
        return (b.discount_value || 0) - (a.discount_value || 0);
      });
      
      const bestDiscount = sortedDiscounts[0];
      console.log('🎯 Selected best discount:', bestDiscount.code, `(Priority: ${bestDiscount.priority_level}, Value: ${bestDiscount.discount_value}%)`);
      
      return bestDiscount;
      
    } catch (error) {
      console.error('❌ Error evaluating optimal discount:', error);
      return null;
    }
  };

  // Helper function to calculate product-aware discount amount
  const calculateProductAwareDiscount = () => {
    if (!cart.appliedDiscount) return 0;
    
    const { code, discountType, discountValue, source } = cart.appliedDiscount;
    
    // Check if this is a product-specific discount using proper database fields
    const isProductSpecific = cart.appliedDiscount.discount_scope === 'product' || 
                              (cart.appliedDiscount.target_products && cart.appliedDiscount.target_products.length > 0);
    
    if (isProductSpecific) {
      // Apply discount only to qualifying products
      const targetProducts = cart.appliedDiscount.target_products || [];
      let qualifyingSubtotal = 0;
      
      console.log(`🎯 Applying product-specific discount ${code} to qualifying products:`, targetProducts);
      
      cart.items.forEach(item => {
        const productHandle = item.product?.handle;
        const productTitle = item.product?.title;
        
        // Check if this product qualifies
        const qualifies = targetProducts.some(target => {
          if (productHandle && productHandle === target) return true;
          if (productTitle && productTitle.toLowerCase().includes(target.toLowerCase())) return true;
          return false;
        });
        
        if (qualifies) {
          qualifyingSubtotal += (item.price * item.quantity);
          console.log(`✅ ${productTitle}: $${(item.price * item.quantity).toFixed(2)}`);
        } else {
          console.log(`❌ ${productTitle}: Not qualifying`);
        }
      });
      
      console.log(`💰 Qualifying subtotal: $${qualifyingSubtotal.toFixed(2)}`);
      
      // Calculate discount on qualifying products only
      if (discountType === 'percentage') {
        return (qualifyingSubtotal * discountValue) / 100;
      } else if (discountType === 'fixed') {
        return Math.min(discountValue, qualifyingSubtotal);
      }
    } else {
      // Site-wide discount - apply to entire cart
      console.log(`🌐 Applying site-wide discount ${code} to entire cart: $${cartSubtotal.toFixed(2)}`);
      
      if (discountType === 'percentage') {
        return (cartSubtotal * discountValue) / 100;
      } else if (discountType === 'fixed') {
        return Math.min(discountValue, cartSubtotal);
      }
    }
    
    return 0;
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