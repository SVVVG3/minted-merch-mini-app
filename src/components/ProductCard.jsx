'use client';

import Link from 'next/link';
import { useCart } from '@/lib/CartContext';
import { sdk } from '@farcaster/miniapp-sdk';

export function ProductCard({ product }) {
  const { addItem, isInCart } = useCart();
  const price = product.priceRange?.minVariantPrice?.amount || '0';
  const imageUrl = product.images?.edges?.[0]?.node?.url || '/placeholder.jpg';
  const imageAlt = product.images?.edges?.[0]?.node?.altText || product.title;
  
  // Get all variants and check if product has multiple variants (sizes/options)
  const variants = product.variants?.edges || [];
  const defaultVariant = variants[0]?.node;
  const hasMultipleVariants = variants.length > 1;
  const isItemInCart = isInCart(product.id, defaultVariant?.id);

  const handleAddToCart = async (e) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Stop event bubbling
    
    if (defaultVariant && defaultVariant.availableForSale) {
      // Add haptic feedback for add to cart action
      try {
        const capabilities = await sdk.getCapabilities();
        if (capabilities.includes('haptics.impactOccurred')) {
          await sdk.haptics.impactOccurred('light');
        }
      } catch (error) {
        // Haptics not available, continue without feedback
        console.log('Haptics not available:', error);
      }
      
      addItem(product, defaultVariant, 1);
    }
  };

  const handleViewOptions = async () => {
    // Add haptic feedback for view options action
    try {
      const capabilities = await sdk.getCapabilities();
      if (capabilities.includes('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
      }
    } catch (error) {
      // Haptics not available, continue without feedback
      console.log('Haptics not available:', error);
    }
  };

  const handleProductNavigation = async () => {
    // Add haptic feedback for product navigation
    try {
      const capabilities = await sdk.getCapabilities();
      if (capabilities.includes('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
      }
    } catch (error) {
      // Haptics not available, continue without feedback
      console.log('Haptics not available:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
      {/* Product Image and Link */}
      <Link href={`/product/${product.handle}`} className="block" onClick={handleProductNavigation}>
        <div className="aspect-square relative">
          <img
            src={imageUrl}
            alt={imageAlt}
            className="w-full h-full object-cover"
          />
        </div>
      </Link>
      
      {/* Product Info - flex-grow pushes button to bottom */}
      <div className="p-3 flex flex-col flex-grow">
        <Link href={`/product/${product.handle}`} className="block flex-grow" onClick={handleProductNavigation}>
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-blue-600 transition-colors">
            {product.title}
          </h3>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            ${parseFloat(price).toFixed(2)}
          </p>
        </Link>
        
        {/* Add to Cart or Select Size Button - positioned at bottom */}
        <div className="mt-2">
          {defaultVariant && defaultVariant.availableForSale ? (
            hasMultipleVariants ? (
              <Link href={`/product/${product.handle}`} className="block" onClick={handleViewOptions}>
                <button className="w-full py-2 px-3 text-xs font-medium rounded-md bg-[#3eb489] text-white hover:bg-[#359970] transition-colors">
                  View Options
                </button>
              </Link>
            ) : (
              <button
                onClick={handleAddToCart}
                className={`w-full py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                  isItemInCart
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-[#3eb489] text-white hover:bg-[#359970]'
                }`}
              >
                {isItemInCart ? '✓ In Cart' : 'Add to Cart'}
              </button>
            )
          ) : (
            <button
              disabled
              className="w-full py-2 px-3 text-xs font-medium rounded-md bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              Out of Stock
            </button>
          )}
        </div>
      </div>
    </div>
  );
}