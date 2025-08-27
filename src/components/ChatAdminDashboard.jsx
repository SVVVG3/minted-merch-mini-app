'use client';

import { useState, useEffect } from 'react';
import { batchCheckEligibility, getEligibilitySummary } from '@/lib/chatEligibility';

export function ChatAdminDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const runEligibilityCheck = async () => {
    setIsLoading(true);
    
    try {
      // This would fetch your current chat members from your database
      // For now, I'll show the structure you'd need
      const response = await fetch('/api/admin/chat-members');
      const { members } = await response.json();
      
      if (!members || members.length === 0) {
        alert('No chat members found to check');
        return;
      }

      console.log('🔍 Checking eligibility for', members.length, 'chat members');
      
      // Batch check all members
      const results = await batchCheckEligibility(members);
      setEligibilityData(results);
      
      // Generate summary
      const summaryStats = getEligibilitySummary(results);
      setSummary(summaryStats);
      
      setLastUpdated(new Date().toLocaleString());
      
    } catch (error) {
      console.error('Error running eligibility check:', error);
      alert('Error checking eligibility: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const exportIneligibleUsers = () => {
    if (!eligibilityData) return;
    
    const ineligible = eligibilityData.filter(user => !user.eligible);
    const csvContent = [
      ['FID', 'Username', 'Display Name', 'Token Balance', 'Required', 'Shortfall'].join(','),
      ...ineligible.map(user => [
        user.fid,
        user.username || '',
        user.displayName || '',
        user.tokenBalance || 0,
        user.requiredBalance,
        (user.requiredBalance - (user.tokenBalance || 0))
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ineligible-chat-members-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                🎫 Chat Eligibility Dashboard
              </h2>
              <p className="text-gray-600 mt-1">
                Monitor $MINTEDMERCH token requirements for chat members
              </p>
            </div>
            <button
              onClick={runEligibilityCheck}
              disabled={isLoading}
              className="bg-[#3eb489] text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Checking...' : 'Run Eligibility Check'}
            </button>
          </div>
          
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-2">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>

        {summary && (
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{summary.total}</div>
                <div className="text-sm text-blue-800">Total Members</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.eligible}</div>
                <div className="text-sm text-green-800">Eligible</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{summary.ineligible}</div>
                <div className="text-sm text-red-800">Need Removal</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{summary.eligibilityRate}%</div>
                <div className="text-sm text-purple-800">Eligibility Rate</div>
              </div>
            </div>
          </div>
        )}

        {eligibilityData && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Members Requiring Removal ({summary?.ineligible || 0})
              </h3>
              {summary?.ineligible > 0 && (
                <button
                  onClick={exportIneligibleUsers}
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                >
                  Export CSV
                </button>
              )}
            </div>

            {summary?.ineligible === 0 ? (
              <div className="text-center py-8 text-gray-500">
                🎉 All members are currently eligible!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">User</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">FID</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Token Balance</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Shortfall</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {eligibilityData
                      .filter(user => !user.eligible)
                      .sort((a, b) => (b.tokenBalance || 0) - (a.tokenBalance || 0))
                      .map((user, index) => (
                        <tr key={user.fid} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div>
                              <div className="font-medium text-gray-900">
                                {user.displayName || user.username || 'Unknown'}
                              </div>
                              {user.username && (
                                <div className="text-sm text-gray-500">@{user.username}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">{user.fid}</td>
                          <td className="px-4 py-2 text-right text-sm">
                            {(user.tokenBalance || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-red-600">
                            -{(user.requiredBalance - (user.tokenBalance || 0)).toLocaleString()}
                          </td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Remove Required
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {eligibilityData && summary?.eligible > 0 && (
          <div className="p-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Eligible Members ({summary.eligible})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {eligibilityData
                .filter(user => user.eligible)
                .slice(0, 12) // Show first 12 eligible members
                .map((user) => (
                  <div key={user.fid} className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-green-800">
                          {user.displayName || user.username || 'Unknown'}
                        </div>
                        <div className="text-sm text-green-600">
                          {(user.tokenBalance || 0).toLocaleString()} tokens
                        </div>
                      </div>
                      <div className="text-green-500">✅</div>
                    </div>
                  </div>
                ))}
            </div>
            {summary.eligible > 12 && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                ... and {summary.eligible - 12} more eligible members
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
