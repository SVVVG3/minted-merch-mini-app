import { getCollectionByHandle, getCollections } from '@/lib/shopify';
import { HomePage } from '@/components/HomePage';

export async function generateMetadata() {
  // Fix URL construction to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app').replace(/\/$/, '');
  
  // Create frame embed for home page - use version "next" for Mini App embeds
  const frame = {
    version: "next",
    imageUrl: `${baseUrl}/api/og/home`,
    button: {
      title: "Shop Now 📦",
      action: {
        type: "launch_frame",
        url: baseUrl,
        name: "Minted Merch Shop",
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#000000"
      }
    }
  };

  return {
    title: 'Minted Merch Shop - Crypto Merch with USDC on Base',
    description: 'Shop premium crypto merchandise and pay instantly with USDC on Base blockchain. Apparel, accessories, and more designed after your favorite coins and communities.',
    metadataBase: new URL(baseUrl),
    other: {
      'fc:frame': JSON.stringify(frame),
    },
    openGraph: {
      title: 'Minted Merch Shop - Crypto Merch with USDC on Base',
      description: 'Shop premium crypto merchandise and pay instantly with USDC on Base blockchain. Apparel, accessories, and more designed after your favorite coins and communities.',
      siteName: 'Minted Merch Shop',
      images: [
        {
          url: `${baseUrl}/api/og/home`,
          width: 1200,
          height: 800,
          alt: 'Minted Merch Shop - Crypto Merchandise',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Minted Merch Shop - Crypto Merch with USDC on Base',
      description: 'Shop premium crypto merchandise and pay instantly with USDC on Base blockchain. Apparel, accessories, and more designed after your favorite coins and communities.',
      images: [`${baseUrl}/api/og/home`],
    },
  };
}

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