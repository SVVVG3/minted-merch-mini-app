'use client';

import { useEffect } from 'react';

export function FarcasterMetaTags({ handle, searchParams }) {
  useEffect(() => {
    // Remove any existing fc:frame meta tags
    const existingTags = document.querySelectorAll('meta[property="fc:frame"]');
    existingTags.forEach(tag => tag.remove());

    // Build URLs with cache-busting parameters
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mintedmerch.vercel.app';
    const queryString = searchParams ? new URLSearchParams(searchParams).toString() : '';
    const ogImageUrl = `${baseUrl}/api/og/product?handle=${handle}${queryString ? `&${queryString}` : ''}`;
    const productUrl = `${baseUrl}/product/${handle}${queryString ? `?${queryString}` : ''}`;

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
          splashBackgroundColor: "#000000"
        }
      }
    };

    // Create and add the fc:frame meta tag
    const frameMetaTag = document.createElement('meta');
    frameMetaTag.setAttribute('property', 'fc:frame');
    frameMetaTag.setAttribute('content', JSON.stringify(frameEmbed));
    document.head.appendChild(frameMetaTag);

    // Also add og:image meta tag
    const ogImageMetaTag = document.createElement('meta');
    ogImageMetaTag.setAttribute('property', 'og:image');
    ogImageMetaTag.setAttribute('content', ogImageUrl);
    document.head.appendChild(ogImageMetaTag);

    // Cleanup function to remove tags when component unmounts
    return () => {
      frameMetaTag.remove();
      ogImageMetaTag.remove();
    };
  }, [handle, searchParams]);

  return null; // This component doesn't render anything
} 