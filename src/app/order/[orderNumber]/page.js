import { Suspense } from 'react';
import { OrderSuccessClient } from './OrderSuccessClient';

export async function generateMetadata({ params }) {
  const { orderNumber } = params;
  
  // Fix URL construction to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app').replace(/\/$/, '');
  const dynamicImageUrl = `${baseUrl}/api/og/order?orderNumber=${orderNumber}`;
  
  // Create frame embed with dynamic order image - use version "1" for Mini App embeds
  const frame = {
    version: "1",
    imageUrl: dynamicImageUrl,
    button: {
      title: "Shop More Merch 🛒",
      action: {
        type: "launch_frame",
        url: baseUrl,
        name: "Minted Merch Shop",
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#1a1a1a"
      }
    }
  };

  return {
    title: `Order ${orderNumber} - Minted Merch Shop`,
    description: 'Your order has been confirmed! Shop more crypto merch with instant USDC payments.',
    metadataBase: new URL(baseUrl),
    other: {
      'fc:frame': JSON.stringify(frame),
    },
    openGraph: {
      title: `Order ${orderNumber} - Minted Merch Shop`,
      description: 'Your order has been confirmed! Shop more crypto merch with instant USDC payments.',
      siteName: 'Minted Merch Shop',
      images: [
        {
          url: dynamicImageUrl,
          width: 1200,
          height: 800,
          alt: `Order ${orderNumber} - Minted Merch Shop`,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Order ${orderNumber} - Minted Merch Shop`,
      description: 'Your order has been confirmed! Shop more crypto merch with instant USDC payments.',
      images: [dynamicImageUrl],
    },
  };
}

// Force dynamic rendering to prevent caching issues
export const dynamic = 'force-dynamic';

export default function OrderPage({ params }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrderSuccessClient orderNumber={params.orderNumber} />
    </Suspense>
  );
} 