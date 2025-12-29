import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';

export async function generateMetadata({ searchParams }) {
  try {
    // Resolve searchParams if it's a promise (Next.js App Router)
    const resolvedSearchParams = await Promise.resolve(searchParams);
    
    console.log('🏆 generateMetadata called with searchParams:', resolvedSearchParams);
    
    const userFid = resolvedSearchParams?.user;
    const cacheBust = resolvedSearchParams?.t || Date.now();

    console.log('📋 Leaderboard params:', { userFid, cacheBust });

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');

    if (!userFid) {
      // Default metadata for general leaderboard
      return {
        title: 'MMM Leaderboard',
        description: 'Check out the top Minted Merch Mojo scores! Boost your MMM by staking, shopping, and staying active.',
        openGraph: {
          title: 'MMM Leaderboard 🏆',
          description: 'Check out the top Minted Merch Mojo scores! Boost your MMM by staking, shopping, and staying active.',
          images: [`${baseUrl}/api/og/leaderboard?t=${cacheBust}`],
        },
        other: {
          'fc:frame': JSON.stringify({
            version: "next",
            imageUrl: `${baseUrl}/api/og/leaderboard?t=${cacheBust}`,
            button: {
              title: `View MMM Leaderboard 🏆`,
              action: {
                type: "launch_frame",
                url: baseUrl,
                name: "Minted Merch Shop",
                splashImageUrl: `${baseUrl}/splash.png`,
                splashBackgroundColor: "#000000"
              }
            }
          }),
        },
      };
    }

    // Get user data for personalized metadata from profiles table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, pfp_url, mojo_score, staked_balance')
      .eq('fid', parseInt(userFid))
      .single();

    console.log('🔍 User data query result:', { userData, userError });

    if (userError || !userData) {
      console.error('❌ Error fetching user data:', userError);
      return {
        title: 'MMM Leaderboard',
        description: 'Check out the MMM leaderboard on Minted Merch!',
      };
    }

    const mojoScore = userData.mojo_score || 0;
    const stakedBalance = userData.staked_balance || 0;

    // Get user's position by counting users with higher mojo scores
    const { count, error: countError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gt('mojo_score', mojoScore);

    const position = countError ? 1 : (count || 0) + 1;

    console.log('🎯 Position calculation complete:', { userFid, position, mojoScore });
    
    const username = userData.display_name || userData.username || `User ${userFid}`;
    const pfpUrl = userData.pfp_url;

    // Build dynamic OG image URL
    const ogImageParams = new URLSearchParams({
      position: position.toString(),
      mojo: mojoScore.toString(),
      username: username,
      category: 'mojo',
      staked: stakedBalance.toString(),
      t: cacheBust.toString()
    });

    if (pfpUrl) {
      ogImageParams.append('pfp', pfpUrl);
    }

    const dynamicImageUrl = `${baseUrl}/api/og/leaderboard?${ogImageParams}`;
    
    console.log('🖼️ Dynamic OG image URL:', dynamicImageUrl);

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
    const formattedMojo = parseFloat(mojoScore).toFixed(2);

    // Create Mini App frame embed
    const frame = {
      version: "next",
      imageUrl: dynamicImageUrl,
      button: {
        title: `View MMM Leaderboard 🏆`,
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
      title: `${username} - #${positionText} on MMM Leaderboard`,
      description: `${username} is ranked #${positionText} with a Minted Merch Mojo score of ${formattedMojo}!`,
      metadataBase: new URL(baseUrl),
      other: {
        'fc:frame': JSON.stringify(frame),
      },
      openGraph: {
        title: `${username} - #${positionText} on MMM Leaderboard 🏆`,
        description: `${username} is ranked #${positionText} with a Minted Merch Mojo score of ${formattedMojo}!`,
        siteName: 'Minted Merch Shop',
        images: [
          {
            url: dynamicImageUrl,
            width: 1200,
            height: 630,
            alt: `${username} - #${positionText} on MMM Leaderboard`,
          },
        ],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${username} - #${positionText} on MMM Leaderboard 🏆`,
        description: `${username} is ranked #${positionText} with a Minted Merch Mojo score of ${formattedMojo}!`,
        images: [dynamicImageUrl],
      },
    };

  } catch (error) {
    console.error('❌ Error in generateMetadata:', error);
    return {
      title: 'MMM Leaderboard',
      description: 'Check out the MMM leaderboard on Minted Merch!',
    };
  }
}

function LeaderboardContent() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">MMM Leaderboard</h1>
          <p className="text-gray-600">
            Check out the top Minted Merch Mojo scores!
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Minted Merch Mojo Leaderboard
          </h2>
          <p className="text-gray-600 mb-4">
            Boost your MMM by staking, shopping, and staying active!
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
