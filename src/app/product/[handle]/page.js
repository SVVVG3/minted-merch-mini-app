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
          splashBackgroundColor: "#000000"
        }
      }
    };

    return {
      title: 'Minted Merch Shop - Crypto Merchandise',
      description: 'Shop crypto merch with USDC payments on Base',
      openGraph: {
        title: 'Minted Merch Shop',
        description: 'Crypto merchandise with instant USDC payments',
        images: [ogImageUrl],
        url: productUrl,
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Minted Merch Shop',
        description: 'Crypto merchandise with instant USDC payments',
        images: [ogImageUrl],
      },
      metadataBase: new URL(baseUrl),
      alternates: {
        canonical: productUrl,
      },
      // Custom meta tags for Farcaster Mini App embed
      other: {
        'fc:frame': JSON.stringify(frameEmbed),
      }
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Minted Merch Shop',
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