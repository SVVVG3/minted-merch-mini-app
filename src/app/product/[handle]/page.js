import { Suspense } from 'react';
import { ProductPageClient } from './ProductPageClient';

// Generate metadata for sharing - using static OG image
export async function generateMetadata({ params, searchParams }) {
  const { handle } = params;
  
  try {
    // Build URLs
    const baseUrl = 'https://mintedmerch.vercel.app';
    const queryString = searchParams ? new URLSearchParams(searchParams).toString() : '';
    const productUrl = `${baseUrl}/product/${handle}${queryString ? `?${queryString}` : ''}`;
    
    // Use static branded OG image
    const ogImageUrl = `${baseUrl}/og-image.png`;

    // Simple title transformation
    const productTitle = handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Create Mini App embed with static image
    const frameEmbed = {
      version: "next",
      imageUrl: ogImageUrl,
      button: {
        title: "🛒 Shop Crypto Merch",
        action: {
          type: "launch_frame",
          url: productUrl,
          name: "Minted Merch Shop",
          splashImageUrl: `${baseUrl}/splash.png`,
          splashBackgroundColor: "#1a1a1a"
        }
      }
    };

    // Return metadata with static image
    return {
      title: `${productTitle} - Minted Merch Shop`,
      description: 'Shop crypto merch with USDC on Base',
      openGraph: {
        title: `${productTitle} - Minted Merch Shop`,
        description: 'Shop crypto merch with USDC on Base',
        images: [ogImageUrl],
      },
      other: {
        'fc:frame': JSON.stringify(frameEmbed),
      },
    };
  } catch (error) {
    // Simple fallback
    return {
      title: 'Minted Merch Shop',
      description: 'Shop crypto merch with USDC on Base',
      openGraph: {
        images: ['https://mintedmerch.vercel.app/og-image.png'],
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