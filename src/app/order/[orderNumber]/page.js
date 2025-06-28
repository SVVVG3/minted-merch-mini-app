import { Suspense } from 'react';
import { OrderSuccessClient } from './OrderSuccessClient';

export async function generateMetadata({ params, searchParams }) {
  const { orderNumber } = params;
  const total = searchParams.total;
  const products = searchParams.products;
  
  // Use dynamic OG image for order sharing
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app';
  const dynamicImageUrl = `${baseUrl}/api/og/order?order=${encodeURIComponent(orderNumber)}${total ? `&total=${encodeURIComponent(total)}` : ''}${products ? `&products=${encodeURIComponent(products)}` : ''}`;
  
  // Create frame embed with dynamic order image - use version "1" for Mini Apps
  const frame = {
    version: "1",
    imageUrl: dynamicImageUrl,
    button: {
      title: "Shop More 🛒",
      action: {
        type: "launch_frame",
        url: baseUrl,
        name: "Minted Merch Shop",
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#1a1a1a"
      }
    }
  };

  const description = `Order ${orderNumber} confirmed! ${products ? `Purchased: ${products}` : 'Thank you for your purchase!'} Paid with USDC on Base blockchain.`;

  return {
    title: `Order ${orderNumber} Confirmed - Minted Merch`,
    description: description,
    openGraph: {
      title: `Order ${orderNumber} Confirmed - Minted Merch`,
      description: description,
      images: [
        {
          url: dynamicImageUrl,
          width: 1200,
          height: 800,
          alt: `Order ${orderNumber} Confirmation - Minted Merch`,
        }
      ],
      type: 'website',
      siteName: 'Minted Merch Shop',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Order ${orderNumber} Confirmed - Minted Merch`,
      description: description,
      images: [dynamicImageUrl],
    },
    other: {
      'fc:frame': JSON.stringify(frame)
    }
  };
}

// Force dynamic rendering to prevent caching issues
export const dynamic = 'force-dynamic';

export default function OrderPage({ params, searchParams }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading order details...</p>
      </div>
    }>
      <OrderSuccessClient 
        orderNumber={params.orderNumber}
        total={searchParams.total}
        products={searchParams.products}
      />
    </Suspense>
  );
} 