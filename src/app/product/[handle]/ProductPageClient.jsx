'use client';

import { useState, useEffect } from 'react';
import { ProductDetail } from '@/components/ProductDetail';
import { CheckoutFlow } from '@/components/CheckoutFlow';
import { ErrorMessage } from '@/components/ErrorMessage';
import { useFarcaster } from '@/lib/useFarcaster';

export function ProductPageClient({ handle }) {
  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [productDiscount, setProductDiscount] = useState(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  
  const { 
    user: farcasterUser, 
    isInFarcaster, 
    isReady,
    context,
    getFid,
    getUsername,
    getDisplayName,
    getPfpUrl,
    getSessionToken
  } = useFarcaster();

  // Fetch product immediately on mount (without discounts)
  useEffect(() => {
    fetchProductBasic();
  }, []);

  // CRITICAL FIX: Register user profile when Farcaster context is ready (like HomePage.jsx does)
  // Works for both mini-app users AND AuthKit users
  useEffect(() => {
    // Wait for auth to be ready
    if (!isReady) return;
    
    // Get FID from either mini-app or AuthKit
    const userFid = farcasterUser?.fid || getFid();
    if (!userFid) return;

    // Prevent multiple registrations
    const hasRegistered = sessionStorage.getItem(`user_registered_${userFid}`);
    if (hasRegistered) {
      console.log('User already registered in this session, loading discounts only');
      checkForDiscounts();
      return;
    }

    const registerUserProfile = async () => {
      try {
        console.log(`=== REGISTERING USER PROFILE (Product Page) - FID: ${userFid}, isInFarcaster: ${isInFarcaster}, isAuthKit: ${farcasterUser?.isAuthKit} ===`);
        console.log('User FID:', userFid);
        console.log('User Data:', {
          fid: userFid,
          username: getUsername(),
          displayName: getDisplayName(),
          pfpUrl: getPfpUrl()
        });
        
        // Prepare user data for registration
        const userData = {
          username: getUsername() || `user_${userFid}`,
          displayName: getDisplayName() || null,
          bio: null, // Bio not available in simplified version
          pfpUrl: getPfpUrl() || null
        };

        console.log('Registering user profile with data:', userData);
        
        // 🔒 SECURITY: Get session token for authentication
        const sessionToken = getSessionToken();
        
        if (!sessionToken) {
          console.warn('⚠️ No session token available - skipping registration (will retry on next page load)');
          return;
        }
        
        // Register user profile
        const response = await fetch('/api/register-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({ 
            fid: userFid,
            username: userData.username,
            displayName: userData.displayName,
            bio: userData.bio,
            pfpUrl: userData.pfpUrl
          }),
        });
        
        const result = await response.json();
        console.log('User profile registration result:', result);
        
        if (result.success) {
          console.log('✅ User profile successfully registered from product page!');
          
          // Mark as registered to prevent multiple calls
          sessionStorage.setItem(`user_registered_${userFid}`, 'true');
          
          // After successful registration, check for discounts
          checkForDiscounts();
        } else {
          console.error('❌ User profile registration failed:', result.error);
          // Still try to check for discounts even if registration failed
          checkForDiscounts();
        }
        
      } catch (error) {
        console.error('Error registering user profile:', error);
        // Still try to check for discounts even if registration failed
        checkForDiscounts();
      }
    };

    // Small delay to ensure Farcaster context is fully loaded
    const timer = setTimeout(registerUserProfile, 1000);
    return () => clearTimeout(timer);
  }, [isInFarcaster, isReady]);

  // Check for discounts when Farcaster context is ready AND product is loaded
  useEffect(() => {
    if (isReady && product && farcasterUser?.fid) {
      console.log('🔄 Farcaster context ready, checking for discounts...');
      checkForDiscounts();
    }
  }, [isReady, product, farcasterUser?.fid]);

  const fetchProductBasic = async () => {
    try {
      console.log(`🛍️ Fetching basic product data: ${handle}`);
      
      // Fetch product without FID (no discount checking)
      const response = await fetch(`/api/shopify/products?handle=${handle}`);
      const productData = await response.json();
      
      if (!response.ok) {
        throw new Error(productData.error || 'Failed to load product');
      }
      
      console.log('🎁 Basic product loaded:', productData.title);
      setProduct(productData);
      
      if (productData.variants?.edges?.length > 0) {
        setSelectedVariant(productData.variants.edges[0].node);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setError('Failed to load product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkForDiscounts = async () => {
    if (!farcasterUser?.fid || !product?.supabaseId) {
      console.log('❌ Cannot check discounts: missing FID or Supabase product ID');
      return;
    }

    // Check if this is a gift card product - if so, don't show discounts
    const isGiftCard = product.title?.toLowerCase().includes('gift card') || 
                      product.handle?.includes('gift-card') ||
                      product.title?.toLowerCase().includes('gift') ||
                      product.handle?.includes('gift');
    
    if (isGiftCard) {
      console.log('🚫 Product is a gift card - skipping discount check');
      setDiscountLoading(false);
      return;
    }

    try {
      setDiscountLoading(true);
      console.log(`🎁 Checking discounts for product: ${product.title} (FID: ${farcasterUser.fid})`);
      
      // Fetch product again with FID for discount checking
      const response = await fetch(`/api/shopify/products?handle=${handle}&fid=${farcasterUser.fid}`);
      const productWithDiscounts = await response.json();
      
      if (response.ok && productWithDiscounts.availableDiscounts?.best) {
        const bestDiscount = productWithDiscounts.availableDiscounts.best;
        console.log(`🎯 Best discount found: ${bestDiscount.code} (${bestDiscount.displayText})`);
        
        // Set product discount for display
        setProductDiscount({
          code: bestDiscount.code,
          displayText: bestDiscount.displayText,
          description: bestDiscount.description,
          discount_description: bestDiscount.discount_description,
          scope: bestDiscount.discount_scope || bestDiscount.scope,
          gating_type: bestDiscount.gating_type,
          isTokenGated: bestDiscount.isTokenGated,
          discountType: bestDiscount.discount_type || bestDiscount.type,
          discountValue: bestDiscount.discount_value || bestDiscount.value,
          source: (bestDiscount.discount_scope || bestDiscount.scope) === 'product' ? 'product_specific_api' : 'site_wide_api'
        });
        
        // Update session storage with the best discount for cart usage
        sessionStorage.setItem('activeDiscountCode', JSON.stringify({
          code: bestDiscount.code,
          source: (bestDiscount.discount_scope || bestDiscount.scope) === 'product' ? 'product_specific_api' : 'site_wide_api',
          displayText: bestDiscount.displayText,
          discountType: bestDiscount.discount_type || bestDiscount.type,
          discountValue: bestDiscount.discount_value || bestDiscount.value,
          timestamp: new Date().toISOString(),
          isTokenGated: bestDiscount.isTokenGated,
          gatingType: bestDiscount.gating_type,
          description: bestDiscount.description,
          discount_description: bestDiscount.discount_description
        }));
      } else {
        console.log('❌ No discounts found for this product/user combination');
      }
    } catch (error) {
      console.error('Error checking discounts:', error);
    } finally {
      setDiscountLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <ErrorMessage message={error} type="error" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Product not found</p>
      </div>
    );
  }

  return (
    <ProductDetail
      product={product}
      handle={handle}
      selectedVariant={selectedVariant}
      onVariantChange={setSelectedVariant}
      productDiscount={productDiscount}
      discountLoading={discountLoading}
    />
  );
} 