import { Suspense } from 'react';
import { ProductPageClient } from './ProductPageClient';

// Generate metadata for sharing
export async function generateMetadata({ params, searchParams }) {
  const { handle } = params;
  
  try {
    // Build URLs with cache-busting parameters
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mintedmerch.vercel.app';
    const queryString = searchParams ? new URLSearchParams(searchParams).toString() : '';
    const ogImageUrl = `${baseUrl}/api/og/product?handle=${handle}${queryString ? `&${queryString}` : ''}`;
    const productUrl = `${baseUrl}/product/${handle}${queryString ? `?${queryString}` : ''}`;

    // Create Mini App embed for sharing with cache-busting
    const frameEmbed = {
      version: "next",
      imageUrl: ogImageUrl,
      button: {
        title: `🛒 Shop Now`,
        action: {
          type: "launch_frame",
          url: productUrl,
          name: "Minted Merch Shop",
          splashImageUrl: `${baseUrl}/splash.png`,
          splashBackgroundColor: "#1a1a1a"
        }
      }
    };

    return {
      title: `${handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - Minted Merch Shop`,
      description: 'Shop crypto merch with USDC on Base',
      openGraph: {
        title: `${handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - Minted Merch Shop`,
        description: 'Shop crypto merch with USDC on Base',
        images: [ogImageUrl],
        url: productUrl,
      },
      twitter: {
        card: 'summary_large_image',
        title: `${handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - Minted Merch Shop`,
        description: 'Shop crypto merch with USDC on Base',
        images: [ogImageUrl],
      },
      // Use robots meta tag approach for custom meta tags
      robots: {
        index: true,
        follow: true,
      },
      // Add the fc:frame meta tag using the metadata API
      metadataBase: new URL(baseUrl),
      alternates: {
        canonical: productUrl,
      },
      // Use the other property for custom meta tags - this is the correct approach
      other: {
        'fc:frame': JSON.stringify(frameEmbed),
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    
    // Fallback metadata
    return {
      title: 'Minted Merch Shop',
      description: 'Shop crypto merch with USDC on Base',
      openGraph: {
        title: 'Minted Merch Shop',
        description: 'Shop crypto merch with USDC on Base',
        images: [`${process.env.NEXT_PUBLIC_BASE_URL || 'https://mintedmerch.vercel.app'}/og-image.png`],
      },
    };
  }
}

export default function ProductPage({ params }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProductPageClient handle={params.handle} />
    </Suspense>
  );
}