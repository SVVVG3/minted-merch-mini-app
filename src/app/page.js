import { getCollectionByHandle, getCollections } from '@/lib/shopify';
import { ProductGrid } from '@/components/ProductGrid';

export const metadata = {
  title: 'Shop with USDC',
  description: 'Browse products and pay with USDC on Base',
  other: {
    'fc:frame': JSON.stringify({
      version: "next",
      imageUrl: "https://placehold.co/600x400/000000/FFFFFF/png?text=Shop+with+USDC",
      button: {
        title: "Shop Now!",
        action: {
          type: "launch_frame",
          name: "shopify-mini-app",
          url: process.env.NEXT_PUBLIC_APP_URL || "https://shopify-mini-app-frame.vercel.app",
          splashImageUrl: "https://placehold.co/600x400/000000/FFFFFF/png?text=Loading+Shop...",
          splashBackgroundColor: "#000000"
        }
      }
    })
  }
};

export default async function HomePage() {
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

    console.log('Fetching collection:', targetHandle);
    
    collection = await getCollectionByHandle(targetHandle);
    if (collection && collection.products) {
      products = collection.products.edges.map(edge => edge.node);
    }

    console.log('Collection:', collection);
    console.log('Products:', products);
  } catch (error) {
    console.error('Error fetching collection:', error);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">
            {collection?.title || 'All Products'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Pay with USDC on Base</p>
        </div>
      </header>
      
      <main>
        <ProductGrid products={products} />
      </main>
    </div>
  );
}