import { Suspense } from 'react';
import { ProductPageClient } from './ProductPageClient';

export async function generateMetadata({ params }) {
  const { handle } = params;
  const productTitle = handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  // Create frame embed exactly as shown in docs
  const frame = {
    version: "next",
    imageUrl: "https://mintedmerch.vercel.app/og-image.png",
    button: {
      title: `Buy ${productTitle} 📦`,
      action: {
        type: "launch_frame",
        url: `https://mintedmerch.vercel.app/product/${handle}`,
        name: "Minted Merch Shop",
        splashImageUrl: "https://mintedmerch.vercel.app/splash.png",
        splashBackgroundColor: "#1a1a1a"
      }
    }
  };

  return {
    title: `${productTitle} - Minted Merch Shop`,
    description: 'Shop crypto merch with USDC on Base',
    openGraph: {
      title: `${productTitle} - Minted Merch Shop`,
      description: 'Shop crypto merch with USDC on Base',
      images: ['https://mintedmerch.vercel.app/og-image.png'],
    },
    other: {
      'fc:frame': JSON.stringify(frame)
    }
  };
}

export default function ProductPage({ params }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProductPageClient handle={params.handle} />
    </Suspense>
  );
}