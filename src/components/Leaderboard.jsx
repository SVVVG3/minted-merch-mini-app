'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';

export function Leaderboard({ isVisible = true }) {
  const { isInFarcaster, isReady, getFid } = useFarcaster();
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState('points');
  const [error, setError] = useState(null);

  const currentUserFid = isInFarcaster && isReady ? getFid() : null;

  // Handle sharing leaderboard position
  const handleSharePosition = async () => {
    if (!currentUserFid) return;

    try {
      // Get user profile data
      const userProfile = userProfiles[currentUserFid] || {};
      
      // Use userPosition if available, otherwise create fallback data
      let position, points, multiplier, tier, username;
      
      console.log('🔍 Share position debug:', { userPosition, currentUserFid, leaderboardData });
      
      if (userPosition && userPosition.position) {
        position = userPosition.position;
        points = userPosition.totalPoints || 0;
        multiplier = userPosition.tokenMultiplier || 1;
        tier = userPosition.tokenTier || 'none';
        username = userPosition.username || userProfile.username || `User ${currentUserFid}`;
        console.log('✅ Using userPosition data:', { position, points, multiplier, tier, username });
      } else {
        // Try to find position in leaderboard data as fallback
        const userInLeaderboard = leaderboardData.find(user => 
          (category === 'holders' ? user.fid : user.user_fid) === parseInt(currentUserFid)
        );
        
        if (userInLeaderboard) {
          const userIndex = leaderboardData.findIndex(user => 
            (category === 'holders' ? user.fid : user.user_fid) === parseInt(currentUserFid)
          );
          position = userIndex + 1;
          points = userInLeaderboard.total_points || 0;
          multiplier = userInLeaderboard.token_multiplier || 1;
          tier = userInLeaderboard.token_tier || 'none';
          username = userProfile.username || userInLeaderboard.username || `User ${currentUserFid}`;
          console.log('✅ Using leaderboard data as fallback:', { position, points, multiplier, tier, username });
        } else {
          // Final fallback when user not found anywhere
          position = '?';
          points = 0;
          multiplier = 1;
          tier = 'none';
          username = userProfile.username || `User ${currentUserFid}`;
          console.log('⚠️ Using final fallback - user not found in leaderboard');
        }
      }

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
      const multiplierText = multiplier > 1 ? ` (${multiplier}x ${tier === 'legendary' ? '🏆' : '⭐'})` : '';
      
      // Create leaderboard URL with cache-busting parameter for fresh OG images (EXACT same pattern as collections)
      const leaderboardUrl = `${window.location.origin}/leaderboard?category=${category}&user=${currentUserFid}&t=${Date.now()}`;
      const shareText = userPosition 
        ? `I'm currently ranked ${positionText} place on the @mintedmerch mini app leaderboard!\n\nSpin the wheel daily (for free) & shop using USDC to earn more points on /mintedmerch. The more $mintedmerch you hold, the higher your multiplier!`
        : `I'm currently ranked ${positionText} place on the @mintedmerch mini app leaderboard!\n\nSpin the wheel daily (for free) & shop using USDC to earn more points on /mintedmerch. The more $mintedmerch you hold, the higher your multiplier!`;
      
      console.log('🔗 Sharing leaderboard URL:', leaderboardUrl);
      console.log('📝 Share text:', shareText);

      if (!isInFarcaster) {
        // Fallback for non-Farcaster environments
        if (navigator.share) {
          try {
            await navigator.share({
              title: `My Leaderboard Position - Minted Merch`,
              text: shareText,
              url: leaderboardUrl,
            });
          } catch (err) {
            console.log('Error sharing:', err);
          }
        } else {
          // Copy link to clipboard
          try {
            await navigator.clipboard.writeText(`${shareText}\n\n${leaderboardUrl}`);
            alert('Share text copied to clipboard!');
          } catch (err) {
            console.log('Error copying to clipboard:', err);
          }
        }
        return;
      }

      // Use the Farcaster SDK composeCast action with leaderboard URL (EXACT same as collections)
      const { sdk } = await import('../lib/frame');
      const result = await sdk.actions.composeCast({
        text: shareText,
        embeds: [leaderboardUrl],
      });
      
      console.log('Leaderboard cast composed:', result);

    } catch (error) {
      console.error('Error sharing leaderboard position:', error);
      // Fallback to copying link
      try {
        const fallbackUrl = `${window.location.origin}/leaderboard?category=${category}&user=${currentUserFid}&t=${Date.now()}`;
        await navigator.clipboard.writeText(fallbackUrl);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.log('Error copying to clipboard:', err);
      }
    }
  };

  // Load leaderboard data
  useEffect(() => {
    if (isVisible) {
      loadLeaderboard();
    }
  }, [category, isVisible]);

  const loadLeaderboard = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Build query parameters
      const params = new URLSearchParams({
        limit: '50', // Show top 50 users
        category: category
      });

      // Add current user FID if available for position lookup
      if (currentUserFid) {
        params.append('userFid', currentUserFid);
      }

      // Use different API endpoint for token holders
      const apiEndpoint = category === 'holders' 
        ? '/api/token-holders-leaderboard' 
        : '/api/points/leaderboard';
      
      const response = await fetch(`${apiEndpoint}?${params}`);
      const result = await response.json();

      if (result.success) {
        let leaderboard, userPos;
        
        if (category === 'holders') {
          // Token holders API has different response format
          leaderboard = result.leaderboard || [];
          userPos = null; // Token holders doesn't have user position lookup yet
        } else {
          // Regular leaderboard API
          leaderboard = result.data.leaderboard || [];
          userPos = result.data.userPosition || null;
        }
        
        setLeaderboardData(leaderboard);
        setUserPosition(userPos);

        // Fetch user profiles for the leaderboard
        const allFids = [...new Set([
          ...leaderboard.map(user => category === 'holders' ? user.fid : user.user_fid),
          ...(userPos && userPos.position > 50 ? [userPos.user_fid] : [])
        ])];

        if (allFids.length > 0) {
          try {
            const profilesResponse = await fetch('/api/user-profiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fids: allFids })
            });
            
            const profilesResult = await profilesResponse.json();
            
            if (profilesResult.success) {
              setUserProfiles(profilesResult.users || {});
            } else {
              console.log('Could not fetch user profiles:', profilesResult.error);
            }
          } catch (profileError) {
            console.error('Error fetching user profiles:', profileError);
          }
        }
      } else {
        setError(result.error || 'Failed to load leaderboard');
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setError('Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCategory = (cat) => {
    switch (cat) {
      case 'points': return 'Points';
      case 'streaks': return 'Streaks';
      case 'purchases': return 'Purchases';
      case 'holders': return '$mintedmerch Holders';
      default: return 'Points';
    }
  };

  const getRankBadge = (position) => {
    if (position === 1) {
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-yellow-400 text-yellow-900 rounded-full font-bold text-sm">
          👑
        </div>
      );
    } else if (position === 2) {
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-gray-300 text-gray-700 rounded-full font-bold text-sm">
          🥈
        </div>
      );
    } else if (position === 3) {
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-orange-400 text-orange-900 rounded-full font-bold text-sm">
          🥉
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-600 rounded-full font-semibold text-sm">
          #{position}
        </div>
      );
    }
  };

  const getUserDisplayName = (user) => {
    // Get the correct FID field based on category
    const userFid = category === 'holders' ? user.fid : user.user_fid;
    
    // First try to get from Neynar profile data
    const profile = userProfiles[userFid];
    if (profile) {
      return profile.username || profile.display_name || `User ${userFid}`;
    }
    
    // Fallback to data from leaderboard API
    return user.username || user.display_name || `User ${userFid}`;
  };

  const getUserAvatar = (user) => {
    // Get the correct FID field based on category
    const userFid = category === 'holders' ? user.fid : user.user_fid;
    const profile = userProfiles[userFid];
    
    // Try profile avatar first, then fallback to pfp_url from token holders API
    return profile?.avatar_url || user.pfp_url || null;
  };

  // Helper function to check if user has 50M+ tokens (Merch Mogul status)
  const isMerchMogul = (user) => {
    // Get token balance from different possible sources
    let tokenBalanceWei = 0;
    
    if (user.token_balance) {
      tokenBalanceWei = parseFloat(user.token_balance);
    } else if (user.profiles?.token_balance) {
      tokenBalanceWei = parseFloat(user.profiles.token_balance);
    } else if (user.profile?.token_balance) {
      tokenBalanceWei = parseFloat(user.profile.token_balance);
    }
    
    // Convert from wei to tokens (divide by 10^18)
    const tokenBalance = tokenBalanceWei / 1000000000000000000;
    
    // Check if balance is 50M or more tokens (50,000,000)
    return tokenBalance >= 50000000;
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">🏆 Leaderboard</h2>
          
          <div className="flex items-center gap-4">
            {/* Share Button - Always show for logged in users */}
            {currentUserFid && (
              <button
                onClick={handleSharePosition}
                className="flex items-center justify-center w-12 h-12 bg-[#8A63D2] hover:bg-[#7C5BC7] text-white rounded-lg transition-colors"
                title="Share your leaderboard position"
              >
                {/* Official Farcaster Logo */}
                <svg className="w-5 h-5" viewBox="0 0 1000 1000" fill="currentColor">
                  <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
                  <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.445H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"/>
                  <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.445H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"/>
                </svg>
              </button>
            )}
            
            {/* Close button placeholder for spacing */}
            <div className="w-12 h-12"></div>
          </div>
        </div>
        
        {/* Category Dropdown */}
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3eb489] focus:border-transparent appearance-none cursor-pointer"
          >
            <option value="points">Points</option>
            <option value="holders">$mintedmerch Holders</option>
            <option value="purchases">Purchases</option>
            <option value="streaks">Streaks</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-500">Loading rankings...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-500 mb-2">⚠️ {error}</div>
            <button
              onClick={loadLeaderboard}
              className="px-4 py-2 bg-[#3eb489] hover:bg-[#359970] text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : leaderboardData.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-2">🎯 No rankings yet</div>
            <p className="text-sm text-gray-400">Be the first to check in and earn points!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Current User Position (if not in top list) */}
            {userPosition && userPosition.position > 50 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="text-sm text-green-600 font-medium mb-2">Your Position</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-700 rounded-full font-semibold text-sm">
                      #{userPosition.position}
                    </div>
                    
                    {/* User Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {getUserAvatar(userPosition) ? (
                        <img 
                          src={getUserAvatar(userPosition)} 
                          alt="Your avatar"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium">
                          You
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="text-xs font-medium text-gray-800">You</div>
                      <div className="text-sm text-gray-500">
                        {category === 'purchases' ? (
                          <span>{userPosition.totalOrders || 0} orders</span>
                        ) : (userPosition.checkin_streak || 0) > 0 ? (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"/>
                            </svg>
                            {userPosition.checkin_streak}
                          </span>
                        ) : null}
                        
                        {/* Merch Mogul Badge for current user if they have 50M+ tokens */}
                        {isMerchMogul(userPosition) && (
                          <div className="flex items-center mt-1">
                            <img 
                              src="/MerchMogulBadge.png" 
                              alt="Merch Mogul" 
                              className="w-16 h-4"
                              title="Merch Mogul - 50M+ $MINTEDMERCH holder"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">
                      {category === 'points' && (userPosition.total_points || 0).toLocaleString()}
                      {category === 'streaks' && (userPosition.checkin_streak || 0)}
                      {category === 'purchases' && (userPosition.pointsFromPurchases || 0).toLocaleString()}
                      {category === 'holders' && userPosition.token_balance_formatted}
                    </div>
                    <div className="text-sm text-gray-500">
                      {category === 'points' && (
                        <div className="flex flex-col items-end">
                          <span>points</span>
                          {userPosition.tokenMultiplier && userPosition.tokenMultiplier > 1 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              userPosition.tokenMultiplier === 5 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {userPosition.tokenMultiplier}x {userPosition.tokenTier === 'legendary' ? '🏆' : '⭐'}
                            </span>
                          )}
                        </div>
                      )}
                      {category === 'streaks' && ((userPosition.checkin_streak || 0) === 1 ? 'day' : 'days')}
                      {category === 'purchases' && 'points'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Rankings */}
            {leaderboardData.map((user, index) => {
              const position = index + 1;
              const userFid = category === 'holders' ? user.fid : user.user_fid;
              const isCurrentUser = currentUserFid && userFid === currentUserFid;
              
              return (
                <div
                  key={userFid}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    isCurrentUser 
                      ? 'bg-green-50 border-green-200 ring-2 ring-green-100' 
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank Badge */}
                    {getRankBadge(position)}
                    
                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {getUserAvatar(user) ? (
                        <img 
                          src={getUserAvatar(user)} 
                          alt={getUserDisplayName(user)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-medium">
                          {getUserDisplayName(user).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    {/* User Info */}
                    <div>
                      <div className={`text-xs font-medium ${isCurrentUser ? 'text-green-800' : 'text-gray-800'}`}>
                        {isCurrentUser ? 'You' : getUserDisplayName(user)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {category === 'purchases' ? (
                          <span>{user.total_orders || 0} orders</span>
                        ) : (user.checkin_streak || 0) > 0 ? (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"/>
                            </svg>
                            {user.checkin_streak} day streak
                          </span>
                        ) : null}
                        
                        {/* Merch Mogul Badge for users with 50M+ tokens */}
                        {isMerchMogul(user) && (
                          <div className="flex items-center mt-1">
                            <img 
                              src="/MerchMogulBadge.png" 
                              alt="Merch Mogul" 
                              className="w-16 h-4"
                              title="Merch Mogul - 50M+ $MINTEDMERCH holder"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Category-specific Display */}
                  <div className="text-right">
                    <div className={`font-bold ${isCurrentUser ? 'text-green-600' : 'text-gray-800'}`}>
                      {category === 'points' && (user.total_points || 0).toLocaleString()}
                      {category === 'streaks' && (user.checkin_streak || 0)}
                      {category === 'purchases' && (user.points_from_purchases || 0).toLocaleString()}
                      {category === 'holders' && user.token_balance_formatted}
                    </div>
                    <div className="text-sm text-gray-500">
                      {category === 'points' && (
                        <div className="flex flex-col items-end">
                          <span>points</span>
                          {user.token_multiplier && user.token_multiplier > 1 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              user.token_multiplier === 5 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {user.token_multiplier}x {user.token_tier === 'legendary' ? '🏆' : '⭐'}
                            </span>
                          )}
                        </div>
                      )}
                      {category === 'streaks' && ((user.checkin_streak || 0) === 1 ? 'day' : 'days')}
                      {category === 'purchases' && 'points'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Info */}
        {leaderboardData.length > 0 && (
          <div className="text-center mt-6 text-sm text-gray-500">
            Showing top {leaderboardData.length} players • Ranked by {formatCategory(category)}
          </div>
        )}
      </div>
    </div>
  );
} 