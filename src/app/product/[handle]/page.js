import { Suspense } from 'react';
import { ProductPageClient } from './ProductPageClient';

export async function generateMetadata({ params }) {
  const { handle } = params;
  const productTitle = handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  // Fix URL construction to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app').replace(/\/$/, '');
  const dynamicImageUrl = `${baseUrl}/api/og/product?handle=${handle}`;
  
  // Create frame embed with dynamic product image - use version "next" for Mini App embeds
  const frame = {
    version: "next",
    imageUrl: dynamicImageUrl,
    button: {
      title: `Buy ${productTitle} 📦`,
      action: {
        type: "launch_frame",
        url: `${baseUrl}/product/${handle}`,
        name: "Minted Merch Shop",
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#1a1a1a"
      }
    }
  };

  return {
    title: `${productTitle} - Minted Merch Shop`,
    description: `Shop ${productTitle} with USDC on Base blockchain. Crypto merch with instant payments.`,
    metadataBase: new URL(baseUrl),
    other: {
      'fc:frame': JSON.stringify(frame),
    },
    openGraph: {
      title: `${productTitle} - Minted Merch Shop`,
      description: `Shop ${productTitle} with USDC on Base blockchain. Crypto merch with instant payments.`,
      siteName: 'Minted Merch Shop',
      images: [
        {
          url: dynamicImageUrl,
          width: 1200,
          height: 800,
          alt: `${productTitle} - Minted Merch Shop`,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${productTitle} - Minted Merch Shop`,
      description: `Shop ${productTitle} with USDC on Base blockchain. Crypto merch with instant payments.`,
      images: [dynamicImageUrl],
    },
  };
}

export default function ProductPage({ params }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProductPageClient handle={params.handle} />
    </Suspense>
  );
}