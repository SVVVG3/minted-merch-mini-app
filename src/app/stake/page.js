import { Suspense } from 'react';
import { StakePageClient } from './StakePageClient';

export async function generateMetadata() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
  
  const title = 'Stake to Earn $mintedmerch - Minted Merch';
  const description = 'Where Staking Meets Merch! Stake 50M+ $mintedmerch to unlock exclusive collab partnerships, custom orders, group chat access, and 15% off store wide.';
  
  const ogImageUrl = `${baseUrl}/api/og/stake`;
  
  // Create frame embed for Farcaster
  const frame = {
    version: "next",
    imageUrl: ogImageUrl,
    button: {
      title: "Stake $mintedmerch",
      action: {
        type: "launch_frame",
        url: `${baseUrl}/stake`,
        name: "Minted Merch Staking",
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#000000"
      }
    }
  };

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    other: {
      'fc:frame': JSON.stringify(frame),
    },
    openGraph: {
      title,
      description,
      siteName: 'Minted Merch',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 800,
          alt: 'Stake to Earn $mintedmerch',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function StakePage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#000', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#3eb489'
      }}>
        Loading staking page...
      </div>
    }>
      <StakePageClient />
    </Suspense>
  );
}

