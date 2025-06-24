'use client';

import { useState } from 'react';
import Link from 'next/link';
import { VariantSelector } from './VariantSelector';
import { useCart } from '@/lib/CartContext';
import { Cart } from './Cart';

export function ProductDetail({ 
  product, 
  selectedVariant, 
  onVariantChange, 
  onBuyNow 
}) {
  const { addItem, isInCart, getItemQuantity, itemCount, cartTotal } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const mainImage = product.images?.edges?.[0]?.node;
  const price = selectedVariant?.price?.amount || product.priceRange?.minVariantPrice?.amount || '0';
  
  // Check if this specific variant is in cart
  const itemInCart = isInCart(product.id, selectedVariant?.id);
  const cartQuantity = getItemQuantity(product.id, selectedVariant?.id);

  const handleAddToCart = () => {
    if (selectedVariant && selectedVariant.availableForSale) {
      addItem(product, selectedVariant, 1);
    }
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="mr-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {product.title}
            </h1>
          </div>
          
          {/* Cart Button */}
          <button
            onClick={openCart}
            className="flex items-center space-x-2 bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-2 rounded-lg transition-colors"
            title="Open Cart"
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6M20 13v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6" />
              </svg>
              
              {/* Item Count Badge */}
              {itemCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {itemCount > 99 ? '99+' : itemCount}
                </div>
              )}
            </div>
            {itemCount > 0 && (
              <span className="text-sm font-medium">
                ${cartTotal.toFixed(2)}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="pb-32">
        {mainImage && (
          <div className="aspect-square bg-white">
            <img
              src={mainImage.url}
              alt={mainImage.altText || product.title}
              className="w-full h-full object-contain"
            />
          </div>
        )}

        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{product.title}</h2>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              ${parseFloat(price).toFixed(2)}
            </p>
            {itemInCart && (
              <p className="text-sm text-green-600 mt-1">
                {cartQuantity} in cart
              </p>
            )}
          </div>

          <VariantSelector
            variants={product.variants?.edges}
            selectedVariant={selectedVariant}
            onVariantChange={onVariantChange}
          />

          {product.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <p className="text-sm text-gray-600">{product.description}</p>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 space-y-3">
        <button
          onClick={handleAddToCart}
          disabled={!selectedVariant?.availableForSale}
          className="w-full bg-[#3eb489] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#359970] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {selectedVariant?.availableForSale 
            ? `Add to Cart - $${parseFloat(price).toFixed(2)}` 
            : 'Out of Stock'}
        </button>
        
        <button
          onClick={onBuyNow}
          disabled={!selectedVariant?.availableForSale}
          className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {selectedVariant?.availableForSale 
            ? `Buy Now with ${parseFloat(price).toFixed(2)} USDC` 
            : 'Out of Stock'}
        </button>
      </div>
      
      {/* Cart Sidebar */}
      <Cart isOpen={isCartOpen} onClose={closeCart} />
    </div>
  );
}