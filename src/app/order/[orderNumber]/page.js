import { Suspense } from 'react';
import { OrderSuccessClient } from './OrderSuccessClient';

export async function generateMetadata({ params }) {
  const { orderNumber } = params;
  
  // Fix URL construction to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app').replace(/\/$/, '');
  const dynamicImageUrl = `${baseUrl}/api/og/order?orderNumber=${orderNumber}`;
  
  // Create frame embed with dynamic order image - use version "1" for Mini Apps
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
    description: `Your crypto merch order ${orderNumber} has been confirmed! Paid with USDC on Base blockchain.`,
    openGraph: {
      title: `Order ${orderNumber} - Minted Merch Shop`,
      description: `Your crypto merch order ${orderNumber} has been confirmed! Paid with USDC on Base blockchain.`,
      images: [
        {
          url: dynamicImageUrl,
          width: 1200,
          height: 800,
          alt: `Order ${orderNumber} - Minted Merch Shop`,
        }
      ],
      type: 'website',
      siteName: 'Minted Merch Shop',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Order ${orderNumber} - Minted Merch Shop`,
      description: `Your crypto merch order ${orderNumber} has been confirmed! Paid with USDC on Base blockchain.`,
      images: [dynamicImageUrl],
    },
    other: {
      'fc:frame': JSON.stringify(frame)
    }
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