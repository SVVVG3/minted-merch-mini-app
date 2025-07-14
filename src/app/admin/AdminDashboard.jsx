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
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Raffle state
  const [raffleFilters, setRaffleFilters] = useState({
    minPoints: 0,
    minStreak: 0,
    minPurchasePoints: 0,
    excludePreviousWinners: true
  });
  const [raffleResults, setRaffleResults] = useState(null);

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            🛡️ Minted Merch Admin
          </h1>
          
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
            <h1 className="text-xl font-semibold text-gray-800">
              🛡️ Minted Merch Admin Dashboard
            </h1>
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

        {/* Raffle Tab */}
        {activeTab === 'raffle' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Raffle Controls */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">🎲 Raffle Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Points
                  </label>
                  <input
                    type="number"
                    value={raffleFilters.minPoints}
                    onChange={(e) => setRaffleFilters(prev => ({ ...prev, minPoints: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Streak (days)
                  </label>
                  <input
                    type="number"
                    value={raffleFilters.minStreak}
                    onChange={(e) => setRaffleFilters(prev => ({ ...prev, minStreak: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Purchase Points
                  </label>
                  <input
                    type="number"
                    value={raffleFilters.minPurchasePoints}
                    onChange={(e) => setRaffleFilters(prev => ({ ...prev, minPurchasePoints: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="excludePrevious"
                    checked={raffleFilters.excludePreviousWinners}
                    onChange={(e) => setRaffleFilters(prev => ({ ...prev, excludePreviousWinners: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="excludePrevious" className="text-sm text-gray-700">
                    Exclude previous winners (not implemented yet)
                  </label>
                </div>
              </div>
              
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => runRaffle(1)}
                  className="w-full bg-[#3eb489] hover:bg-[#359970] text-white py-2 px-4 rounded-md transition-colors"
                >
                  🎲 Run Raffle (1 Winner)
                </button>
                <button
                  onClick={() => runRaffle(3)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
                >
                  🎲 Run Raffle (3 Winners)
                </button>
              </div>
            </div>

            {/* Raffle Results */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">🏆 Raffle Results</h2>
              
              {raffleResults ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Selected from {raffleResults.eligibleCount} eligible users
                  </div>
                  
                  <div className="space-y-2">
                    {raffleResults.winners.map((winner, index) => (
                      <div key={winner.user_fid} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-800">
                              🎉 Winner #{index + 1}
                            </div>
                            <div className="text-sm text-gray-600">
                              FID: {winner.user_fid} | @{winner.username || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {winner.total_points} points | {winner.checkin_streak} day streak
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => exportData(raffleResults.winners, `raffle_winners_${new Date().toISOString().split('T')[0]}.csv`)}
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    📥 Export Winners
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Configure filters and run a raffle to see results
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 