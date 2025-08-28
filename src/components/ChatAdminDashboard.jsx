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

  // Load existing chat members when component mounts
  useEffect(() => {
    loadChatMembers();
  }, []);

  const loadChatMembers = async () => {
    try {
      console.log('📋 Loading existing chat members with cached balances...');
      
      const response = await fetch('/api/admin/chat-members');
      const { members } = await response.json();
      
      if (!members || members.length === 0) {
        console.log('ℹ️ No existing chat members found');
        setEligibilityData([]);
        setSummary({
          totalMembers: 0,
          eligibleMembers: 0,
          ineligibleMembers: 0,
          averageBalance: 0
        });
        return;
      }

      console.log(`📊 Loaded ${members.length} existing chat members`);
      
      // Transform members data to match eligibility format
      const memberData = members.map(member => ({
        fid: member.fid,
        username: member.username,
        displayName: member.displayName,
        pfpUrl: member.pfpUrl,
        tokenBalance: member.tokenBalance || 0,
        eligible: (member.tokenBalance || 0) >= 50000000, // 50M tokens
        requiredBalance: 50000000,
        walletCount: member.walletAddresses?.length || 0,
        lastChecked: member.lastBalanceCheck || 'Never',
        balanceCheckStatus: member.balanceCheckStatus || 'pending'
      }));

      // Calculate summary statistics
      const eligibleCount = memberData.filter(m => m.eligible).length;
      const totalBalance = memberData.reduce((sum, m) => sum + (m.tokenBalance || 0), 0);
      const avgBalance = memberData.length > 0 ? totalBalance / memberData.length : 0;

      setEligibilityData(memberData);
      setSummary({
        totalMembers: memberData.length,
        eligibleMembers: eligibleCount,
        ineligibleMembers: memberData.length - eligibleCount,
        averageBalance: avgBalance
      });
      
      // Find the most recent balance check timestamp from all members
      const lastBalanceUpdate = memberData
        .map(m => m.lastBalanceCheck)
        .filter(date => date) // Remove null/undefined dates
        .sort((a, b) => new Date(b) - new Date(a))[0]; // Get most recent
      
      if (lastBalanceUpdate) {
        setLastUpdated(new Date(lastBalanceUpdate).toLocaleString());
      } else {
        setLastUpdated('Never updated');
      }
      
      console.log(`✅ Displayed ${memberData.length} members (${eligibleCount} eligible)`);
      
    } catch (error) {
      console.error('❌ Error loading chat members:', error);
      // Don't show alert on initial load, just log the error
    }
  };

  const updateAllBalances = async () => {
    setIsLoading(true);
    
    try {
      console.log('🔄 Manually triggering balance update for all chat members...');
      
      const response = await fetch('/api/admin/update-balances', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ Successfully updated balances for ${result.stats.totalMembers} members!\n\nResults:\n- ${result.stats.successCount} successful\n- ${result.stats.errorCount} errors\n- ${result.stats.eligibleCount} eligible\n- ${result.stats.ineligibleCount} ineligible\n\nDuration: ${(result.stats.duration / 1000).toFixed(1)}s`);
        
        // Refresh the display with updated data and set current time as last update
        await loadChatMembers();
        setLastUpdated(new Date().toLocaleString());
      } else {
        throw new Error(result.error || 'Failed to update balances');
      }

    } catch (error) {
      console.error('❌ Error updating balances:', error);
      alert('Error updating balances: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runEligibilityCheck = async () => {
    setIsLoading(true);
    
    try {
      console.log('🔄 Refreshing chat member display with cached data...');
      
      // Just reload the cached data from database (fast)
      await loadChatMembers();
      
    } catch (error) {
      console.error('Error refreshing eligibility display:', error);
      alert('Error refreshing display: ' + error.message);
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
        // Refresh the display to show new members
        loadChatMembers();
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
            <div className="flex space-x-3">
              <button
                onClick={runEligibilityCheck}
                disabled={isLoading}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Refreshing...' : '🔄 Refresh Display'}
              </button>
              <button
                onClick={updateAllBalances}
                disabled={isLoading}
                className="bg-[#3eb489] text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Updating...' : '🔗 Update All Balances'}
              </button>
            </div>
          </div>
          
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-2">
              Balances last updated: {lastUpdated}
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
                <div className="text-2xl font-bold text-blue-600">{summary.totalMembers || 0}</div>
                <div className="text-sm text-blue-800">Total Members</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.eligibleMembers || 0}</div>
                <div className="text-sm text-green-800">Eligible</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{summary.ineligibleMembers || 0}</div>
                <div className="text-sm text-red-800">Need Removal</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {summary.totalMembers > 0 ? Math.round((summary.eligibleMembers / summary.totalMembers) * 100) : 0}%
                </div>
                <div className="text-sm text-purple-800">Eligibility Rate</div>
              </div>
            </div>
          </div>
        )}

        {eligibilityData && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Members Requiring Removal ({summary?.ineligibleMembers || 0})
              </h3>
              {summary?.ineligibleMembers > 0 && (
                <button
                  onClick={exportIneligibleUsers}
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                >
                  Export CSV
                </button>
              )}
            </div>

            {summary?.ineligibleMembers === 0 ? (
              <div className="text-center py-8 text-gray-500">
                🎉 All members are currently eligible!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {eligibilityData
                  .filter(user => !user.eligible)
                  .sort((a, b) => (b.tokenBalance || 0) - (a.tokenBalance || 0))
                  .map((user, index) => (
                    <div key={user.fid} className="bg-red-50 border border-red-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start space-x-3">
                        {/* Profile Picture */}
                        <div className="flex-shrink-0">
                          {user.pfpUrl ? (
                            <img
                              src={user.pfpUrl}
                              alt={user.displayName || user.username || 'User'}
                              className="w-12 h-12 rounded-full object-cover border-2 border-red-300"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-12 h-12 rounded-full bg-red-200 border-2 border-red-300 flex items-center justify-center text-red-700 font-semibold ${user.pfpUrl ? 'hidden' : 'flex'}`}
                          >
                            {(user.displayName || user.username || 'U').charAt(0).toUpperCase()}
                          </div>
                        </div>
                        
                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-red-900 truncate">
                            {user.displayName || user.username || 'Unknown User'}
                          </div>
                          {user.username && user.displayName && (
                            <div className="text-xs text-red-600 truncate">
                              @{user.username}
                            </div>
                          )}
                          <div className="text-sm font-semibold text-red-700 mt-1">
                            {(user.tokenBalance || 0).toLocaleString()} tokens
                          </div>
                          <div className="text-xs text-red-600">
                            FID: {user.fid}
                          </div>
                          <div className="text-xs text-red-600 mt-1">
                            Shortfall: -{(user.requiredBalance - (user.tokenBalance || 0)).toLocaleString()}
                          </div>
                          {user.lastBalanceCheck && (
                            <div className="text-xs text-gray-500 mt-1">
                              Updated: {new Date(user.lastBalanceCheck).toLocaleDateString()}
                            </div>
                          )}
                          {user.balanceCheckStatus === 'error' && (
                            <div className="text-xs text-red-500 mt-1">
                              ⚠️ Balance check failed
                            </div>
                          )}
                          {user.balanceCheckStatus === 'pending' && (
                            <div className="text-xs text-yellow-600 mt-1">
                              ⏳ Balance pending update
                            </div>
                          )}
                        </div>
                        
                        {/* Remove Button */}
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => removeChatMember(user.fid, user.username || user.displayName)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {eligibilityData && summary?.eligibleMembers > 0 && (
          <div className="p-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              All Eligible Members ({summary.eligibleMembers}) - Sorted by Holdings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {eligibilityData
                .filter(user => user.eligible)
                .sort((a, b) => (b.tokenBalance || 0) - (a.tokenBalance || 0)) // Sort by token balance (highest first)
                .map((user) => (
                  <div key={user.fid} className="bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors">
                    <div className="flex items-start space-x-3">
                      {/* Profile Picture */}
                      <div className="flex-shrink-0">
                        {user.pfpUrl ? (
                          <img 
                            src={user.pfpUrl} 
                            alt={user.displayName || user.username || 'User'}
                            className="w-12 h-12 rounded-full object-cover border-2 border-green-300"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-12 h-12 rounded-full bg-green-200 border-2 border-green-300 flex items-center justify-center text-green-700 font-semibold ${user.pfpUrl ? 'hidden' : 'flex'}`}
                        >
                          {(user.displayName || user.username || 'U').charAt(0).toUpperCase()}
                        </div>
                      </div>
                      
                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-green-800 truncate">
                          {user.displayName || user.username || 'Unknown'}
                        </div>
                        {user.username && user.displayName && (
                          <div className="text-xs text-green-600 truncate">
                            @{user.username}
                          </div>
                        )}
                        <div className="text-sm font-semibold text-green-700 mt-1">
                          {(user.tokenBalance || 0).toLocaleString()} tokens
                        </div>
                        <div className="text-xs text-green-600">
                          FID: {user.fid}
                        </div>
                        {user.lastBalanceCheck && (
                          <div className="text-xs text-gray-500 mt-1">
                            Updated: {new Date(user.lastBalanceCheck).toLocaleDateString()}
                          </div>
                        )}
                        {user.balanceCheckStatus === 'error' && (
                          <div className="text-xs text-red-500 mt-1">
                            ⚠️ Balance check failed
                          </div>
                        )}
                        {user.balanceCheckStatus === 'pending' && (
                          <div className="text-xs text-yellow-600 mt-1">
                            ⏳ Balance pending update
                          </div>
                        )}
                      </div>
                      
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        <div className="text-green-500 text-xl">✅</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
