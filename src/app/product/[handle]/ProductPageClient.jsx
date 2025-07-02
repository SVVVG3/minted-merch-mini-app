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
  
  const { farcasterUser, isInFarcaster } = useFarcaster();


  useEffect(() => {
    fetchProduct();
  }, [handle]);

  // Check for product-specific discounts when product loads and user is authenticated
  useEffect(() => {
    if (product && farcasterUser?.fid && isInFarcaster) {
      checkProductSpecificDiscounts();
    }
  }, [product, farcasterUser]);

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

  const checkProductSpecificDiscounts = async () => {
    if (!product || !farcasterUser?.fid) return;
    
    setDiscountLoading(true);
    console.log(`🎁 Checking product-specific discounts for ${product.title} (ID: ${product.id})`);
    
    try {
      // Get current active discount from session storage
      const currentDiscountData = sessionStorage.getItem('activeDiscountCode');
      const currentDiscount = currentDiscountData ? JSON.parse(currentDiscountData) : null;
      
      console.log('Current active discount:', currentDiscount);
      
      // 1. Check for token-gated discounts specific to this product
      const walletResponse = await fetch(`/api/user-wallet-data?fid=${farcasterUser.fid}`);
      const walletData = await walletResponse.json();
      
      if (walletData.success) {
        const userWalletAddresses = walletData.walletData?.all_wallet_addresses || [];
        console.log('User wallet addresses:', userWalletAddresses);
        
        if (userWalletAddresses.length > 0) {
          // Check for token-gated discounts for this specific product
          const tokenGatedResponse = await fetch('/api/check-token-gated-eligibility', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fid: farcasterUser.fid,
              walletAddresses: userWalletAddresses,
              scope: 'product',
              productIds: [product.id]
            })
          });
          
          const tokenGatedData = await tokenGatedResponse.json();
          console.log('Token-gated eligibility result:', tokenGatedData);
          
          if (tokenGatedData.success && tokenGatedData.eligibleDiscounts?.length > 0) {
            const bestTokenGatedDiscount = tokenGatedData.eligibleDiscounts[0];
            console.log('🎫 Found token-gated discount for product:', bestTokenGatedDiscount.code);
            
            // Compare with current discount
            if (isDiscountBetter(bestTokenGatedDiscount, currentDiscount)) {
              const newDiscountData = {
                code: bestTokenGatedDiscount.code,
                source: 'token_gated_product',
                gating_type: bestTokenGatedDiscount.gating_type,
                product_specific: true,
                product_id: product.id,
                product_title: product.title,
                displayText: formatDiscountText(bestTokenGatedDiscount),
                discountType: bestTokenGatedDiscount.discount_type,
                discountValue: bestTokenGatedDiscount.discount_value,
                description: bestTokenGatedDiscount.discount_description,
                timestamp: new Date().toISOString()
              };
              
              // Update session storage with better discount
              sessionStorage.setItem('activeDiscountCode', JSON.stringify(newDiscountData));
              setProductDiscount(newDiscountData);
              
              console.log('✅ Updated to better token-gated discount:', bestTokenGatedDiscount.code);
              return;
            }
          }
        }
      }
      
      // 2. Check for database discounts specific to this product
      const databaseResponse = await fetch(`/api/user-discounts?fid=${farcasterUser.fid}&mode=best&scope=product&productIds=${JSON.stringify([product.id])}`);
      const databaseData = await databaseResponse.json();
      
      if (databaseData.success && databaseData.discountCode) {
        console.log('🗃️ Found database discount for product:', databaseData.discountCode.code);
        
        // Compare with current discount
        if (isDiscountBetter(databaseData.discountCode, currentDiscount)) {
          const newDiscountData = {
            code: databaseData.discountCode.code,
            source: 'database_product',
            product_specific: true,
            product_id: product.id,
            product_title: product.title,
            displayText: databaseData.discountCode.displayText || formatDiscountText(databaseData.discountCode),
            discountType: databaseData.discountCode.discount_type,
            discountValue: databaseData.discountCode.discount_value,
            timestamp: new Date().toISOString()
          };
          
          // Update session storage with better discount
          sessionStorage.setItem('activeDiscountCode', JSON.stringify(newDiscountData));
          setProductDiscount(newDiscountData);
          
          console.log('✅ Updated to better database discount:', databaseData.discountCode.code);
          return;
        }
      }
      
      // 3. If no better product-specific discount found, show current discount info
      if (currentDiscount) {
        setProductDiscount({
          ...currentDiscount,
          isCurrentBest: true
        });
        console.log('💡 Current discount is still the best:', currentDiscount.code);
      } else {
        console.log('❌ No discounts found for this product');
      }
      
    } catch (error) {
      console.error('❌ Error checking product-specific discounts:', error);
    } finally {
      setDiscountLoading(false);
    }
  };

  // Helper function to determine if a discount is better than the current one
  const isDiscountBetter = (newDiscount, currentDiscount) => {
    if (!currentDiscount) return true; // Any discount is better than none
    
    // Extract numeric values for comparison
    const newValue = parseFloat(newDiscount.discount_value || 0);
    const currentValue = parseFloat(currentDiscount.discountValue || 0);
    
    // For percentage discounts, higher percentage is better
    if (newDiscount.discount_type === 'percentage' && currentDiscount.discountType === 'percentage') {
      return newValue > currentValue;
    }
    
    // For fixed discounts, higher amount is better
    if (newDiscount.discount_type === 'fixed' && currentDiscount.discountType === 'fixed') {
      return newValue > currentValue;
    }
    
    // Mixed types: prefer percentage over fixed for simplicity (could be more sophisticated)
    if (newDiscount.discount_type === 'percentage' && currentDiscount.discountType === 'fixed') {
      return newValue >= 15; // Prefer percentage if it's 15% or higher
    }
    
    return false; // Default to keeping current discount
  };

  // Helper function to format discount display text
  const formatDiscountText = (discount) => {
    if (discount.discount_type === 'percentage') {
      return `${discount.discount_value}% off`;
    } else if (discount.discount_type === 'fixed') {
      return `$${discount.discount_value} off`;
    }
    return 'Discount available';
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