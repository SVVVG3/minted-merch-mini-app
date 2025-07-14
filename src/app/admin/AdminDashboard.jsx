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
  const [numWinners, setNumWinners] = useState(1);
  
  // Leaderboard sorting state
  const [sortField, setSortField] = useState('total_points');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Discounts state
  const [discountsData, setDiscountsData] = useState([]);
  const [showCreateDiscount, setShowCreateDiscount] = useState(false);

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

      // Load discounts data
      const discountsResponse = await fetch('/api/admin/discounts');
      if (discountsResponse.ok) {
        const discountsResult = await discountsResponse.json();
        if (discountsResult.success) {
          setDiscountsData(discountsResult.data);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const runRaffle = async (winnersCount = null, customFilters = null) => {
    try {
      const winners = winnersCount || numWinners;
      const filters = customFilters || raffleFilters;
      
      const response = await fetch('/api/admin/raffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numWinners: winners,
          filters: filters
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

  // Quick raffle functions for top users
  const runTopUsersRaffle = async (topCount, sortBy = 'total_points') => {
    if (!leaderboardData || leaderboardData.length === 0) {
      setError('Leaderboard data not loaded');
      return;
    }

    // Sort users by the specified criteria
    const sortedUsers = [...leaderboardData].sort((a, b) => {
      if (sortBy === 'total_points') return b.total_points - a.total_points;
      if (sortBy === 'checkin_streak') return b.checkin_streak - a.checkin_streak;
      if (sortBy === 'points_from_purchases') return b.points_from_purchases - a.points_from_purchases;
      return 0;
    });

    // Get the minimum threshold for the top N users
    const topUsers = sortedUsers.slice(0, topCount);
    if (topUsers.length === 0) {
      setError('No users found for top raffle');
      return;
    }

    const minThreshold = topUsers[topUsers.length - 1][sortBy];
    
    // Create filter to include only top N users
    const topUserFilters = { ...raffleFilters };
    if (sortBy === 'total_points') topUserFilters.minPoints = minThreshold;
    if (sortBy === 'checkin_streak') topUserFilters.minStreak = minThreshold;
    if (sortBy === 'points_from_purchases') topUserFilters.minPurchasePoints = minThreshold;

    // Run raffle with these filters
    await runRaffle(numWinners, topUserFilters);
  };

  // Leaderboard sorting function
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sorted leaderboard data
  const getSortedLeaderboard = () => {
    if (!leaderboardData) return [];
    
    return [...leaderboardData].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle string fields
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
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
                { key: 'discounts', label: '🎫 Discounts' },
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
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('username')}
                    >
                      Username {sortField === 'username' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_points')}
                    >
                      Total Points {sortField === 'total_points' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('checkin_streak')}
                    >
                      Streak {sortField === 'checkin_streak' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('points_from_purchases')}
                    >
                      Purchase Points {sortField === 'points_from_purchases' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_orders')}
                    >
                      Orders {sortField === 'total_orders' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getSortedLeaderboard().map((user, index) => (
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

        {/* Discounts Tab */}
        {activeTab === 'discounts' && (
          <div className="space-y-6">
            {/* Discounts Header */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">🎫 Discount Codes</h2>
                <div className="flex space-x-3">
                  <button
                    onClick={() => exportData(discountsData, 'discounts.csv')}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                  >
                    📥 Export CSV
                  </button>
                  <button
                    onClick={() => setShowCreateDiscount(true)}
                    className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                  >
                    ➕ Create New Discount
                  </button>
                </div>
              </div>
              
              {/* Discounts Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {discountsData.map((discount) => (
                      <tr key={discount.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {discount.code}
                          {discount.free_shipping && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">🚚 Free Ship</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {discount.discount_type === 'percentage' ? `${discount.discount_value}%` : `$${discount.discount_value}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 text-xs rounded ${
                            discount.code_type === 'welcome' ? 'bg-green-100 text-green-800' :
                            discount.code_type === 'promotional' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {discount.code_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 text-xs rounded ${
                            discount.gating_type === 'none' ? 'bg-gray-100 text-gray-800' :
                            discount.gating_type === 'bankr_club' ? 'bg-purple-100 text-purple-800' :
                            discount.gating_type === 'whitelist_fid' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {discount.gating_type === 'none' ? 'Public' :
                             discount.gating_type === 'bankr_club' ? 'Bankr Club' :
                             discount.gating_type === 'whitelist_fid' ? 'FID Whitelist' :
                             discount.gating_type === 'whitelist_wallet' ? 'Wallet Whitelist' :
                             discount.gating_type === 'nft_holding' ? 'NFT Holders' :
                             discount.gating_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {discount.usage_count} / {discount.max_uses_total || '∞'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 text-xs rounded ${
                            discount.is_active ? 'bg-green-100 text-green-800' :
                            discount.is_expired ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {discount.is_active ? 'Active' :
                             discount.is_expired ? 'Expired' :
                             'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {discount.expires_at ? formatDate(discount.expires_at) : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create Discount Modal */}
            {showCreateDiscount && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Create New Discount Code</h3>
                    <button
                      onClick={() => setShowCreateDiscount(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  
                                     <CreateDiscountForm onClose={() => setShowCreateDiscount(false)} onSuccess={loadDashboardData} />
                </div>
              </div>
            )}
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
              
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🏆 Number of Winners
                  </label>
                  <select
                    value={numWinners}
                    onChange={(e) => setNumWinners(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  >
                    <option value={1}>1 Winner</option>
                    <option value={2}>2 Winners</option>
                    <option value={3}>3 Winners</option>
                    <option value={4}>4 Winners</option>
                    <option value={5}>5 Winners</option>
                  </select>
                </div>

                <button
                  onClick={() => runRaffle()}
                  className="w-full bg-gradient-to-r from-[#3eb489] to-[#45c497] hover:from-[#359970] hover:to-[#3eb489] text-white py-3 px-4 rounded-md transition-all transform hover:scale-105 shadow-lg"
                >
                  🎲 Run Custom Raffle ({numWinners} Winner{numWinners > 1 ? 's' : ''})
                </button>

                {/* Quick Top Users Raffles */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">⚡ Quick Top Users Raffles</h3>
                  
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600 mb-2">🏅 By Total Points</div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => runTopUsersRaffle(10, 'total_points')}
                        className="px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded text-sm"
                      >
                        Top 10
                      </button>
                      <button
                        onClick={() => runTopUsersRaffle(20, 'total_points')}
                        className="px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded text-sm"
                      >
                        Top 20
                      </button>
                      <button
                        onClick={() => runTopUsersRaffle(50, 'total_points')}
                        className="px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded text-sm"
                      >
                        Top 50
                      </button>
                    </div>

                    <div className="text-xs text-gray-600 mb-2 mt-3">🔥 By Streak Days</div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => runTopUsersRaffle(10, 'checkin_streak')}
                        className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded text-sm"
                      >
                        Top 10
                      </button>
                      <button
                        onClick={() => runTopUsersRaffle(20, 'checkin_streak')}
                        className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded text-sm"
                      >
                        Top 20
                      </button>
                      <button
                        onClick={() => runTopUsersRaffle(50, 'checkin_streak')}
                        className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded text-sm"
                      >
                        Top 50
                      </button>
                    </div>

                    <div className="text-xs text-gray-600 mb-2 mt-3">💰 By Purchase Points</div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => runTopUsersRaffle(10, 'points_from_purchases')}
                        className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm"
                      >
                        Top 10
                      </button>
                      <button
                        onClick={() => runTopUsersRaffle(20, 'points_from_purchases')}
                        className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm"
                      >
                        Top 20
                      </button>
                      <button
                        onClick={() => runTopUsersRaffle(50, 'points_from_purchases')}
                        className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm"
                      >
                        Top 50
                      </button>
                    </div>
                  </div>
                </div>
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

// CreateDiscountForm Component
function CreateDiscountForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    code_type: 'promotional',
    gating_type: 'none',
    target_fids: '',
    target_wallets: '',
    contract_addresses: '',
    chain_ids: '1',
    required_balance: '1',
    minimum_order_amount: '',
    expires_at: '',
    max_uses_total: '',
    max_uses_per_user: '1',
    discount_description: '',
    free_shipping: false,
    is_shared_code: true
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Prepare the data
      const submitData = {
        ...formData,
        target_fids: formData.target_fids ? formData.target_fids.split(',').map(fid => parseInt(fid.trim())).filter(fid => !isNaN(fid)) : [],
        target_wallets: formData.target_wallets ? formData.target_wallets.split(',').map(wallet => wallet.trim()).filter(w => w) : [],
        contract_addresses: formData.contract_addresses ? formData.contract_addresses.split(',').map(addr => addr.trim()).filter(a => a) : [],
        chain_ids: formData.chain_ids ? formData.chain_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [1]
      };

      const response = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (result.success) {
        onSuccess(); // Reload data
        onClose(); // Close modal
      } else {
        setError(result.error || 'Failed to create discount');
      }
    } catch (error) {
      console.error('Error creating discount:', error);
      setError('Failed to create discount');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Discount Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Code *
          </label>
          <input
            type="text"
            required
            value={formData.code}
            onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="SAVE20"
          />
        </div>

        {/* Discount Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Type *
          </label>
          <select
            value={formData.discount_type}
            onChange={(e) => handleInputChange('discount_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount ($)</option>
          </select>
        </div>

        {/* Discount Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Value *
          </label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={formData.discount_value}
            onChange={(e) => handleInputChange('discount_value', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder={formData.discount_type === 'percentage' ? '15' : '5.00'}
          />
        </div>

        {/* Code Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Code Type
          </label>
          <select
            value={formData.code_type}
            onChange={(e) => handleInputChange('code_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="promotional">Promotional</option>
            <option value="welcome">Welcome</option>
            <option value="referral">Referral</option>
          </select>
        </div>

        {/* Gating Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Access Control
          </label>
          <select
            value={formData.gating_type}
            onChange={(e) => handleInputChange('gating_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          >
            <option value="none">Public (Anyone can use)</option>
            <option value="whitelist_fid">Specific FIDs</option>
            <option value="whitelist_wallet">Specific Wallets</option>
            <option value="nft_holding">NFT Holders</option>
            <option value="token_balance">Token Balance</option>
            <option value="bankr_club">Bankr Club Members</option>
          </select>
        </div>

        {/* Max Uses */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Total Uses
          </label>
          <input
            type="number"
            min="1"
            value={formData.max_uses_total}
            onChange={(e) => handleInputChange('max_uses_total', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="Leave empty for unlimited"
          />
        </div>
      </div>

      {/* Conditional Fields Based on Gating Type */}
      {formData.gating_type === 'whitelist_fid' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target FIDs (comma-separated)
          </label>
          <input
            type="text"
            value={formData.target_fids}
            onChange={(e) => handleInputChange('target_fids', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="123456, 789012, 345678"
          />
        </div>
      )}

      {formData.gating_type === 'whitelist_wallet' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Wallets (comma-separated)
          </label>
          <input
            type="text"
            value={formData.target_wallets}
            onChange={(e) => handleInputChange('target_wallets', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="0x123..., 0x456..."
          />
        </div>
      )}

      {(formData.gating_type === 'nft_holding' || formData.gating_type === 'token_balance') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract Addresses (comma-separated)
            </label>
            <input
              type="text"
              value={formData.contract_addresses}
              onChange={(e) => handleInputChange('contract_addresses', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
              placeholder="0x123..., 0x456..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Required Balance
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.required_balance}
              onChange={(e) => handleInputChange('required_balance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
              placeholder="1"
            />
          </div>
        </div>
      )}

      {/* Optional Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Order Amount
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.minimum_order_amount}
            onChange={(e) => handleInputChange('minimum_order_amount', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
            placeholder="25.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expires At
          </label>
          <input
            type="datetime-local"
            value={formData.expires_at}
            onChange={(e) => handleInputChange('expires_at', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={formData.discount_description}
          onChange={(e) => handleInputChange('discount_description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          rows="3"
          placeholder="Internal description for this discount..."
        />
      </div>

      {/* Checkboxes */}
      <div className="flex space-x-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.free_shipping}
            onChange={(e) => handleInputChange('free_shipping', e.target.checked)}
            className="mr-2 h-4 w-4 text-[#3eb489] focus:ring-[#3eb489]"
          />
          Free Shipping
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_shared_code}
            onChange={(e) => handleInputChange('is_shared_code', e.target.checked)}
            className="mr-2 h-4 w-4 text-[#3eb489] focus:ring-[#3eb489]"
          />
          Shared Code (multiple users can use)
        </label>
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-[#3eb489] hover:bg-[#359970] text-white px-6 py-2 rounded-md disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Discount'}
        </button>
      </div>
    </form>
  );
} 