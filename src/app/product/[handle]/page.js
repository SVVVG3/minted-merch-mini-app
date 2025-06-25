import { Suspense } from 'react';
import { ProductPageClient } from './ProductPageClient';

// Generate metadata for sharing
export async function generateMetadata({ params, searchParams }) {
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

    // Build query string for cache-busting and other parameters
    const queryString = searchParams ? new URLSearchParams(searchParams).toString() : '';
    const ogImageUrl = `${baseUrl}/api/og/product?handle=${handle}${queryString ? `&${queryString}` : ''}`;
    const productUrl = `${baseUrl}/product/${handle}${queryString ? `?${queryString}` : ''}`;

    // Create Mini App embed for sharing
    const frameEmbed = {
      version: "next",
      imageUrl: ogImageUrl,
      button: {
        title: `🛒 Buy ${product.title} - $${price}`,
        action: {
          type: "launch_frame",
          url: productUrl,
          name: "Minted Merch Shop",
          splashImageUrl: `${baseUrl}/splash.png`,
          splashBackgroundColor: "#000000"
        }
      }
    };

    return {
      title: `${product.title} - Minted Merch Shop`,
      description: product.description || `Buy ${product.title} for $${price} USDC on Base`,
      openGraph: {
        title: product.title,
        description: product.description || `Buy ${product.title} for $${price} USDC`,
        images: [mainImage?.url || `${baseUrl}/og-image.png`],
        url: productUrl,
      },
      other: {
        // Mini App embed meta tag (single JSON object)
        'fc:frame': JSON.stringify(frameEmbed),
        'og:image': ogImageUrl,
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