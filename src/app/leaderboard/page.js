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
          'fc:frame': 'vNext',
          'fc:frame:image': `${process.env.NEXT_PUBLIC_BASE_URL}/api/og/leaderboard?title=Leaderboard&category=${category}&t=${cacheBust}`,
          'fc:frame:button:1': `View ${category === 'points' ? 'Points' : category === 'holders' ? 'Holders' : category === 'purchases' ? 'Purchases' : 'Streaks'} Leaderboard 🏆`,
          'fc:frame:button:1:action': 'link',
          'fc:frame:button:1:target': `${process.env.NEXT_PUBLIC_BASE_URL}`,
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

    if (userError || !userData) {
      console.error('❌ Error fetching user data:', userError);
      return {
        title: 'Minted Merch Leaderboard',
        description: 'Check out the leaderboard on Minted Merch!',
      };
    }

    // Apply token multiplier to user's points
    const tokenBalance = userData.profiles?.token_balance || 0;
    const basePoints = userData.total_points || 0;
    const multiplierResult = applyTokenMultiplier(basePoints, tokenBalance);

    // Get user's position by counting users with higher multiplied points
    // This is a simplified approach - in production you might want to cache this
    const { count: higherRankedCount } = await supabaseAdmin
      .from('user_leaderboard')
      .select('user_fid', { count: 'exact' })
      .gt('total_points', basePoints); // Simplified - doesn't account for multipliers of others

    const position = (higherRankedCount || 0) + 1;
    
    const username = userData.profiles?.display_name || userData.profiles?.username || `User ${userFid}`;
    const pfpUrl = userData.profiles?.pfp_url;

    // Build dynamic OG image URL
    const ogImageParams = new URLSearchParams({
      position: position.toString(),
      points: multiplierResult.multipliedPoints.toString(),
      username: username,
      category: category,
      multiplier: multiplierResult.multiplier.toString(),
      tier: multiplierResult.tier,
      t: cacheBust.toString()
    });

    if (pfpUrl) {
      ogImageParams.append('pfp', pfpUrl);
    }

    const dynamicImageUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/og/leaderboard?${ogImageParams}`;
    
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

    return {
      title: `${username} - #${positionText} on Minted Merch Leaderboard`,
      description: `${username} is ranked #${positionText} in ${categoryName} with ${multiplierResult.multipliedPoints.toLocaleString()} points${multiplierText}!`,
      openGraph: {
        title: `${username} - #${positionText} on Minted Merch Leaderboard 🏆`,
        description: `${username} is ranked #${positionText} in ${categoryName} with ${multiplierResult.multipliedPoints.toLocaleString()} points${multiplierText}!`,
        images: [dynamicImageUrl],
      },
      other: {
        'fc:frame': 'vNext',
        'fc:frame:image': dynamicImageUrl,
        'fc:frame:button:1': `View Leaderboard 🏆`,
        'fc:frame:button:1:action': 'link',
        'fc:frame:button:1:target': `${process.env.NEXT_PUBLIC_BASE_URL}`,
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
