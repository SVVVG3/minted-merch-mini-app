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

  // Fetch product immediately on mount (without discounts)
  useEffect(() => {
    fetchProductBasic();
  }, []);

  // Check for discounts when Farcaster context is ready
  useEffect(() => {
    if (isReady && product) {
      console.log('🔄 Farcaster context ready, checking for discounts...');
      checkForDiscounts();
    }
  }, [isReady, product]);

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