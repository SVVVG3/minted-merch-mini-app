import { Suspense } from 'react';
import { ProductPageClient } from './ProductPageClient';

export async function generateMetadata({ params }) {
  const { handle } = params;
  
  // Fix URL construction to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
  
  try {
    // Fetch actual product data for metadata
    const response = await fetch(`${baseUrl}/api/shopify/products?handle=${handle}`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (response.ok) {
      const product = await response.json();
      
      // Extract product details
      const title = product.title || handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const price = product.priceRange?.minVariantPrice?.amount || '0.00';
      const imageUrl = product.images?.edges?.[0]?.node?.url;
      const description = product.description || `Shop ${title} with USDC on Base blockchain. Crypto merch with instant payments.`;
      
      // Build OG image URL with product data as parameters
      const ogParams = new URLSearchParams({
        handle,
        title,
        price,
      });
      
      // Add image URL if available
      if (imageUrl) {
        ogParams.append('image', imageUrl);
      }
      
      const dynamicImageUrl = `${baseUrl}/api/og/product?${ogParams.toString()}`;
      
      // Create frame embed with dynamic product image - use version "next" for Mini App embeds
      const frame = {
        version: "next",
        imageUrl: dynamicImageUrl,
        button: {
          title: `Buy ${title} 📦`,
          action: {
            type: "launch_frame",
            url: `${baseUrl}/product/${handle}`,
            name: "Minted Merch Shop",
            splashImageUrl: `${baseUrl}/splash.png`,
            splashBackgroundColor: "#000000"
          }
        }
      };

      return {
        title: `${title} - Minted Merch Shop`,
        description,
        metadataBase: new URL(baseUrl),
        other: {
          'fc:frame': JSON.stringify(frame),
        },
        openGraph: {
          title: `${title} - Minted Merch Shop`,
          description,
          siteName: 'Minted Merch Shop',
          images: [
            {
              url: dynamicImageUrl,
              width: 1200,
              height: 800,
              alt: `${title} - Minted Merch Shop`,
            },
          ],
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title: `${title} - Minted Merch Shop`,
          description,
          images: [dynamicImageUrl],
        },
      };
    }
  } catch (error) {
    console.error('Error fetching product for metadata:', error);
  }
  
  // Fallback metadata if product fetch fails
  const productTitle = handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const fallbackImageUrl = `${baseUrl}/api/og/product?handle=${handle}&title=${encodeURIComponent(productTitle)}`;
  
  const frame = {
    version: "next",
    imageUrl: fallbackImageUrl,
    button: {
      title: `Buy ${productTitle} 📦`,
      action: {
        type: "launch_frame",
        url: `${baseUrl}/product/${handle}`,
        name: "Minted Merch Shop",
        splashImageUrl: `${baseUrl}/splash.png`,
                    splashBackgroundColor: "#000000"
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
          url: fallbackImageUrl,
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
      images: [fallbackImageUrl],
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