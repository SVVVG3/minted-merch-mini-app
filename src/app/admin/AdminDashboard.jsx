'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Dashboard data state
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [ordersData, setOrdersData] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Raffle state
  const [raffleFilters, setRaffleFilters] = useState({
    minPoints: 0,
    minStreak: 0,
    minPurchasePoints: 0,
    excludePreviousWinners: true
  });
  const [raffleResults, setRaffleResults] = useState(null);
  const [winnerProfiles, setWinnerProfiles] = useState({});

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const result = await response.json();
      
      if (result.success) {
        setIsAuthenticated(true);
        loadDashboardData();
      } else {
        setError('Invalid password');
      }
    } catch (error) {
      setError('Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      // Load leaderboard data
      const leaderboardResponse = await fetch('/api/admin/leaderboard');
      const leaderboardResult = await leaderboardResponse.json();
      
      if (leaderboardResult.success) {
        setLeaderboardData(leaderboardResult.data);
      }

      // Load dashboard stats
      const statsResponse = await fetch('/api/admin/stats');
      const statsResult = await statsResponse.json();
      
      if (statsResult.success) {
        setDashboardStats(statsResult.data);
      }

      // Load orders data
      const ordersResponse = await fetch('/api/admin/orders');
      const ordersResult = await ordersResponse.json();
      
      if (ordersResult.success) {
        setOrdersData(ordersResult.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const runRaffle = async (numWinners = 1) => {
    try {
      const response = await fetch('/api/admin/raffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numWinners,
          filters: raffleFilters
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setRaffleResults(result.data);
        
        // Fetch user profiles for winners
        const fids = result.data.winners.map(w => w.user_fid);
        const profilesResponse = await fetch('/api/user-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fids })
        });
        
        if (profilesResponse.ok) {
          const profilesResult = await profilesResponse.json();
          if (profilesResult.success) {
            const profilesMap = {};
            profilesResult.data.forEach(profile => {
              profilesMap[profile.fid] = profile;
            });
            setWinnerProfiles(profilesMap);
          }
        }
      } else {
        setError(result.error || 'Raffle failed');
      }
    } catch (error) {
      setError('Raffle execution failed');
    }
  };

  const exportData = (data, filename) => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  // Helper functions for winner display
  const getWinnerDisplayName = (winner) => {
    const profile = winnerProfiles[winner.user_fid];
    return profile?.display_name || profile?.username || winner.username || `FID ${winner.user_fid}`;
  };

  const getWinnerAvatar = (winner) => {
    const profile = winnerProfiles[winner.user_fid];
    if (profile?.avatar_url) {
      return profile.avatar_url;
    }
    // Generate a gradient based on user_fid for consistent fallback
    const hue = (winner.user_fid * 137.508) % 360;
    return `linear-gradient(45deg, hsl(${hue}, 70%, 60%), hsl(${(hue + 60) % 360}, 70%, 70%))`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount) || 0); // Amounts are already in dollars
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-6">
            <img 
              src="/MintedMerchSpinnerLogo.png" 
              alt="Minted Merch"
              className="h-12 w-auto mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-800">
              Admin Dashboard
            </h1>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                placeholder="Enter admin password"
                required
              />
            </div>
            
            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#3eb489] hover:bg-[#359970] text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img 
                src="/MintedMerchSpinnerLogo.png" 
                alt="Minted Merch"
                className="h-8 w-auto"
              />
              <h1 className="text-xl font-semibold text-gray-800">
                Mini App Dashboard
              </h1>
            </div>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'dashboard', label: '📊 Dashboard' },
                { key: 'leaderboard', label: '🏆 Leaderboard' },
                { key: 'orders', label: '🛍️ Orders' },
                { key: 'raffle', label: '🎲 Raffle Tool' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-[#3eb489] text-[#3eb489]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {dashboardStats && [
                { label: 'Total Users', value: dashboardStats.totalUsers, icon: '👥' },
                { label: 'Active Streaks', value: dashboardStats.activeStreaks, icon: '🔥' },
                { label: 'Total Points Awarded', value: dashboardStats.totalPoints?.toLocaleString(), icon: '⭐' },
                { label: 'Total Orders', value: dashboardStats.totalOrders, icon: '🛍️' }
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">{stat.icon}</div>
                    <div>
                      <div className="text-2xl font-bold text-gray-800">{stat.value}</div>
                      <div className="text-sm text-gray-600">{stat.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">User Leaderboard</h2>
              <button
                onClick={() => exportData(leaderboardData, 'leaderboard.csv')}
                className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
              >
                📥 Export CSV
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Points</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Streak</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Points</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leaderboardData.map((user, index) => (
                    <tr key={user.user_fid} className={index < 3 ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                        {index === 0 && ' 🥇'}
                        {index === 1 && ' 🥈'}
                        {index === 2 && ' 🥉'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.user_fid}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.username || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.total_points?.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.checkin_streak}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.points_from_purchases || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.total_orders || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">All Orders</h2>
              <button
                onClick={() => exportData(ordersData, `orders_${new Date().toISOString().split('T')[0]}.csv`)}
                className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
              >
                📥 Export CSV
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ordersData.map((order) => (
                    <tr key={order.order_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.order_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.fid}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{order.customer_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{order.customer_email || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'paid' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.item_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(order.amount_total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.discount_applied ? (
                          <div>
                            <div className="font-medium">{order.discount_code}</div>
                            <div className="text-xs text-gray-500">{formatCurrency(order.discount_amount)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Raffle Tab */}
        {activeTab === 'raffle' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Raffle Controls */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">🎲 Raffle Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ⭐ Minimum Points
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 100 (0 = no minimum)"
                    value={raffleFilters.minPoints}
                    onChange={(e) => setRaffleFilters(prev => ({ ...prev, minPoints: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Filter users by total points earned</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🔥 Minimum Streak Days
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 7 (0 = no minimum)"
                    value={raffleFilters.minStreak}
                    onChange={(e) => setRaffleFilters(prev => ({ ...prev, minStreak: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Filter users by consecutive check-in days</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🛍️ Minimum Purchase Points
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 50 (0 = no minimum)"
                    value={raffleFilters.minPurchasePoints}
                    onChange={(e) => setRaffleFilters(prev => ({ ...prev, minPurchasePoints: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Filter users by points from purchases</p>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="excludePrevious"
                    checked={raffleFilters.excludePreviousWinners}
                    onChange={(e) => setRaffleFilters(prev => ({ ...prev, excludePreviousWinners: e.target.checked }))}
                    className="mr-2 h-4 w-4 text-[#3eb489] focus:ring-[#3eb489]"
                  />
                  <label htmlFor="excludePrevious" className="text-sm text-gray-700">
                    🚫 Exclude previous winners <span className="text-gray-400">(coming soon)</span>
                  </label>
                </div>
              </div>
              
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => runRaffle(1)}
                  className="w-full bg-gradient-to-r from-[#3eb489] to-[#45c497] hover:from-[#359970] hover:to-[#3eb489] text-white py-3 px-4 rounded-md transition-all transform hover:scale-105 shadow-lg"
                >
                  🎲 Run Single Winner Raffle
                </button>
                <button
                  onClick={() => runRaffle(3)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-md transition-all transform hover:scale-105 shadow-lg"
                >
                  🎲 Run Three Winner Raffle
                </button>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-xs text-blue-700">
                  💡 <strong>Pro Tip:</strong> Perfect layout for screenshots! Results show user avatars and branding for professional announcements.
                </p>
              </div>
            </div>

            {/* Raffle Results */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {raffleResults ? (
                <div>
                  {/* Professional Header with Branding */}
                  <div className="bg-gradient-to-r from-[#3eb489] to-[#45c497] p-6 text-white">
                    <div className="flex items-center justify-center space-x-3 mb-2">
                      <img 
                        src="/MintedMerchSpinnerLogo.png" 
                        alt="Minted Merch"
                        className="h-8 w-auto"
                      />
                      <h2 className="text-xl font-bold">Raffle Winners!</h2>
                    </div>
                    <div className="text-center text-sm opacity-90">
                      Selected from {raffleResults.eligibleCount} eligible community members
                    </div>
                  </div>
                  
                  {/* Winners Display */}
                  <div className="p-6 space-y-4">
                    {raffleResults.winners.map((winner, index) => {
                      const avatar = getWinnerAvatar(winner);
                      const isGradient = avatar.startsWith('linear-gradient');
                      
                      return (
                        <div key={winner.user_fid} className="relative p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-lg shadow-md">
                          {/* Position Badge */}
                          <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-sm font-bold rounded-full flex items-center justify-center shadow-lg">
                            #{index + 1}
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            {/* Avatar */}
                            <div className="relative">
                              {isGradient ? (
                                <div 
                                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                                  style={{ background: avatar }}
                                >
                                  {getWinnerDisplayName(winner).charAt(0).toUpperCase()}
                                </div>
                              ) : (
                                <img 
                                  src={avatar}
                                  alt={getWinnerDisplayName(winner)}
                                  className="w-16 h-16 rounded-full object-cover shadow-lg border-2 border-white"
                                />
                              )}
                            </div>
                            
                            {/* Winner Info */}
                            <div className="flex-1">
                              <div className="font-bold text-lg text-gray-800">
                                🎉 {getWinnerDisplayName(winner)}
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                @{winner.username || 'unknown'} • FID: {winner.user_fid}
                              </div>
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="flex items-center space-x-1 text-yellow-600">
                                  <span>⭐</span>
                                  <span className="font-medium">{winner.total_points?.toLocaleString()} points</span>
                                </span>
                                <span className="flex items-center space-x-1 text-orange-600">
                                  <span>🔥</span>
                                  <span className="font-medium">{winner.checkin_streak} day streak</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Export Button */}
                  <div className="px-6 pb-6">
                    <button
                      onClick={() => exportData(raffleResults.winners, `raffle_winners_${new Date().toISOString().split('T')[0]}.csv`)}
                      className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white py-3 px-4 rounded-md transition-all shadow-lg"
                    >
                      📥 Export Winners CSV
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">🏆 Raffle Results</h2>
                  <div className="text-center text-gray-500 py-12">
                    <div className="text-4xl mb-4">🎲</div>
                    <p>Configure your raffle settings and click the button to select random winners!</p>
                    <p className="text-sm mt-2">Results will display with professional styling perfect for announcements.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 