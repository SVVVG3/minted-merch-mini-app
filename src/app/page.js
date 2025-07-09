import { getCollectionByHandle, getCollections } from '@/lib/shopify';
import { HomePage } from '@/components/HomePage';

export async function generateMetadata({ searchParams }) {
  // Fix URL construction to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app').replace(/\/$/, '');
  
  // Check if this is a check-in share URL
  const isCheckinShare = searchParams?.checkin === 'true';
  
  if (isCheckinShare) {
    // Extract check-in data from URL parameters
    const points = parseInt(searchParams.points || '30');
    const streak = parseInt(searchParams.streak || '1');
    const totalPoints = parseInt(searchParams.total || '100');
    const basePoints = parseInt(searchParams.base || '30');
    const streakBonus = parseInt(searchParams.bonus || '0');
    const cacheBust = searchParams.t;
    
    console.log('=== Check-in Share Metadata Generation ===');
    console.log('Check-in data:', { points, streak, totalPoints, basePoints, streakBonus });
    
    // Create dynamic OG image URL with check-in data
    const imageParams = new URLSearchParams({
      points: points.toString(),
      streak: streak.toString(),
      total: totalPoints.toString(),
      base: basePoints.toString(),
      bonus: streakBonus.toString()
    });
    
    // Add cache-busting parameter if provided
    if (cacheBust) {
      imageParams.set('t', cacheBust);
    }
    
    const dynamicImageUrl = `${baseUrl}/api/og/checkin?${imageParams.toString()}`;
    console.log('📸 Dynamic check-in OG image URL:', dynamicImageUrl);
    
    // Get streak emoji for dynamic content
    const getStreakEmoji = (streak) => {
      if (streak >= 30) return "👑";
      if (streak >= 14) return "🔥";
      if (streak >= 7) return "⚡";
      if (streak >= 3) return "🌟";
      return "💫";
    };
    
    const streakEmoji = getStreakEmoji(streak);
    const title = `Daily Check-in Complete! +${points} Points Earned 🎯`;
    const description = `${streakEmoji} ${streak} day streak • 💎 ${totalPoints} total points${streakBonus > 0 ? ` (${basePoints} base + ${streakBonus} streak bonus)` : ''} • Keep your streak going on Minted Merch!`;
    
    // Create frame embed with dynamic check-in image
    const frame = {
      version: "1",
      imageUrl: dynamicImageUrl,
      button: {
        title: "Start Your Streak! 🎯",
        action: {
          type: "launch_frame",
          url: baseUrl,
          name: "Minted Merch Shop",
          splashImageUrl: `${baseUrl}/splash.png`,
          splashBackgroundColor: "#000000"
        }
      }
    };

    // Create miniapp embed (same structure but with launch_miniapp action type)
    const miniapp = {
      version: "1",
      imageUrl: dynamicImageUrl,
      button: {
        title: "Start Your Streak! 🎯",
        action: {
          type: "launch_miniapp",
          url: baseUrl,
          name: "Minted Merch Shop",
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
        'fc:miniapp': JSON.stringify(miniapp),
        'fc:frame': JSON.stringify(frame),
      },
      openGraph: {
        title,
        description,
        siteName: 'Minted Merch Shop',
        images: [
          {
            url: dynamicImageUrl,
            width: 1200,
            height: 800,
            alt: `Daily Check-in Complete! +${points} Points`,
          },
        ],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [dynamicImageUrl],
      },
    };
  }
  
  // Default home page metadata
  const frame = {
    version: "1",
    imageUrl: `${baseUrl}/api/og/home`,
    button: {
      title: "Shop Now 📦",
      action: {
        type: "launch_frame",
        url: baseUrl,
        name: "Minted Merch Shop",
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#000000"
      }
    }
  };

  // Create miniapp embed for default page
  const miniapp = {
    version: "1",
    imageUrl: `${baseUrl}/api/og/home`,
    button: {
      title: "Shop Now 📦",
      action: {
        type: "launch_miniapp",
        url: baseUrl,
        name: "Minted Merch Shop",
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#000000"
      }
    }
  };

  return {
    title: 'Minted Merch Shop - Crypto Merch with USDC on Base',
    description: 'Shop premium crypto merchandise and pay instantly with USDC on Base blockchain. Apparel, accessories, and more designed after your favorite coins and communities.',
    metadataBase: new URL(baseUrl),
    other: {
      'fc:miniapp': JSON.stringify(miniapp),
      'fc:frame': JSON.stringify(frame),
    },
    openGraph: {
      title: 'Minted Merch Shop - Crypto Merch with USDC on Base',
      description: 'Shop premium crypto merchandise and pay instantly with USDC on Base blockchain. Apparel, accessories, and more designed after your favorite coins and communities.',
      siteName: 'Minted Merch Shop',
      images: [
        {
          url: `${baseUrl}/api/og/home`,
          width: 1200,
          height: 800,
          alt: 'Minted Merch Shop - Crypto Merchandise',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Minted Merch Shop - Crypto Merch with USDC on Base',
      description: 'Shop premium crypto merchandise and pay instantly with USDC on Base blockchain. Apparel, accessories, and more designed after your favorite coins and communities.',
      images: [`${baseUrl}/api/og/home`],
    },
  };
}

// Force dynamic rendering to prevent caching issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
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

    const timestamp = Date.now();
    console.log(`[${timestamp}] Fetching collection:`, targetHandle);
    
    collection = await getCollectionByHandle(targetHandle);
    if (collection && collection.products) {
      products = collection.products.edges.map(edge => edge.node);
    }

    console.log(`[${timestamp}] Collection:`, collection?.title);
    console.log(`[${timestamp}] Products count:`, products.length);
    console.log(`[${timestamp}] Product titles:`, products.map(p => p.title));
    console.log(`[${timestamp}] Collection handle used:`, targetHandle);
  } catch (error) {
    console.error('Error fetching collection:', error);
  }

  return <HomePage collection={collection} products={products} />;
}