import { Suspense } from 'react';
import MintPageClient from './MintPageClient';

/**
 * Mint Page - Server Component for NFT Campaign
 * Handles metadata, OG images, and Farcaster frame embeds
 */
export async function generateMetadata({ params }) {
  const { slug } = params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    // Fetch campaign data
    const campaignResponse = await fetch(`${baseUrl}/api/nft-mints/${slug}`, {
      cache: 'no-store' // Always get fresh campaign data
    });

    if (!campaignResponse.ok) {
      return {
        title: 'NFT Mint - Minted Merch',
        description: 'Mint exclusive NFTs and earn tokens'
      };
    }

    const { campaign } = await campaignResponse.json();

    // Ensure image URL is absolute
    const fullImageUrl = campaign.imageUrl?.startsWith('http') 
      ? campaign.imageUrl 
      : `${baseUrl}${campaign.imageUrl}`;

    // Build custom OG image URL with NFT artwork + text
    const ogImageParams = new URLSearchParams({
      slug: campaign.slug,
      image: fullImageUrl,
      text: campaign.metadata?.ogImageText || `Mint ${campaign.title}`
    });

    const dynamicImageUrl = `${baseUrl}/api/og/mint?${ogImageParams}`;

    // Create Farcaster frame embed
    // IMPORTANT: Button links to MAIN SHOP PAGE, not mint page (for exclusivity)
    const frame = {
      version: "next",
      imageUrl: dynamicImageUrl, // Custom NFT image with text overlay
      button: {
        title: campaign.metadata?.buttonText || "WEN MERCH?", // Custom button text
        action: {
          type: "launch_frame",
          url: baseUrl, // MAIN PAGE (not mint page!)
          name: "Minted Merch",
          splashImageUrl: `${baseUrl}/splash.png`,
          splashBackgroundColor: "#000000"
        }
      }
    };

    return {
      title: campaign.title,
      description: campaign.description || 'Mint this exclusive NFT and claim tokens!',
      openGraph: {
        title: campaign.title,
        description: campaign.description,
        images: [dynamicImageUrl],
        url: `${baseUrl}/mint/${slug}`
      },
      twitter: {
        card: 'summary_large_image',
        title: campaign.title,
        description: campaign.description,
        images: [dynamicImageUrl]
      },
      other: {
        'fc:frame': JSON.stringify(frame)
      }
    };
  } catch (error) {
    console.error('Error generating mint page metadata:', error);
    return {
      title: 'NFT Mint - Minted Merch',
      description: 'Mint exclusive NFTs and earn tokens'
    };
  }
}

export default function MintPage({ params }) {
  const { slug } = params;

  return (
    <div className="min-h-screen bg-black">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-white text-xl">Loading campaign...</div>
        </div>
      }>
        <MintPageClient slug={slug} />
      </Suspense>
    </div>
  );
}

