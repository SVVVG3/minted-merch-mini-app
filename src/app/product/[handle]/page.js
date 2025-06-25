import { Suspense } from 'react';
import { ProductPageClient } from './ProductPageClient';

// Generate metadata for sharing
export async function generateMetadata({ params }) {
  const { handle } = params;
  
  try {
    // Fetch product data for meta tags
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mintedmerch.vercel.app';
    const response = await fetch(`${baseUrl}/api/shopify/products?handle=${handle}`, {
      cache: 'no-store' // Ensure fresh data for sharing
    });
    
    if (!response.ok) {
      throw new Error('Product not found');
    }
    
    const product = await response.json();
    const mainImage = product.images?.edges?.[0]?.node;
    const price = product.priceRange?.minVariantPrice?.amount || '0';

    return {
      title: `${product.title} - Minted Merch Shop`,
      description: product.description || `Buy ${product.title} for $${price} USDC on Base`,
      openGraph: {
        title: product.title,
        description: product.description || `Buy ${product.title} for $${price} USDC`,
        images: [mainImage?.url || `${baseUrl}/og-image.png`],
        url: `${baseUrl}/product/${handle}`,
      },
      other: {
        // Farcaster Frame meta tags
        'fc:frame': 'vNext',
        'fc:frame:image': `${baseUrl}/api/og/product?handle=${handle}`,
        'fc:frame:image:aspect_ratio': '3:2',
        'fc:frame:button:1': `🛒 Buy ${product.title} - $${price}`,
        'fc:frame:button:1:action': 'link',
        'fc:frame:button:1:target': `${baseUrl}/product/${handle}`,
        'og:image': `${baseUrl}/api/og/product?handle=${handle}`,
      }
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Product - Minted Merch Shop',
      description: 'Shop crypto merch with USDC on Base'
    };
  }
}

export default function ProductPage({ params }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    }>
      <ProductPageClient handle={params.handle} />
    </Suspense>
  );
}