'use client';

import { useState, useEffect } from 'react';
import { ProductDetail } from '@/components/ProductDetail';
import { CheckoutFlow } from '@/components/CheckoutFlow';
import { ErrorMessage } from '@/components/ErrorMessage';

export function ProductPageClient({ handle }) {
  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkoutData, setCheckoutData] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [handle]);

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/shopify/products?handle=${handle}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error('Failed to load product');
      }
      
      setProduct(data);
      
      if (data.variants?.edges?.length > 0) {
        setSelectedVariant(data.variants.edges[0].node);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setError('Failed to load product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = () => {
    if (!selectedVariant) return;
    
    setCheckoutData({
      product: product,
      variant: selectedVariant,
      quantity: 1
    });
    setShowCheckout(true);
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

  if (showCheckout) {
    return (
      <CheckoutFlow 
        checkoutData={checkoutData} 
        onBack={() => setShowCheckout(false)}
      />
    );
  }

  return (
    <ProductDetail
      product={product}
      handle={handle}
      selectedVariant={selectedVariant}
      onVariantChange={setSelectedVariant}
      onBuyNow={handleBuyNow}
    />
  );
} 