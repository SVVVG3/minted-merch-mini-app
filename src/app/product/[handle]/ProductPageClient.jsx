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
  
  const { user: farcasterUser, isInFarcaster, isReady } = useFarcaster();


  // Removed initial fetch - we wait for user context to load discounts properly

  // Fetch product with discount data when user context is ready
  useEffect(() => {
    if (isReady) { // Wait for Farcaster context to be fully loaded/checked
      console.log('🔄 Farcaster context ready, fetching product with discount data...');
      fetchProduct();
    }
  }, [isReady]);

  const fetchProduct = async () => {
    try {
      // Debug: Log the Farcaster user context
      console.log('🔍 Farcaster user context:', farcasterUser);
      console.log('🔍 User FID available:', farcasterUser?.fid);
      
      // Build API URL - include FID if user is available for discount checking
      const apiUrl = `/api/shopify/products?handle=${handle}${farcasterUser?.fid ? `&fid=${farcasterUser.fid}` : ''}`;
      
      console.log(`🛍️ Fetching product with discounts: ${handle}${farcasterUser?.fid ? ` (FID: ${farcasterUser.fid})` : ''}`);
      console.log('🔍 API URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      const productData = await response.json();
      
      if (!response.ok) {
        throw new Error(productData.error || 'Failed to load product');
      }
      
      console.log('🎁 Product loaded:', productData.title);
      console.log('- Shopify ID:', productData.id);
      console.log('- Supabase ID:', productData.supabaseId);
      console.log('🔍 Available discounts data:', productData.availableDiscounts);
      
      // Check if discounts were found
      if (productData.availableDiscounts?.best) {
        const bestDiscount = productData.availableDiscounts.best;
        console.log(`🎯 Best discount found: ${bestDiscount.code} (${bestDiscount.displayText}, scope: ${bestDiscount.scope})`);
        
        // Set product discount for display
        setProductDiscount({
          code: bestDiscount.code,
          displayText: bestDiscount.displayText,
          description: bestDiscount.description,
          scope: bestDiscount.scope,
          gating_type: bestDiscount.gating_type,
          isTokenGated: bestDiscount.isTokenGated,
          discountType: bestDiscount.type,
          discountValue: bestDiscount.value,
          source: bestDiscount.scope === 'product' ? 'product_specific_api' : 'site_wide_api'
        });
        
        // Update session storage with the best discount for cart usage
        sessionStorage.setItem('activeDiscountCode', JSON.stringify({
          code: bestDiscount.code,
          source: bestDiscount.scope === 'product' ? 'product_specific_api' : 'site_wide_api',
          displayText: bestDiscount.displayText,
          discountType: bestDiscount.type,
          discountValue: bestDiscount.value,
          timestamp: new Date().toISOString(),
          isTokenGated: bestDiscount.isTokenGated,
          gatingType: bestDiscount.gating_type,
          description: bestDiscount.description
        }));
        
      } else if (farcasterUser?.fid) {
        console.log('❌ No discounts found for this product/user combination');
      }
      
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

  // No longer needed - discount checking is now handled by the enhanced API



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