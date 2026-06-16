import { Suspense } from 'react';
import { CreatePageClient } from './CreatePageClient';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');

// searchParams is passed so the fc:frame launch URL can carry castImageUrl through
// the Farcaster client's frame-open step (otherwise the query param would be lost).
export async function generateMetadata({ searchParams }) {
  const castImageUrl = searchParams?.castImageUrl;
  const launchUrl = castImageUrl
    ? `${BASE_URL}/create?castImageUrl=${encodeURIComponent(castImageUrl)}`
    : `${BASE_URL}/create`;

  return {
    title: 'Design Studio — Minted Merch',
    description: 'Apply your design to a tee, hoodie, or hat and share it on Farcaster.',
    openGraph: {
      title: 'Design Studio — Minted Merch',
      description: 'Apply your design to a tee, hoodie, or hat and share it on Farcaster.',
      images: [`${BASE_URL}/MintedMerchCreateEmbed.png`],
    },
    other: {
      'fc:frame': JSON.stringify({
        version: 'next',
        imageUrl: `${BASE_URL}/MintedMerchCreateEmbed.png`,
        button: {
          title: '🎨 Design Studio',
          action: {
            type: 'launch_frame',
            url: launchUrl,
            name: 'Minted Merch',
            splashImageUrl: `${BASE_URL}/splash.png`,
            splashBackgroundColor: '#000000',
          },
        },
      }),
    },
  };
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489]" />
        </div>
      }
    >
      <CreatePageClient />
    </Suspense>
  );
}
