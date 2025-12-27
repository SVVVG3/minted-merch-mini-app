import DailySpinClient from './DailySpinClient';

export async function generateMetadata() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
  
  const title = 'Daily Token Spin | Minted Merch';
  const description = 'Spin to win partner tokens daily! Your Mojo Score determines how many spins you get.';
  
  // Use the home OG image for now, or create a dedicated dailyspin OG image later
  const imageUrl = `${baseUrl}/og-image.png`;
  
  // Create frame embed for Farcaster
  const frame = {
    version: "next",
    imageUrl: imageUrl,
    button: {
      title: "Spin to Win! 🎰",
      action: {
        type: "launch_frame",
        url: `${baseUrl}/dailyspin`,
        name: "Daily Token Spin",
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
          alt: 'Daily Token Spin - Minted Merch',
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

export const dynamic = 'force-dynamic';

export default function DailySpinPage() {
  return <DailySpinClient />;
}
