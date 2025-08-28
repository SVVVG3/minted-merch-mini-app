'use client';

import { useState, useEffect } from 'react';
// Removed client-side imports - eligibility check now happens server-side

export function ChatAdminDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [newFids, setNewFids] = useState('');
  const [usernameSearch, setUsernameSearch] = useState('');
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);


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
      
      // Debug: Log member wallet data
      members.forEach(member => {
        console.log(`👤 Member ${member.username} (FID: ${member.fid}):`, {
          walletCount: member.walletAddresses?.length || 0,
          wallets: member.walletAddresses
        });
      });
      
      // Call server-side API for batch eligibility check
      const eligibilityResponse = await fetch('/api/admin/chat-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_check',
          members: members
        })
      });

      const eligibilityResult = await eligibilityResponse.json();

      if (!eligibilityResult.success) {
        throw new Error(eligibilityResult.error || 'Failed to check eligibility');
      }

      const results = eligibilityResult.results;
      
      // Debug: Log results
      results.forEach(result => {
        console.log(`🎯 ${result.username}: ${result.tokenBalance} tokens (eligible: ${result.eligible})`);
      });
      
      setEligibilityData(results);
      setSummary(eligibilityResult.summary);
      
      setLastUpdated(new Date().toLocaleString());
      
    } catch (error) {
      console.error('Error running eligibility check:', error);
      alert('Error checking eligibility: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addChatMembers = async () => {
    if (!newFids.trim()) {
      alert('Please enter at least one FID');
      return;
    }

    setIsAddingMembers(true);
    
    try {
      // Parse FIDs from input (comma or line separated)
      const fids = newFids
        .split(/[,\n\r\s]+/)
        .map(fid => fid.trim())
        .filter(fid => fid && /^\d+$/.test(fid))
        .map(fid => parseInt(fid));

      if (fids.length === 0) {
        alert('No valid FIDs found. Please enter numeric FIDs separated by commas or new lines.');
        return;
      }

      console.log('Adding chat members for FIDs:', fids);

      const response = await fetch('/api/admin/chat-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_members',
          fids
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully added ${result.added} chat members!`);
        setNewFids('');
        // Refresh the eligibility check to show new members
        runEligibilityCheck();
      } else {
        console.error('❌ Detailed error adding members:', result);
        let errorMessage = `Error adding members: ${result.error}`;
        
        if (result.errors && result.errors.length > 0) {
          errorMessage += '\n\nDetailed errors:\n' + result.errors.join('\n');
        }
        
        if (result.debug) {
          errorMessage += `\n\nDebug info: Processed ${result.debug.processedMembers}/${result.debug.totalFids} FIDs, ${result.debug.errorCount} errors`;
        }
        
        alert(errorMessage);
      }

    } catch (error) {
      console.error('Error adding chat members:', error);
      alert('Error adding chat members: ' + error.message);
    } finally {
      setIsAddingMembers(false);
    }
  };

  const searchAndAddByUsername = async () => {
    if (!usernameSearch.trim()) {
      alert('Please enter a username to search');
      return;
    }

    setIsSearchingUsers(true);
    
    try {
      // Search for user by username in profiles table
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'search_username',
          username: usernameSearch.trim()
        })
      });

      const result = await response.json();

      if (result.success && result.users && result.users.length > 0) {
        const user = result.users[0];
        console.log('Found user:', user);
        
        // Add the user's FID to the chat members
        const addResponse = await fetch('/api/admin/chat-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_members',
            fids: [user.fid]
          })
        });

        const addResult = await addResponse.json();

        if (addResult.success) {
          alert(`Successfully added ${user.username} (FID: ${user.fid}) to chat members!`);
          setUsernameSearch('');
          // Refresh the eligibility check to show new member
          runEligibilityCheck();
        } else {
          alert(`Error adding user: ${addResult.error}`);
        }
      } else {
        alert(`No user found with username: ${usernameSearch}`);
      }

    } catch (error) {
      console.error('Error searching for user:', error);
      alert('Error searching for user: ' + error.message);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const removeChatMember = async (fid, username) => {
    if (!confirm(`Are you sure you want to remove ${username} (FID: ${fid}) from chat members?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/chat-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_member',
          fid: fid
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully removed ${username} from chat members!`);
        // Refresh the eligibility check to update the list
        runEligibilityCheck();
      } else {
        alert(`Error removing member: ${result.error}`);
      }

    } catch (error) {
      console.error('Error removing chat member:', error);
      alert('Error removing chat member: ' + error.message);
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

        {/* Add Members Section */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Chat Members</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter FIDs (comma or line separated)
              </label>
              <textarea
                value={newFids}
                onChange={(e) => setNewFids(e.target.value)}
                placeholder="466111, 12345, 67890&#10;Or one per line:&#10;466111&#10;12345&#10;67890"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] focus:border-transparent"
                rows="4"
              />
              <p className="text-xs text-gray-500 mt-1">
                System will automatically fetch wallet addresses from Neynar for each FID
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={addChatMembers}
                disabled={isAddingMembers || !newFids.trim()}
                className="bg-[#3eb489] text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingMembers ? 'Adding Members...' : 'Add Members'}
              </button>
              <button
                onClick={() => setNewFids('')}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Clear
              </button>
            </div>
            
            {/* Username Search Section */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or search by username
              </label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={usernameSearch}
                  onChange={(e) => setUsernameSearch(e.target.value)}
                  placeholder="Enter username (e.g., svvvg3.eth)"
                  className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489] focus:border-transparent"
                  disabled={isSearchingUsers}
                />
                <button
                  onClick={searchAndAddByUsername}
                  disabled={isSearchingUsers || !usernameSearch.trim()}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearchingUsers ? 'Searching...' : 'Search & Add'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Search existing users in the database and add them to chat members
              </p>
            </div>
          </div>
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
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Actions</th>
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
                          <td className="px-4 py-2">
                            <button
                              onClick={() => removeChatMember(user.fid, user.username || user.displayName)}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                            >
                              Remove
                            </button>
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
