import { getCollectionByHandle, getCollections } from '@/lib/shopify';
import { HomePage } from '@/components/HomePage';

export async function generateMetadata({ searchParams }) {
  // Fix URL construction to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
  
  // Check if this is a collection share URL
  const sharedCollectionHandle = searchParams?.collection;
  
  if (sharedCollectionHandle) {
    try {
      // Fetch collection data for metadata
      const collection = await getCollectionByHandle(sharedCollectionHandle);
      
      if (collection) {
        const title = collection.title || sharedCollectionHandle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const description = collection.description || `Shop the ${title} collection with USDC on Base blockchain. Crypto merch with instant payments.`;
        const imageUrl = collection.image?.url;
        const cacheBust = searchParams?.t;
        
        // Build OG image URL with collection data
        const ogParams = new URLSearchParams({
          handle: sharedCollectionHandle,
          title,
        });
        
        // Add collection image if available
        if (imageUrl) {
          ogParams.append('image', imageUrl);
        }
        
        // Add description if available
        if (collection.description) {
          ogParams.append('description', collection.description);
        }
        
        // Add cache-busting parameter (use existing or create new)
        ogParams.append('t', cacheBust || Date.now().toString());
        
        const dynamicImageUrl = `${baseUrl}/api/og/collection?${ogParams.toString()}`;
        
        // Create frame embed with dynamic collection image
        const frame = {
          version: "next",
          imageUrl: dynamicImageUrl,
          button: {
            title: `Shop ${title} 📦`,
            action: {
              type: "launch_frame",
              url: `${baseUrl}/?collection=${sharedCollectionHandle}`,
              name: "Minted Merch Shop",
              splashImageUrl: `${baseUrl}/splash.png`,
              splashBackgroundColor: "#000000"
            }
          }
        };

        return {
          title: `${title} Collection - Minted Merch Shop`,
          description,
          openGraph: {
            title: `${title} Collection - Minted Merch Shop`,
            description,
            images: [dynamicImageUrl],
          },
          other: {
            'fc:frame': JSON.stringify(frame),
          },
        };
      }
    } catch (error) {
      console.error('Error fetching collection for metadata:', error);
    }
  }
  
  // Check if this is a Daily Spin share URL
  const isDailySpinShare = searchParams?.showDailySpin === '1';
  
  if (isDailySpinShare) {
    const frame = {
      version: "next",
      imageUrl: `${baseUrl}/DailySpinEmbed.png`,
      button: {
        title: "Spin to Win!",
        action: {
          type: "launch_frame",
          url: `${baseUrl}/?showDailySpin=1`,
          name: "Minted Merch Daily Spin",
          splashImageUrl: `${baseUrl}/splash.png`,
          splashBackgroundColor: "#000000"
        }
      }
    };

    return {
      title: 'Daily Spin - Win Free Tokens on Minted Merch',
      description: 'Spin the wheel daily to win free tokens! Your Mojo Score determines how many spins you get.',
      metadataBase: new URL(baseUrl),
      other: {
        'fc:frame': JSON.stringify(frame),
      },
      openGraph: {
        title: 'Daily Spin - Win Free Tokens on Minted Merch',
        description: 'Spin the wheel daily to win free tokens! Your Mojo Score determines how many spins you get.',
        siteName: 'Minted Merch Shop',
        images: [
          {
            url: `${baseUrl}/DailySpinEmbed.png`,
            width: 1200,
            height: 800,
            alt: 'Minted Merch Daily Spin',
          },
        ],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Daily Spin - Win Free Tokens on Minted Merch',
        description: 'Spin the wheel daily to win free tokens! Your Mojo Score determines how many spins you get.',
        images: [`${baseUrl}/DailySpinEmbed.png`],
      },
    };
  }

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
    
    // Extract multiplier information from URL parameters
    const multiplier = parseFloat(searchParams.multiplier || '1');
    const tier = searchParams.tier || 'none';
    
    // Create dynamic OG image URL with check-in data
    const imageParams = new URLSearchParams({
      points: points.toString(),
      streak: streak.toString(),
      total: totalPoints.toString(),
      base: basePoints.toString(),
      bonus: streakBonus.toString(),
      multiplier: multiplier.toString(),
      tier: tier
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
      version: "next",
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

    return {
      title: `Daily Check-in Complete! +${points} Points Earned 🎯`,
      description: `💫 ${streak} day streak • 💎 ${totalPoints} total points • Keep your streak going on Minted Merch!`,
      metadataBase: new URL(baseUrl),
      other: {
        'fc:frame': JSON.stringify(frame),
      },
      openGraph: {
        title: `Daily Check-in Complete! +${points} Points Earned 🎯`,
        description: `💫 ${streak} day streak • 💎 ${totalPoints} total points • Keep your streak going on Minted Merch!`,
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
        title: `Daily Check-in Complete! +${points} Points Earned 🎯`,
        description: `💫 ${streak} day streak • 💎 ${totalPoints} total points • Keep your streak going on Minted Merch!`,
        images: [dynamicImageUrl],
      },
    };
  }
  
  // Default home page metadata
  const frame = {
    version: "next",
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

  return {
    title: 'Minted Merch Shop - Crypto Merch with USDC on Base',
    description: 'Shop exclusive crypto merch and pay with USDC on Base. Token-gated discounts for NFT holders.',
    metadataBase: new URL(baseUrl),
    other: {
      'fc:frame': JSON.stringify(frame),
    },
    openGraph: {
      title: 'Minted Merch Shop - Crypto Merch with USDC on Base',
      description: 'Shop exclusive crypto merch and pay with USDC on Base. Token-gated discounts for NFT holders.',
      siteName: 'Minted Merch Shop',
      images: [
        {
          url: `${baseUrl}/api/og/home`,
          width: 1200,
          height: 800,
          alt: 'Minted Merch Shop',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Minted Merch Shop - Crypto Merch with USDC on Base',
      description: 'Shop exclusive crypto merch and pay with USDC on Base. Token-gated discounts for NFT holders.',
      images: [`${baseUrl}/api/og/home`],
    },
  };
}

// Force dynamic rendering to prevent caching issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page({ searchParams }) {
  let collection;
  let products = [];
  
  try {
    let targetHandle;
    
    // Check if there's a collection parameter in the URL (for shared collection links)
    const sharedCollectionHandle = searchParams?.collection;
    
    if (sharedCollectionHandle) {
      // Use the shared collection from URL parameter
      targetHandle = sharedCollectionHandle;
      console.log('🔗 Using shared collection from URL:', targetHandle);
    } else if (process.env.TARGET_COLLECTION_HANDLE) {
      // Check if TARGET_COLLECTION_HANDLE env variable exists
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

    collection = await getCollectionByHandle(targetHandle);
    if (collection && collection.products) {
      products = collection.products.edges.map(edge => edge.node);
    }
  } catch (error) {
    console.error('Error fetching collection:', error);
  }

  return <HomePage collection={collection} products={products} />;
}