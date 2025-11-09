import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { applyTokenMultiplier } from '@/lib/points';

export async function generateMetadata({ searchParams }) {
  try {
    // Resolve searchParams if it's a promise (Next.js App Router)
    const resolvedSearchParams = await Promise.resolve(searchParams);
    
    console.log('🏆 generateMetadata called with searchParams:', resolvedSearchParams);
    
    const category = resolvedSearchParams?.category || 'points';
    const userFid = resolvedSearchParams?.user;
    const cacheBust = resolvedSearchParams?.t || Date.now();

    console.log('📋 Leaderboard params:', { category, userFid, cacheBust });

    if (!userFid) {
      // Default metadata for general leaderboard
      return {
        title: 'Minted Merch Leaderboard',
        description: 'Check out the top performers on Minted Merch! Shop & earn points with USDC on Base.',
        openGraph: {
          title: 'Minted Merch Leaderboard 🏆',
          description: 'Check out the top performers on Minted Merch! Shop & earn points with USDC on Base.',
          images: ['/api/og/leaderboard?title=Leaderboard&category=' + category + '&t=' + cacheBust],
        },
        other: {
          'fc:frame': JSON.stringify({
            version: "next",
            imageUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/og/leaderboard?title=Leaderboard&category=${category}&t=${cacheBust}`,
            button: {
              title: `View ${category === 'points' ? 'Points' : category === 'holders' ? 'Holders' : category === 'purchases' ? 'Purchases' : 'Streaks'} Leaderboard 🏆`,
              action: {
                type: "launch_frame",
                url: process.env.NEXT_PUBLIC_BASE_URL || 'https://app.mintedmerch.shop',
                name: "Minted Merch Shop",
                splashImageUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/splash.png`,
                splashBackgroundColor: "#000000"
              }
            }
          }),
        },
      };
    }

    // Get user data for personalized metadata
    const { data: userData, error: userError } = await supabaseAdmin
      .from('user_leaderboard')
      .select(`
        *,
        profiles!user_fid (
          username,
          display_name,
          pfp_url,
          token_balance
        )
      `)
      .eq('user_fid', parseInt(userFid))
      .single();

    console.log('🔍 User data query result:', { userData, userError });
    console.log('🔍 User FID being queried:', parseInt(userFid));

    if (userError || !userData) {
      console.error('❌ Error fetching user data:', userError);
      console.log('❌ No user data found for FID:', userFid);
      return {
        title: 'Minted Merch Leaderboard',
        description: 'Check out the leaderboard on Minted Merch!',
      };
    }

    // Apply token multiplier to user's points
    const tokenBalance = userData.profiles?.token_balance || 0;
    const basePoints = userData.total_points || 0;
    const multiplierResult = applyTokenMultiplier(basePoints, tokenBalance);

    // Get user's position by querying the database directly (no API call needed)
    // Fetch all users and calculate their multiplied points to determine accurate ranking
    const { data: allUsers, error: leaderboardError } = await supabaseAdmin
      .from('user_leaderboard')
      .select(`
        user_fid,
        total_points,
        profiles!user_fid (
          token_balance
        )
      `)
      .order('total_points', { ascending: false });

    console.log('🔍 Fetched leaderboard data for position calculation:', { 
      totalUsers: allUsers?.length, 
      error: leaderboardError 
    });

    // Calculate multiplied points for all users and sort
    let position = 1;
    if (allUsers && !leaderboardError) {
      const usersWithMultipliers = allUsers.map(user => {
        const userTokenBalance = user.profiles?.token_balance || 0;
        const userBasePoints = user.total_points || 0;
        const userMultiplierResult = applyTokenMultiplier(userBasePoints, userTokenBalance);
        return {
          user_fid: user.user_fid,
          multipliedPoints: userMultiplierResult.multipliedPoints
        };
      });

      // Sort by multiplied points (descending)
      usersWithMultipliers.sort((a, b) => b.multipliedPoints - a.multipliedPoints);

      // Find current user's position
      const userIndex = usersWithMultipliers.findIndex(user => user.user_fid === parseInt(userFid));
      position = userIndex >= 0 ? userIndex + 1 : 1;

      console.log('🎯 Position calculation complete:', { 
        userFid, 
        position, 
        totalUsers: usersWithMultipliers.length,
        userMultipliedPoints: multiplierResult.multipliedPoints
      });
    } else {
      console.error('❌ Failed to fetch leaderboard data for position calculation');
    }
    
    const username = userData.profiles?.display_name || userData.profiles?.username || `User ${userFid}`;
    const pfpUrl = userData.profiles?.pfp_url;

    console.log('🔍 Profile data extracted:', { username, pfpUrl, tokenBalance });
    console.log('🔍 Multiplier result:', multiplierResult);
    console.log('🔍 Position calculated:', position);

    // Build dynamic OG image URL
    const ogImageParams = new URLSearchParams({
      position: position.toString(),
      points: multiplierResult.multipliedPoints.toString(),
      username: username,
      category: category,
      multiplier: multiplierResult.multiplier.toString(),
      tier: multiplierResult.tier,
      tokenBalance: tokenBalance.toString(),
      t: cacheBust.toString()
    });

    if (pfpUrl) {
      ogImageParams.append('pfp', pfpUrl);
      console.log('✅ Added pfp URL to OG params:', pfpUrl);
    } else {
      console.log('⚠️ No pfp URL available for user');
    }

    console.log('🔍 Final OG image params:', ogImageParams.toString());

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
    const dynamicImageUrl = `${baseUrl}/api/og/leaderboard?${ogImageParams}`;
    
    console.log('🖼️ Dynamic OG image URL:', dynamicImageUrl);

    const categoryNames = {
      'points': 'Points',
      'streaks': 'Streaks', 
      'purchases': 'Purchases',
      'holders': '$MINTEDMERCH Holders'
    };
    const categoryName = categoryNames[category] || 'Points';

    const getPositionSuffix = (pos) => {
      const num = parseInt(pos);
      if (isNaN(num)) return pos;
      const lastDigit = num % 10;
      const lastTwoDigits = num % 100;
      
      if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return `${num}th`;
      if (lastDigit === 1) return `${num}st`;
      if (lastDigit === 2) return `${num}nd`;
      if (lastDigit === 3) return `${num}rd`;
      return `${num}th`;
    };

    const positionText = getPositionSuffix(position);
    const multiplierText = multiplierResult.multiplier > 1 ? ` (${multiplierResult.multiplier}x)` : '';

    // Create Mini App frame embed (same format as products/collections)
    const frame = {
      version: "next",
      imageUrl: dynamicImageUrl,
      button: {
        title: `View Leaderboard 🏆`,
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
      title: `${username} - #${positionText} on Minted Merch Leaderboard`,
      description: `${username} is ranked #${positionText} in ${categoryName} with ${multiplierResult.multipliedPoints.toLocaleString()} points${multiplierText}!`,
      metadataBase: new URL(baseUrl),
      other: {
        'fc:frame': JSON.stringify(frame),
      },
      openGraph: {
        title: `${username} - #${positionText} on Minted Merch Leaderboard 🏆`,
        description: `${username} is ranked #${positionText} in ${categoryName} with ${multiplierResult.multipliedPoints.toLocaleString()} points${multiplierText}!`,
        siteName: 'Minted Merch Shop',
        images: [
          {
            url: dynamicImageUrl,
            width: 1200,
            height: 800,
            alt: `${username} - #${positionText} on Minted Merch Leaderboard`,
          },
        ],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${username} - #${positionText} on Minted Merch Leaderboard 🏆`,
        description: `${username} is ranked #${positionText} in ${categoryName} with ${multiplierResult.multipliedPoints.toLocaleString()} points${multiplierText}!`,
        images: [dynamicImageUrl],
      },
    };

  } catch (error) {
    console.error('❌ Error in generateMetadata:', error);
    return {
      title: 'Minted Merch Leaderboard',
      description: 'Check out the leaderboard on Minted Merch!',
    };
  }
}

function LeaderboardContent() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🏆 Leaderboard</h1>
          <p className="text-gray-600">
            Check out the rankings and compete for the top spot!
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Minted Merch Leaderboard
          </h2>
          <p className="text-gray-600 mb-4">
            Compete with other users and climb the rankings!
          </p>
        </div>

        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#3eb489] hover:bg-[#359970] text-white font-medium rounded-lg transition-colors"
        >
          <span>View Full Leaderboard</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-2">🏆</div>
          <p className="text-gray-500">Loading leaderboard...</p>
        </div>
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
}
