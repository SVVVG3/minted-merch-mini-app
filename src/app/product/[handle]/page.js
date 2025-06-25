import { Suspense } from 'react';
import { ProductPageClient } from './ProductPageClient';

// Generate metadata for sharing
export async function generateMetadata({ params, searchParams }) {
  const { handle } = params;
  
  console.log('=== METADATA GENERATION START ===');
  console.log('Handle:', handle);
  console.log('SearchParams:', searchParams);
  
  try {
    // Build URLs with cache-busting parameters
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mintedmerch.vercel.app';
    console.log('Base URL:', baseUrl);
    
    const queryString = searchParams ? new URLSearchParams(searchParams).toString() : '';
    console.log('Query string:', queryString);
    
    const ogImageUrl = `${baseUrl}/api/og/product?handle=${handle}${queryString ? `&${queryString}` : ''}`;
    const productUrl = `${baseUrl}/product/${handle}${queryString ? `?${queryString}` : ''}`;
    
    console.log('OG Image URL:', ogImageUrl);
    console.log('Product URL:', productUrl);

    // Create Mini App embed for sharing with cache-busting
    const frameEmbed = {
      version: "next",
      imageUrl: ogImageUrl,
      button: {
        title: `🛒 Shop Now`,
        action: {
          type: "launch_frame",
          url: productUrl,
          name: "Minted Merch Shop",
          splashImageUrl: `${baseUrl}/splash.png`,
          splashBackgroundColor: "#1a1a1a"
        }
      }
    };

    console.log('Frame embed:', JSON.stringify(frameEmbed, null, 2));

    // Simple metadata without complex operations
    const metadata = {
      title: `${handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - Minted Merch Shop`,
      description: 'Shop crypto merch with USDC on Base',
      openGraph: {
        title: `${handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - Minted Merch Shop`,
        description: 'Shop crypto merch with USDC on Base',
        images: [ogImageUrl],
        url: productUrl,
      },
      twitter: {
        card: 'summary_large_image',
        title: `${handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - Minted Merch Shop`,
        description: 'Shop crypto merch with USDC on Base',
        images: [ogImageUrl],
      },
      metadataBase: new URL(baseUrl),
      alternates: {
        canonical: productUrl,
      },
      // Try the other property approach for fc:frame
      other: {
        'fc:frame': JSON.stringify(frameEmbed),
      },
    };

    console.log('Generated metadata:', JSON.stringify(metadata, null, 2));
    console.log('=== METADATA GENERATION SUCCESS ===');
    
    return metadata;
  } catch (error) {
    console.error('=== METADATA GENERATION ERROR ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Fallback metadata
    const fallbackMetadata = {
      title: 'Minted Merch Shop',
      description: 'Shop crypto merch with USDC on Base',
      openGraph: {
        title: 'Minted Merch Shop',
        description: 'Shop crypto merch with USDC on Base',
        images: [`${process.env.NEXT_PUBLIC_BASE_URL || 'https://mintedmerch.vercel.app'}/og-image.png`],
      },
    };
    
    console.log('Using fallback metadata:', JSON.stringify(fallbackMetadata, null, 2));
    console.log('=== METADATA GENERATION FALLBACK ===');
    
    return fallbackMetadata;
  }
}

export default function ProductPage({ params }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProductPageClient handle={params.handle} />
    </Suspense>
  );
}