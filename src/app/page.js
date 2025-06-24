import { getCollectionByHandle, getCollections } from '@/lib/shopify';
import { HomePage } from '@/components/HomePage';

export const metadata = {
  title: 'Minted Merch Shop - Crypto Merch with USDC',
  description: 'Apparel, accessories, & more! Designed after your favorite coins, communities, & NFTs - pay with USDC on Base!',
  openGraph: {
    title: 'Minted Merch Shop',
    description: 'Apparel, accessories, & more! Designed after your favorite coins, communities, & NFTs - pay with USDC on Base!',
    url: 'https://mintedmerch.vercel.app',
    siteName: 'Minted Merch Shop',
    images: [
      {
        url: 'https://mintedmerch.vercel.app/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Minted Merch Shop',
    description: 'Apparel, accessories, & more! Designed after your favorite coins, communities, & NFTs - pay with USDC on Base!',
    images: ['https://mintedmerch.vercel.app/og-image.png'],
  },
  other: {
    'fc:frame': JSON.stringify({
      version: "next",
      imageUrl: "https://mintedmerch.vercel.app/og-image.png",
      button: {
        title: "Shop Now 📦",
        action: {
          type: "launch_frame",
          name: "minted-merch-shop",
          url: process.env.NEXT_PUBLIC_APP_URL || "https://mintedmerch.vercel.app",
          splashImageUrl: "https://mintedmerch.vercel.app/splash.png",
          splashBackgroundColor: "#000000"
        }
      }
    })
  }
};

// Force dynamic rendering to prevent caching issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  let collection;
  let products = [];
  
  try {
    let targetHandle;
    
    // Check if TARGET_COLLECTION_HANDLE env variable exists
    if (process.env.TARGET_COLLECTION_HANDLE) {
      targetHandle = process.env.TARGET_COLLECTION_HANDLE;
    } else {
      // Get all collections and use the first one
      const collections = await getCollections();
      if (collections && collections.length > 0) {
        targetHandle = collections[0].handle;
      } else {
        throw new Error('No collections found');
      }
    }

    const timestamp = Date.now();
    console.log(`[${timestamp}] Fetching collection:`, targetHandle);
    
    collection = await getCollectionByHandle(targetHandle);
    if (collection && collection.products) {
      products = collection.products.edges.map(edge => edge.node);
    }

    console.log(`[${timestamp}] Collection:`, collection?.title);
    console.log(`[${timestamp}] Products count:`, products.length);
    console.log(`[${timestamp}] Product titles:`, products.map(p => p.title));
    console.log(`[${timestamp}] Collection handle used:`, targetHandle);
  } catch (error) {
    console.error('Error fetching collection:', error);
  }

  return <HomePage collection={collection} products={products} />;
}