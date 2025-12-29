'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { shareLeaderboardPosition } from '@/lib/farcasterShare';

export function Leaderboard({ isVisible = true }) {
  const { isInFarcaster, isReady, getFid, user, getPfpUrl } = useFarcaster();
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState('mojo'); // MMM (Mojo) leaderboard only
  const [error, setError] = useState(null);

  // Get current user FID from either mini-app context or AuthKit
  const currentUserFid = user?.fid || (isReady ? getFid() : null);
  
  // Debug user connection
  console.log(`🚨 USER DEBUG: isInFarcaster=${isInFarcaster}, isReady=${isReady}, user=${!!user}, user.fid=${user?.fid}, currentUserFid=${currentUserFid}`);

  // Handle sharing leaderboard position
  const handleSharePosition = async () => {
    if (!currentUserFid) return;

    try {
      // Get user's MMM leaderboard position for sharing
      let mojoPosition, mojoScore, username;
      
      console.log('🔍 Share position debug - fetching MMM position for sharing');
      
      // Use current userPosition if available
      if (userPosition && userPosition.position) {
        mojoPosition = userPosition.position;
        mojoScore = userPosition.mojo_score || 0;
        username = userPosition.username || userProfiles[currentUserFid]?.username || `User ${currentUserFid}`;
        console.log('✅ Using current userPosition for sharing:', { mojoPosition, mojoScore, username });
      } else {
        // Try to find position in leaderboard data as fallback
        const userInLeaderboard = leaderboardData.find(user => user.user_fid === parseInt(currentUserFid));
        
        if (userInLeaderboard) {
          const userIndex = leaderboardData.findIndex(user => user.user_fid === parseInt(currentUserFid));
          mojoPosition = userIndex + 1;
          mojoScore = userInLeaderboard.mojo_score || 0;
          username = userProfiles[currentUserFid]?.username || userInLeaderboard.username || `User ${currentUserFid}`;
          console.log('✅ Using leaderboard data as fallback:', { mojoPosition, mojoScore, username });
        } else {
          // Final fallback when user not found anywhere
          mojoPosition = '?';
          mojoScore = 0;
          username = userProfiles[currentUserFid]?.username || `User ${currentUserFid}`;
          console.log('⚠️ Using final fallback - user not found in leaderboard');
        }
      }
      
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

      const positionText = getPositionSuffix(mojoPosition);
      
      // Get user profile data for share image
      const userProfile = userProfiles[currentUserFid];
      const tokenBalance = userPosition?.token_balance || 0;
      const stakedBalance = userPosition?.staked_balance || 0;
      // Use fresh Farcaster pfp if available, otherwise fall back to database
      const freshPfp = getPfpUrl() || userProfile?.pfp_url;
      
      // Use the new utility function to handle sharing (works in both mini-app and non-mini-app)
      await shareLeaderboardPosition({
        position: mojoPosition,
        mojoScore: mojoScore,
        category: 'mojo',
        username,
        pfp: freshPfp,
        tokenBalance,
        stakedBalance,
        fid: currentUserFid,
        isInFarcaster,
      });

    } catch (error) {
      console.error('Error sharing leaderboard position:', error);
      // Fallback to copying link
      try {
        const fallbackUrl = `${window.location.origin}/leaderboard?category=mojo&user=${currentUserFid}&t=${Date.now()}`;
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
      // Wait for Farcaster to be ready before loading leaderboard
      if (isReady) {
        console.log(`🚨 LEADERBOARD: Farcaster is ready, loading leaderboard. currentUserFid=${currentUserFid}`);
        loadLeaderboard();
      } else if (!isInFarcaster) {
        // Not in Farcaster, load leaderboard without user position
        console.log(`🚨 LEADERBOARD: Not in Farcaster, loading leaderboard without user position`);
        loadLeaderboard();
      } else {
        console.log(`🚨 LEADERBOARD: Farcaster not ready yet, waiting...`);
      }
    }
  }, [category, isVisible, isReady, currentUserFid]);

  const loadLeaderboard = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Build query parameters
      // IMPORTANT: Request more users than we display to account for token multipliers
      // Users with lower base points but high multipliers can rank higher after multiplier is applied
      // The API will fetch all users, apply multipliers, re-sort, and return top 100
      const params = new URLSearchParams({
        limit: '10000', // Fetch enough users to get accurate rankings after multipliers
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
      
      console.log(`🚨 LEADERBOARD: Making API call to ${apiEndpoint} with params:`, params.toString());
      const response = await fetch(`${apiEndpoint}?${params}`);
      const result = await response.json();
      console.log(`🚨 LEADERBOARD: API response:`, result);

      if (result.success) {
        let leaderboard, userPos;
        
        if (category === 'holders') {
          // Token holders API has different response format
          leaderboard = result.leaderboard || [];
          userPos = result.userPosition || null; // Now supports user position lookup
        } else {
          // Regular leaderboard API
          leaderboard = result.data.leaderboard || [];
          userPos = result.data.userPosition || null;
        }
        
        // Only display top 100 users in the UI (API fetched 10k for accurate ranking)
        const displayLeaderboard = leaderboard.slice(0, 100);
        
        console.log(`📊 Displaying ${displayLeaderboard.length} users from ${leaderboard.length} total fetched`);
        
        setLeaderboardData(displayLeaderboard);
        setUserPosition(userPos);

        // Fetch user profiles for the displayed leaderboard (top 100)
        const allFids = [...new Set([
          ...displayLeaderboard.map(user => category === 'holders' ? user.fid : user.user_fid),
          ...(userPos && userPos.position > 100 ? [userPos.user_fid] : [])
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

  const getUserAvatar = (leaderboardUser) => {
    // Get the correct FID field based on category
    const userFid = category === 'holders' ? leaderboardUser.fid : leaderboardUser.user_fid;
    const profile = userProfiles[userFid];
    
    // For current user, prefer fresh Farcaster SDK data over stale database data
    if (userFid === currentUserFid) {
      const freshPfp = getPfpUrl();
      if (freshPfp) return freshPfp;
    }
    
    // For other users (or fallback), use database data
    return profile?.avatar_url || leaderboardUser.pfp_url || null;
  };

  // Helper function to check staking tier for badges
  const getStakingTier = (user) => {
    // Get staked balance from different possible sources
    let stakedBalance = 0;
    
    if (user.staked_balance) {
      stakedBalance = parseFloat(user.staked_balance);
    } else if (user.profiles?.staked_balance) {
      stakedBalance = parseFloat(user.profiles.staked_balance);
    } else if (user.profile?.staked_balance) {
      stakedBalance = parseFloat(user.profile.staked_balance);
    }
    
    // Check tiers: whale (200M+), mogul (50M+), none
    if (stakedBalance >= 200000000) {
      return 'whale';
    } else if (stakedBalance >= 50000000) {
      return 'mogul';
    }
    return 'none';
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <img 
            src="/MintedMerchLeaderboardGraphic.png" 
            alt="Minted Merch Leaderboard" 
            className="h-16"
          />
          
          <div className="flex items-center gap-4">
            {/* Share Button - Always show for logged in users */}
            {currentUserFid && (
              <button
                onClick={handleSharePosition}
                className="flex items-center justify-center w-12 h-12 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white rounded-lg transition-colors"
                title="Share your leaderboard position"
              >
                {/* Official Farcaster Logo (2024 rebrand) */}
                <svg className="w-5 h-5" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
                </svg>
              </button>
            )}
            
            {/* Close button placeholder for spacing */}
            <div className="w-12 h-12"></div>
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
            {/* Current User Position (always show if available) */}
            {userPosition && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-700 rounded-full font-semibold text-sm">
                      #{userPosition.position}
                    </div>
                    
                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
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
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-medium">
                          You
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="text-xs font-medium text-green-800">You</div>
                      <div className="text-sm text-gray-500">
                        {/* Staking Badge */}
                        {getStakingTier(userPosition) === 'whale' && (
                          <div className="flex items-center mt-1">
                            <img 
                              src="/GoldVerifiedMerchMogulBadge.png" 
                              alt="Whale" 
                              className="h-5"
                              title="Whale - 200M+ $MINTEDMERCH staked"
                            />
                          </div>
                        )}
                        {getStakingTier(userPosition) === 'mogul' && (
                          <div className="flex items-center mt-1">
                            <img 
                              src="/VerifiedMerchMogulBadge.png" 
                              alt="Merch Mogul" 
                              className="h-5"
                              title="Merch Mogul - 50M+ $MINTEDMERCH staked"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">
                      {parseFloat(userPosition.mojo_score || 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">
                      <span>Mojo</span>
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
                        {/* Staking Badge */}
                        {getStakingTier(user) === 'whale' && (
                          <div className="flex items-center mt-1">
                            <img 
                              src="/GoldVerifiedMerchMogulBadge.png" 
                              alt="Whale" 
                              className="h-5"
                              title="Whale - 200M+ $MINTEDMERCH staked"
                            />
                          </div>
                        )}
                        {getStakingTier(user) === 'mogul' && (
                          <div className="flex items-center mt-1">
                            <img 
                              src="/VerifiedMerchMogulBadge.png" 
                              alt="Merch Mogul" 
                              className="h-5"
                              title="Merch Mogul - 50M+ $MINTEDMERCH staked"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Mojo Score Display */}
                  <div className="text-right">
                    <div className={`font-bold ${isCurrentUser ? 'text-green-600' : 'text-gray-800'}`}>
                      {parseFloat(user.mojo_score || 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">
                      <span>Mojo</span>
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
            Showing top {leaderboardData.length} users • Ranked by Minted Merch Mojo
          </div>
        )}
      </div>
    </div>
  );
} 