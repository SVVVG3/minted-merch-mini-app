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
      case 'holders': return 'Token Holders';
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
    // First try to get from Neynar profile data
    const profile = userProfiles[user.user_fid];
    if (profile) {
      return profile.display_name || profile.username || `User ${user.user_fid}`;
    }
    
    // Fallback to data from leaderboard API
    return user.display_name || user.username || `User ${user.user_fid}`;
  };

  const getUserAvatar = (user) => {
    const profile = userProfiles[user.user_fid];
    return profile?.avatar_url || null;
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">🏆 Leaderboard</h2>
        
        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto">
          {['points', 'streaks', 'purchases', 'holders'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                category === cat
                  ? 'bg-[#3eb489] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {formatCategory(cat)}
            </button>
          ))}
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
                      <div className="font-medium text-gray-800">You</div>
                      <div className="text-sm text-gray-500">
                        {category === 'purchases' ? (
                          <span>{userPosition.totalOrders || 0} orders</span>
                        ) : userPosition.checkin_streak > 0 ? (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"/>
                            </svg>
                            {userPosition.checkin_streak}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">
                      {category === 'points' && userPosition.total_points}
                      {category === 'streaks' && userPosition.checkin_streak}
                      {category === 'purchases' && userPosition.pointsFromPurchases}
                      {category === 'holders' && userPosition.token_balance_formatted}
                    </div>
                    <div className="text-sm text-gray-500">
                      {category === 'points' && 'points'}
                      {category === 'streaks' && (userPosition.checkin_streak === 1 ? 'day' : 'days')}
                      {category === 'purchases' && 'points'}
                      {category === 'holders' && '$MINTEDMERCH'}
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
                      <div className={`font-medium ${isCurrentUser ? 'text-green-800' : 'text-gray-800'}`}>
                        {isCurrentUser ? 'You' : getUserDisplayName(user)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {category === 'purchases' ? (
                          <span>{user.total_orders || 0} orders</span>
                        ) : user.checkin_streak > 0 ? (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"/>
                            </svg>
                            {user.checkin_streak} day streak
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  
                  {/* Category-specific Display */}
                  <div className="text-right">
                    <div className={`font-bold ${isCurrentUser ? 'text-green-600' : 'text-gray-800'}`}>
                      {category === 'points' && user.total_points.toLocaleString()}
                      {category === 'streaks' && user.checkin_streak}
                      {category === 'purchases' && (user.points_from_purchases || 0).toLocaleString()}
                      {category === 'holders' && user.token_balance_formatted}
                    </div>
                    <div className="text-sm text-gray-500">
                      {category === 'points' && 'points'}
                      {category === 'streaks' && (user.checkin_streak === 1 ? 'day' : 'days')}
                      {category === 'purchases' && 'points'}
                      {category === 'holders' && '$MINTEDMERCH'}
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