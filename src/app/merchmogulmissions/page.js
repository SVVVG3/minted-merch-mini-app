import { Suspense } from 'react';
import MerchMogulMissionsClient from './MerchMogulMissionsClient';

export async function generateMetadata() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
  
  const title = '💎 Merch Mogul Missions - Minted Merch';
  const description = 'Complete interaction bounties to earn $mintedmerch tokens! Exclusive missions for Merch Moguls holding 50M+ tokens.';
  
  // Use dynamic OG image API for properly sized embed
  const imageUrl = `${baseUrl}/api/og/mogul-missions`;
  
  // Create frame embed for Farcaster
  const frame = {
    version: "next",
    imageUrl: imageUrl,
    button: {
      title: "View Missions 🤌",
      action: {
        type: "launch_frame",
        url: `${baseUrl}/merchmogulmissions`,
        name: "Merch Mogul Missions",
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
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: 'Merch Mogul Missions Dashboard',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function MerchMogulMissionsPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f9fafb', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #3eb489',
          borderTop: '3px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#6b7280' }}>Loading Merch Mogul Missions...</p>
      </div>
    }>
      <MerchMogulMissionsClient />
    </Suspense>
  );
}

