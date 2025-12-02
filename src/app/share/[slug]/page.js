import { redirect } from 'next/navigation';

// Mark route as dynamic
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Share Page - Redirects to mint page but provides custom frame metadata
 * This page is ONLY for Farcaster frame embeds when sharing
 * The frame button points to main page, but direct links go to mint page
 */
export async function generateMetadata({ params }) {
  const { slug } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://app.mintedmerch.shop';

  try {
    // Fetch campaign data
    const apiUrl = `${baseUrl}/api/nft-mints/${slug}`;
    const campaignResponse = await fetch(apiUrl, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json'
      }
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

    // Build custom OG image URL
    const ogImageParams = new URLSearchParams({
      slug: campaign.slug,
      image: fullImageUrl,
      text: campaign.metadata?.ogImageText || `Mint ${campaign.title}`
    });

    const dynamicImageUrl = `${baseUrl}/api/og/mint?${ogImageParams}`;

    // Create Farcaster frame embed - button links to campaign-specific page or main page
    // For staking-launch, link to stake page
    const buttonUrl = campaign.metadata?.buttonUrl 
      ? `${baseUrl}${campaign.metadata.buttonUrl}`
      : (slug === 'staking-launch' ? `${baseUrl}/stake` : baseUrl);
    
    const frame = {
      version: "next",
      imageUrl: dynamicImageUrl,
      button: {
        title: campaign.metadata?.buttonText || "WEN MERCH?",
        action: {
          type: "launch_frame",
          url: buttonUrl,
          name: "Minted Merch",
          splashImageUrl: `${baseUrl}/splash.png`,
          splashBackgroundColor: "#000000"
        }
      }
    };

    return {
      title: campaign.title,
      description: campaign.description || 'Mint this exclusive NFT and claim tokens!',
      metadataBase: new URL(baseUrl),
      other: {
        'fc:frame': JSON.stringify(frame)
      },
      openGraph: {
        title: campaign.title,
        description: campaign.description,
        siteName: 'Minted Merch',
        images: [
          {
            url: dynamicImageUrl,
            width: 1200,
            height: 800,
            alt: campaign.title
          }
        ],
        url: `${baseUrl}/mint/${slug}`, // OG url points to mint page
        type: 'website'
      },
      twitter: {
        card: 'summary_large_image',
        title: campaign.title,
        description: campaign.description,
        images: [dynamicImageUrl]
      }
    };
  } catch (error) {
    console.error('Error generating share page metadata:', error);
    return {
      title: 'NFT Mint - Minted Merch',
      description: 'Mint exclusive NFTs and earn tokens'
    };
  }
}

// Redirect to actual mint page
export default function SharePage({ params }) {
  const { slug } = params;
  redirect(`/mint/${slug}`);
}

