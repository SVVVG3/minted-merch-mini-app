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

        {/* Content sections will be added here */}
        <div className="text-center text-gray-500 py-8">
          Admin dashboard content for {activeTab} tab
        </div>
      </div>
    </div>
  );
} 