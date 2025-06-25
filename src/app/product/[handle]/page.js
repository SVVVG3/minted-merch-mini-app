import { Suspense } from 'react';
import { ProductPageClient } from './ProductPageClient';
import { getProductByHandle } from '@/lib/shopify';

// Generate metadata for sharing
export async function generateMetadata({ params, searchParams }) {
  const { handle } = params;
  
  try {
    console.log('Generating metadata for handle:', handle);
    console.log('searchParams:', searchParams);
    
    // Call Shopify directly instead of making HTTP request
    const product = await getProductByHandle(handle);
    console.log('Product fetched:', product.title);
    
    const mainImage = product.images?.edges?.[0]?.node;
    const price = product.priceRange?.minVariantPrice?.amount || '0';

    // Build query string for cache-busting and other parameters
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mintedmerch.vercel.app';
    const queryString = searchParams ? new URLSearchParams(searchParams).toString() : '';
    const ogImageUrl = `${baseUrl}/api/og/product?handle=${handle}${queryString ? `&${queryString}` : ''}`;
    const productUrl = `${baseUrl}/product/${handle}${queryString ? `?${queryString}` : ''}`;

    console.log('OG Image URL:', ogImageUrl);
    console.log('Product URL:', productUrl);

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

    const metadata = {
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

    console.log('Generated metadata successfully');
    return metadata;
  } catch (error) {
    console.error('Error generating metadata:', error);
    console.error('Error stack:', error.stack);
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