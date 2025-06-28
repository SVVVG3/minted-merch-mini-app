import { Suspense } from 'react';
import { OrderSuccessClient } from './OrderSuccessClient';

export async function generateMetadata({ params, searchParams }) {
  const { orderNumber } = params;
  const total = searchParams.total;
  const products = searchParams.products;
  
  // Use dynamic OG image for order sharing
  const dynamicImageUrl = `https://mintedmerch.vercel.app/api/og/order?order=${encodeURIComponent(orderNumber)}${total ? `&total=${encodeURIComponent(total)}` : ''}${products ? `&products=${encodeURIComponent(products)}` : ''}`;
  
  // Create frame embed with dynamic order image
  const frame = {
    version: "next",
    imageUrl: dynamicImageUrl,
    button: {
      title: "Shop More 🛒",
      action: {
        type: "launch_frame",
        url: "https://mintedmerch.vercel.app",
        name: "Minted Merch Shop",
        splashImageUrl: "https://mintedmerch.vercel.app/splash.png",
        splashBackgroundColor: "#1a1a1a"
      }
    }
  };

  return {
    title: `Order ${orderNumber} Confirmed - Minted Merch`,
    description: `Order ${orderNumber} confirmed! ${products ? `Purchased: ${products}` : 'Thank you for your purchase!'} Paid with USDC on Base.`,
    openGraph: {
      title: `Order ${orderNumber} Confirmed - Minted Merch`,
      description: `Order ${orderNumber} confirmed! ${products ? `Purchased: ${products}` : 'Thank you for your purchase!'} Paid with USDC on Base.`,
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