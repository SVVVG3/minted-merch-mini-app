'use client';

import Link from 'next/link';
import { useCart } from '@/lib/CartContext';

export function ProductCard({ product }) {
  const { addItem, isInCart } = useCart();
  const price = product.priceRange?.minVariantPrice?.amount || '0';
  const imageUrl = product.images?.edges?.[0]?.node?.url || '/placeholder.jpg';
  const imageAlt = product.images?.edges?.[0]?.node?.altText || product.title;
  
  // Get the first available variant (default variant)
  const defaultVariant = product.variants?.edges?.[0]?.node;
  const isItemInCart = isInCart(product.id, defaultVariant?.id);

  const handleAddToCart = (e) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Stop event bubbling
    
    if (defaultVariant && defaultVariant.availableForSale) {
      addItem(product, defaultVariant, 1);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Product Image and Link */}
      <Link href={`/product/${product.handle}`} className="block">
        <div className="aspect-square relative">
          <img
            src={imageUrl}
            alt={imageAlt}
            className="w-full h-full object-cover"
          />
        </div>
      </Link>
      
      {/* Product Info */}
      <div className="p-3">
        <Link href={`/product/${product.handle}`} className="block">
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-blue-600 transition-colors">
            {product.title}
          </h3>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            ${parseFloat(price).toFixed(2)}
          </p>
        </Link>
        
        {/* Add to Cart Button */}
        <div className="mt-2">
          {defaultVariant && defaultVariant.availableForSale ? (
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