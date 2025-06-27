'use client';

import { useState } from 'react';
import Link from 'next/link';
import { VariantSelector } from './VariantSelector';
import { useCart } from '@/lib/CartContext';
import { useFarcaster } from '@/lib/useFarcaster';
import { Cart } from './Cart';

export function ProductDetail({ 
  product, 
  handle,
  selectedVariant, 
  onVariantChange, 
  onBuyNow 
}) {
  const { addItem, isInCart, getItemQuantity, itemCount, cartTotal } = useCart();
  const { isInFarcaster } = useFarcaster();
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Use variant image if available, otherwise fall back to first product image
  const mainImage = selectedVariant?.image || product.images?.edges?.[0]?.node;
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

  // Share product function
  const handleShareProduct = async () => {
    if (!isInFarcaster) {
      // Fallback for non-Farcaster environments
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${product.title} - Minted Merch`,
            text: `Check out this ${product.title} on /mintedmerch! Order now & pay with USDC on Base 🔵`,
            url: window.location.href,
          });
        } catch (err) {
          console.log('Error sharing:', err);
        }
      } else {
        // Copy link to clipboard
        try {
          await navigator.clipboard.writeText(window.location.href);
          alert('Link copied to clipboard!');
        } catch (err) {
          console.log('Error copying to clipboard:', err);
        }
      }
      return;
    }

    // Farcaster sharing using SDK composeCast action
    try {
      // Use cache-busting parameter to create fresh URL for testing
      const timestamp = Date.now();
      const productUrl = `${window.location.origin}/product/${handle}?v=${timestamp}`;
      const shareText = `Check out this ${product.title} on /mintedmerch!\n\nOrder now & pay with USDC on Base 🔵`;
      
      // Use the Farcaster SDK composeCast action
      const { sdk } = await import('../lib/frame');
      const result = await sdk.actions.composeCast({
        text: shareText,
        embeds: [productUrl],
      });
      
      console.log('Cast composed:', result);
    } catch (error) {
      console.error('Error sharing product:', error);
      // Fallback to copying link
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.log('Error copying to clipboard:', err);
      }
    }
  };

  // Helper function to format product description with line breaks and styling
  const formatDescription = (description, descriptionHtml) => {
    // Prefer HTML description if available, otherwise use plain text
    let content = descriptionHtml || description;
    if (!content) return null;
    
    // If we have HTML, parse it properly
    if (descriptionHtml) {
      return (
        <div 
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      );
    }
    
    // For plain text, create better formatting
    // Split by periods followed by capital letters or common separators
    let lines = content
      .split(/(?:\.|!|\?)\s*(?=[A-Z])|•|[\r\n]+/)
      .map(line => line.trim())
      .filter(line => line && line.length > 2);
    
    // If no natural breaks found, try to split long text intelligently
    if (lines.length === 1 && content.length > 100) {
      // Split on common patterns: percentages, measurements, features
      lines = content
        .split(/(?:(?:\d+%|\d+\s*oz|\d+\s*g\/m²)\s*[•\-]?\s*)|(?:[•\-]\s*)/g)
        .map(line => line.trim())
        .filter(line => line && line.length > 2);
    }
    
    const elements = [];
    
    lines.forEach((line, index) => {
      // Skip very short lines that are likely artifacts
      if (line.length < 3) return;
      
      // Check for percentage or measurement patterns (likely specs)
      if (line.match(/\d+%|\d+\s*oz|\d+\s*g\/m²|cotton|polyester|fabric|weight/i)) {
        elements.push(
          <div key={`spec-${index}`} className="flex items-start mb-2">
            <span className="text-[#3eb489] font-bold mr-2 mt-1">•</span>
            <span className="text-gray-700 leading-relaxed">
              {formatTextWithBold(line)}
            </span>
          </div>
        );
      }
      // Check for feature descriptions (structured, five-panel, etc.)
      else if (line.match(/structured|panel|profile|bill|closure|snapback/i)) {
        elements.push(
          <div key={`feature-${index}`} className="flex items-start mb-2">
            <span className="text-[#3eb489] font-bold mr-2 mt-1">•</span>
            <span className="text-gray-700 leading-relaxed">
              {formatTextWithBold(line)}
            </span>
          </div>
        );
      }
      // Check if line looks like a header or title
      else if (line === line.toUpperCase() && line.length > 3 || line.endsWith(':') || line.match(/^(how it works|embroidered design)/i)) {
        elements.push(
          <h4 key={`header-${index}`} className="text-gray-900 font-semibold text-base mb-3 mt-4">
            {formatTextWithBold(line)}
          </h4>
        );
      }
      // Regular paragraph text
      else {
        elements.push(
          <p key={`p-${index}`} className="text-gray-700 leading-relaxed mb-4">
            {formatTextWithBold(line)}
          </p>
        );
      }
    });
    
    // If no elements were created, just show the original text as a paragraph
    if (elements.length === 0) {
      elements.push(
        <p key="fallback" className="text-gray-700 leading-relaxed mb-4">
          {formatTextWithBold(content)}
        </p>
      );
    }
    
    return elements;
  };

  // Helper function to format bold text within a string
  const formatTextWithBold = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    // Handle **bold** text
    if (text.includes('**')) {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={partIndex} className="font-semibold text-red-600">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });
    }
    
    // Handle (TEXT IN PARENTHESES) as emphasized
    if (text.includes('(') && text.includes(')')) {
      const parts = text.split(/(\([^)]+\))/g);
      return parts.map((part, partIndex) => {
        if (part.startsWith('(') && part.endsWith(')')) {
          return (
            <span key={partIndex} className="font-medium text-red-600">
              {part}
            </span>
          );
        }
        return part;
      });
    }
    
    return text;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Back Button */}
          <Link href="/" className="flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          
          {/* Title - takes available space but can truncate */}
          <h1 className="text-lg font-semibold text-gray-900 truncate min-w-0 flex-1">
            {product.title}
          </h1>
          
          {/* Action Buttons - fixed width, never shrink */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Share Button */}
            <button
              onClick={handleShareProduct}
              className="flex items-center justify-center w-10 h-10 bg-[#8A63D2] hover:bg-[#7C5BC7] text-white rounded-lg transition-colors"
              title="Share on Farcaster"
            >
              {/* Official Farcaster Logo */}
              <svg className="w-5 h-5" viewBox="0 0 1000 1000" fill="currentColor">
                <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
                <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.445H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"/>
                <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.445H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"/>
              </svg>
            </button>

            {/* Cart Button */}
            <button
              onClick={openCart}
              className="flex items-center gap-2 bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-2 rounded-lg transition-colors"
              title="Open Cart"
            >
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
                </svg>
                
                {/* Item Count Badge */}
                {itemCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {itemCount > 99 ? '99+' : itemCount}
                  </div>
                )}
              </div>
              {itemCount > 0 && (
                <span className="text-sm font-medium whitespace-nowrap">
                  ${cartTotal.toFixed(2)}
                </span>
              )}
            </button>
          </div>
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

        <div className="p-4 space-y-6">
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
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
              <div className="prose prose-sm max-w-none">
                {formatDescription(product.description, product.descriptionHtml)}
              </div>
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