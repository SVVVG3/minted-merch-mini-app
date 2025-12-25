'use client';

import { useState, useEffect } from 'react';
import { getMojoColor, getMojoTier, formatTokenAmount } from '@/lib/mojoScore';

// Helper function for authenticated admin API calls
const adminFetch = async (url, options = {}) => {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    throw new Error('No authentication token found. Please log in again.');
  }
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'X-Admin-Token': token
  };
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }
  
  return response;
};

export default function UserModal({ isOpen, onClose, userFid }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [updatingOrder, setUpdatingOrder] = useState(null);
  
  // Vendor payout modal state
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutOrderId, setPayoutOrderId] = useState(null);
  const [payoutAssignmentId, setPayoutAssignmentId] = useState(null); // For assignment-based payouts
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState(''); // Internal notes (admin only)
  const [payoutPartnerNotes, setPayoutPartnerNotes] = useState(''); // Notes visible to partner
  const [payoutModalType, setPayoutModalType] = useState('final'); // 'estimated' or 'final'

  useEffect(() => {
    if (isOpen && userFid) {
      fetchUserData();
    }
  }, [isOpen, userFid]);

  const fetchUserData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await adminFetch(`/api/admin/user-details?fid=${userFid}`);
      const result = await response.json();
      
      if (result.success) {
        setUserData(result.data);
      } else {
        setError(result.error || 'Failed to fetch user data');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTokenBalance = (balance) => {
    if (!balance || balance === 0) return '0';
    
    // Balance is now stored in tokens (not wei), so no conversion needed
    const tokenAmount = typeof balance === 'string' ? parseFloat(balance) : balance;
    
    if (tokenAmount >= 1000000000) {
      // Show billions (B) for amounts >= 1 billion
      return `${(tokenAmount / 1000000000).toFixed(3)}B`;
    } else if (tokenAmount >= 1000000) {
      // Show millions (M) for amounts >= 1 million
      return `${(tokenAmount / 1000000).toFixed(1)}M`;
    } else if (tokenAmount >= 1000) {
      // Show thousands (K) for amounts >= 1 thousand
      return `${(tokenAmount / 1000).toFixed(1)}K`;
    } else if (tokenAmount >= 1) {
      return tokenAmount.toFixed(2);
    } else {
      return tokenAmount.toFixed(6);
    }
  };

  const truncateAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const openFarcasterProfile = (username) => {
    window.open(`https://farcaster.xyz/${username}`, '_blank');
  };

  const openXProfile = (username) => {
    window.open(`https://x.com/${username}`, '_blank');
  };

  const updateOrderStatus = async (orderId, newStatus, additionalData = {}) => {
    setUpdatingOrder(orderId);
    try {
      // URL encode the orderId to handle special characters like #
      const encodedOrderId = encodeURIComponent(orderId);
      const response = await adminFetch(`/api/admin/orders/${encodedOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...additionalData })
      });
      const result = await response.json();
      if (result.success) {
        // Refresh user data to get updated orders
        fetchUserData();
      } else {
        alert(result.error || 'Failed to update order');
      }
    } catch (err) {
      console.error('Error updating order:', err);
      alert('Failed to update order');
    } finally {
      setUpdatingOrder(null);
    }
  };

  // Handle status change - show payout modal for vendor_paid
  const handleStatusChange = (orderId, newStatus, currentStatus) => {
    if (newStatus === 'vendor_paid' && currentStatus !== 'vendor_paid') {
      // Show payout modal to collect amount and notes
      setPayoutOrderId(orderId);
      setPayoutAmount('');
      setPayoutNotes('');
      setPayoutPartnerNotes('');
      setShowPayoutModal(true);
    } else {
      // Direct status update for other statuses
      updateOrderStatus(orderId, newStatus);
    }
  };

  // Submit vendor payout (handles both estimated and final)
  const submitVendorPayout = async () => {
    if (!payoutOrderId) return;
    
    // Check if this is an assignment-based payout
    if (payoutAssignmentId) {
      if (payoutModalType === 'estimated') {
        // Payment processing with estimated amount
        await updateAssignmentStatus(payoutOrderId, payoutAssignmentId, 'payment_processing', {
          vendor_payout_estimated: payoutAmount || null,
          vendor_payout_internal_notes: payoutNotes || null,
          vendor_payout_partner_notes: payoutPartnerNotes || null
        });
      } else {
        // Final vendor paid
        await updateAssignmentStatus(payoutOrderId, payoutAssignmentId, 'vendor_paid', {
          vendor_payout_amount: payoutAmount || null,
          vendor_payout_internal_notes: payoutNotes || null,
          vendor_payout_partner_notes: payoutPartnerNotes || null
        });
      }
    } else {
      // Legacy order-based payout (always final)
      await updateOrderStatus(payoutOrderId, 'vendor_paid', {
        vendor_payout_amount: payoutAmount || null,
        vendor_payout_notes: payoutNotes || null,
        vendor_payout_partner_notes: payoutPartnerNotes || null
      });
    }
    
    setShowPayoutModal(false);
    setPayoutOrderId(null);
    setPayoutAssignmentId(null);
    setPayoutAmount('');
    setPayoutNotes('');
    setPayoutPartnerNotes('');
    setPayoutModalType('final');
  };
  
  // Update assignment status (for partner orders in Partner tab)
  const updateAssignmentStatus = async (orderId, assignmentId, newStatus, additionalData = {}) => {
    setUpdatingOrder(orderId);
    try {
      const encodedOrderId = encodeURIComponent(orderId);
      const response = await adminFetch(`/api/admin/orders/${encodedOrderId}/assignments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          assignment_id: assignmentId, 
          status: newStatus, 
          ...additionalData 
        })
      });
      const result = await response.json();
      if (result.success) {
        // Refresh user data to get updated orders
        fetchUserData();
      } else {
        alert(result.error || 'Failed to update assignment');
      }
    } catch (err) {
      console.error('Error updating assignment:', err);
      alert('Failed to update assignment');
    } finally {
      setUpdatingOrder(null);
    }
  };
  
  // Handle assignment status change - show payout modal for payment_processing and vendor_paid
  const handleAssignmentStatusChange = (orderId, assignmentId, newStatus, currentStatus, existingEstimate = null) => {
    if (newStatus === 'payment_processing' && currentStatus !== 'payment_processing' && currentStatus !== 'vendor_paid') {
      // Show payout modal to collect estimated amount and notes
      setPayoutOrderId(orderId);
      setPayoutAssignmentId(assignmentId);
      setPayoutAmount('');
      setPayoutNotes('');
      setPayoutPartnerNotes('');
      setPayoutModalType('estimated');
      setShowPayoutModal(true);
    } else if (newStatus === 'vendor_paid' && currentStatus !== 'vendor_paid') {
      // Show payout modal to collect final amount and notes
      setPayoutOrderId(orderId);
      setPayoutAssignmentId(assignmentId);
      setPayoutAmount(existingEstimate || '');
      setPayoutNotes('');
      setPayoutPartnerNotes('');
      setPayoutModalType('final');
      setShowPayoutModal(true);
    } else {
      // Direct status update for other statuses
      updateAssignmentStatus(orderId, assignmentId, newStatus);
    }
  };

  const CopyButton = ({ text, label }) => (
    <button
      onClick={() => copyToClipboard(text)}
      className="ml-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
      title={`Copy ${label}`}
    >
      📋
    </button>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden" style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6), 0 10px 30px rgba(0, 0, 0, 0.4)' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center space-x-3">
            {userData?.pfp_url ? (
              <img 
                src={userData.pfp_url} 
                alt={userData.username || 'User'} 
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">
                {userData?.username?.charAt(0).toUpperCase() || userData?.fid?.toString().charAt(0) || '?'}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {userData?.username || `User ${userData?.fid}`}
              </h2>
              <p className="text-sm text-gray-600">FID: {userData?.fid}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="p-8 text-center">
            <div className="text-gray-500">Loading user data...</div>
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <div className="text-red-600">{error}</div>
          </div>
        )}

        {userData && (
          <div className="flex flex-col" style={{ height: 'calc(90vh - 80px)', minHeight: '500px' }}>
            {/* Tab Navigation - flex-shrink-0 prevents collapse */}
            <div className="flex border-b border-gray-200 px-6 overflow-x-auto flex-shrink-0">
              {[
                { id: 'overview', label: 'Overview', icon: '👤' },
                { id: 'wallets', label: 'Wallets', icon: '💳' },
                { id: 'orders', label: 'Orders', icon: '🛍️' },
                { id: 'discounts', label: 'Discounts', icon: '🎫' },
                { id: 'points', label: 'Points', icon: '⭐' },
                { id: 'raffles', label: 'Raffles', icon: '🎲' },
                { id: 'missions', label: 'Missions', icon: '🎯' },
                ...(userData?.partner ? [{ id: 'partner', label: 'Partner', icon: '🤝' }] : [])
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'border-[#3eb489] text-[#3eb489]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Profile Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3">Profile Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Display Name</label>
                        <p className="text-gray-900">{userData.display_name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Username</label>
                        <p className="text-gray-900">
                          {userData.username ? (
                            <span 
                              onClick={() => openFarcasterProfile(userData.username)}
                              className="text-blue-600 hover:text-blue-800 cursor-pointer"
                            >
                              @{userData.username}
                            </span>
                          ) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Email</label>
                        <p className="text-gray-900">{userData.email || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Joined</label>
                        <p className="text-gray-900">{formatDate(userData.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Bankr Membership & User Quality */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3">User Quality & Memberships</h3>
                    
                    {/* Mojo Score with Breakdown */}
                    <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Mojo Score</label>
                          <p className={`text-2xl font-bold ${getMojoColor(parseFloat(userData.mojo_score) || 0)}`}>
                            {userData.mojo_score !== null && userData.mojo_score !== undefined 
                              ? parseFloat(userData.mojo_score).toFixed(2) 
                              : 'N/A'}
                          </p>
                          {userData.mojo_score && (
                            <p className={`text-sm ${getMojoColor(parseFloat(userData.mojo_score))}`}>
                              {getMojoTier(parseFloat(userData.mojo_score)).tier}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Mojo Breakdown */}
                      {userData.mojo_breakdown && (
                        <div className="mt-3 pt-3 border-t border-purple-200">
                          <p className="text-xs font-medium text-gray-500 mb-2">Score Breakdown</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            <div className="bg-white p-2 rounded">
                              <span className="text-gray-500">Neynar (10%)</span>
                              <p className="font-medium">{(userData.mojo_breakdown.breakdown?.neynar?.normalized || 0).toFixed(2)} → {(userData.mojo_breakdown.breakdown?.neynar?.weighted || 0).toFixed(2)}</p>
                            </div>
                            <div className="bg-white p-2 rounded">
                              <span className="text-gray-500">Quotient (20%)</span>
                              <p className="font-medium">{(userData.mojo_breakdown.breakdown?.quotient?.normalized || 0).toFixed(2)} → {(userData.mojo_breakdown.breakdown?.quotient?.weighted || 0).toFixed(2)}</p>
                            </div>
                            <div className="bg-white p-2 rounded">
                              <span className="text-gray-500">Staking (25%)</span>
                              <p className="font-medium">{(userData.mojo_breakdown.breakdown?.staking?.normalized || 0).toFixed(2)} → {(userData.mojo_breakdown.breakdown?.staking?.weighted || 0).toFixed(2)}</p>
                              <p className="text-gray-400">{formatTokenAmount(userData.mojo_breakdown.breakdown?.staking?.raw || 0)}</p>
                            </div>
                            <div className="bg-white p-2 rounded">
                              <span className="text-gray-500">Holdings (5%)</span>
                              <p className="font-medium">{(userData.mojo_breakdown.breakdown?.holdings?.normalized || 0).toFixed(2)} → {(userData.mojo_breakdown.breakdown?.holdings?.weighted || 0).toFixed(2)}</p>
                              <p className="text-gray-400">{formatTokenAmount(userData.mojo_breakdown.breakdown?.holdings?.raw || 0)}</p>
                            </div>
                            <div className="bg-white p-2 rounded">
                              <span className="text-gray-500">Purchases (25%)</span>
                              <p className="font-medium">{(userData.mojo_breakdown.breakdown?.purchases?.normalized || 0).toFixed(2)} → {(userData.mojo_breakdown.breakdown?.purchases?.weighted || 0).toFixed(2)}</p>
                              <p className="text-gray-400">${(userData.mojo_breakdown.breakdown?.purchases?.raw || 0).toFixed(2)}</p>
                            </div>
                            <div className="bg-white p-2 rounded">
                              <span className="text-gray-500">Check-ins (15%)</span>
                              <p className="font-medium">{(userData.mojo_breakdown.breakdown?.checkIns?.normalized || 0).toFixed(2)} → {(userData.mojo_breakdown.breakdown?.checkIns?.weighted || 0).toFixed(2)}</p>
                              <p className="text-gray-400">{userData.mojo_breakdown.breakdown?.checkIns?.raw || 0}/100 days</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Neynar Score</label>
                        <p className={`font-medium ${
                          parseFloat(userData.neynar_score) >= 0.8 ? 'text-green-600' : 
                          parseFloat(userData.neynar_score) >= 0.5 ? 'text-yellow-600' : 
                          userData.neynar_score ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {userData.neynar_score !== null && userData.neynar_score !== undefined 
                            ? parseFloat(userData.neynar_score).toFixed(2) 
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Quotient Score</label>
                        <p className={`font-medium ${
                          parseFloat(userData.quotient_score) >= 0.9 ? 'text-purple-600' :
                          parseFloat(userData.quotient_score) >= 0.8 ? 'text-blue-600' : 
                          parseFloat(userData.quotient_score) >= 0.75 ? 'text-green-600' : 
                          parseFloat(userData.quotient_score) >= 0.6 ? 'text-yellow-600' : 
                          parseFloat(userData.quotient_score) >= 0.5 ? 'text-orange-600' : 
                          userData.quotient_score ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {userData.quotient_score !== null && userData.quotient_score !== undefined 
                            ? parseFloat(userData.quotient_score).toFixed(2) 
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Bankr Club</label>
                        <p className={`font-medium ${userData.bankr_club_member ? 'text-green-600' : 'text-gray-600'}`}>
                          {userData.bankr_club_member ? '✅ Member' : '❌ Not Member'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">X Username</label>
                        <p className="text-gray-900">
                          {userData.x_username ? (
                            <span 
                              onClick={() => openXProfile(userData.x_username)}
                              className="text-blue-600 hover:text-blue-800 cursor-pointer"
                            >
                              {userData.x_username}
                            </span>
                          ) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Notifications */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3">Notifications</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Status</label>
                        <p className={`font-medium ${userData.has_notifications ? 'text-green-600' : 'text-gray-600'}`}>
                          {userData.has_notifications ? '🔔 Enabled' : '🔕 Disabled'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Source</label>
                        <p className="text-gray-900">{userData.notification_status_source || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats - Updated to include streak */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {userData.leaderboard.total_points.toLocaleString()}
                      </div>
                      <div className="text-sm text-blue-600">Total Points</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {userData.orderStats.total_orders}
                      </div>
                      <div className="text-sm text-green-600">Total Orders</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {formatCurrency(userData.orderStats.total_spent)}
                      </div>
                      <div className="text-sm text-purple-600">Total Spent</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {userData.leaderboard.checkin_streak}
                      </div>
                      <div className="text-sm text-orange-600">Day Streak</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {formatTokenBalance(userData.token_balance)}
                      </div>
                      <div className="text-sm text-yellow-600">Total $MINTEDMERCH</div>
                    </div>
                  </div>

                  {/* Token Holdings Breakdown */}
                  {userData.token_balance > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3">Token Holdings Breakdown</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Wallet Balance</label>
                          <p className="text-xl font-bold text-green-600">{formatTokenBalance(userData.wallet_balance || 0)}</p>
                          <p className="text-xs text-gray-500">Tokens in user wallets</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Staked Balance</label>
                          <p className="text-xl font-bold text-purple-600">{formatTokenBalance(userData.staked_balance || 0)}</p>
                          <p className="text-xs text-gray-500">Tokens in staking contract</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Total Holdings:</span>
                          <span className="text-xl font-bold text-yellow-600">{formatTokenBalance(userData.token_balance || 0)}</span>
                        </div>
                        {userData.token_balance_updated_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Last updated: {formatDate(userData.token_balance_updated_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'wallets' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Wallet Addresses</h3>
                  
                  {/* Custody Address */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Custody Address</h4>
                    <div className="flex items-center">
                      <div className="font-mono text-sm bg-white p-2 rounded border flex-1">
                        {userData.walletAddresses.custody || 'N/A'}
                      </div>
                      {userData.walletAddresses.custody && (
                        <CopyButton text={userData.walletAddresses.custody} label="custody address" />
                      )}
                    </div>
                  </div>

                  {/* Primary Addresses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Primary Ethereum</h4>
                      <div className="flex items-center">
                        <div className="font-mono text-sm bg-white p-2 rounded border flex-1">
                          {userData.walletAddresses.primary_eth || 'N/A'}
                        </div>
                        {userData.walletAddresses.primary_eth && (
                          <CopyButton text={userData.walletAddresses.primary_eth} label="primary Ethereum address" />
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Primary Solana</h4>
                      <div className="flex items-center">
                        <div className="font-mono text-sm bg-white p-2 rounded border flex-1">
                          {userData.walletAddresses.primary_sol || 'N/A'}
                        </div>
                        {userData.walletAddresses.primary_sol && (
                          <CopyButton text={userData.walletAddresses.primary_sol} label="primary Solana address" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Verified Addresses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Verified Ethereum Addresses</h4>
                      <div className="space-y-1">
                        {userData.walletAddresses.verified_eth.length > 0 ? (
                          userData.walletAddresses.verified_eth.map((addr, index) => (
                            <div key={index} className="flex items-center">
                              <div className="font-mono text-sm bg-white p-2 rounded border flex-1">
                                {addr}
                              </div>
                              <CopyButton text={addr} label="verified Ethereum address" />
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-500 text-sm">No verified Ethereum addresses</div>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Verified Solana Addresses</h4>
                      <div className="space-y-1">
                        {userData.walletAddresses.verified_sol.length > 0 ? (
                          userData.walletAddresses.verified_sol.map((addr, index) => (
                            <div key={index} className="flex items-center">
                              <div className="font-mono text-sm bg-white p-2 rounded border flex-1">
                                {addr}
                              </div>
                              <CopyButton text={addr} label="verified Solana address" />
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-500 text-sm">No verified Solana addresses</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bankr Wallet Addresses */}
                  {(userData.walletAddresses.bankr_evm_address || userData.walletAddresses.bankr_solana_address) && (
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center mb-3">
                        <h4 className="font-medium text-purple-800">🏦 Bankr Wallet Addresses</h4>
                        {userData.walletAddresses.bankr_account_id && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            ID: {userData.walletAddresses.bankr_account_id}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {userData.walletAddresses.bankr_evm_address && (
                          <div>
                            <div className="text-xs text-purple-600 mb-1 font-medium">Bankr EVM Address</div>
                            <div className="flex items-center">
                              <div className="font-mono text-sm bg-white p-2 rounded border border-purple-200 flex-1">
                                {userData.walletAddresses.bankr_evm_address}
                              </div>
                              <CopyButton text={userData.walletAddresses.bankr_evm_address} label="Bankr EVM address" />
                            </div>
                          </div>
                        )}
                        
                        {userData.walletAddresses.bankr_solana_address && (
                          <div>
                            <div className="text-xs text-purple-600 mb-1 font-medium">Bankr Solana Address</div>
                            <div className="flex items-center">
                              <div className="font-mono text-sm bg-white p-2 rounded border border-purple-200 flex-1">
                                {userData.walletAddresses.bankr_solana_address}
                              </div>
                              <CopyButton text={userData.walletAddresses.bankr_solana_address} label="Bankr Solana address" />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {userData.walletAddresses.bankr_wallet_data_updated_at && (
                        <div className="text-xs text-purple-600 mt-2">
                          Last updated: {formatDate(userData.walletAddresses.bankr_wallet_data_updated_at)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Connected Wallets (dGEN1/Web3Modal) */}
                  {userData.walletAddresses.connected_eth?.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center mb-3">
                        <h4 className="font-medium text-blue-800">🤖 dGEN1 Wallet</h4>
                      </div>
                      
                      <div className="space-y-2">
                        {userData.walletAddresses.connected_eth.map((addr, index) => (
                          <div key={index}>
                            <div className="text-xs text-blue-600 mb-1 font-medium">Ethereum Address #{index + 1}</div>
                            <div className="flex items-center">
                              <div className="font-mono text-sm bg-white p-2 rounded border border-blue-200 flex-1">
                                {addr}
                              </div>
                              <CopyButton text={addr} label="dGEN1 wallet address" />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="text-xs text-blue-600 mt-2">
                        Connected via dGEN1 device or Web3Modal
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Order History</h3>
                    <div className="text-sm text-gray-600">
                      {userData.orderStats.total_orders} total orders • {formatCurrency(userData.orderStats.total_spent)} spent
                    </div>
                  </div>

                  <div className="space-y-3">
                    {userData.recentOrders.length > 0 ? (
                      userData.recentOrders.map((order) => (
                        <div key={order.id} className="bg-gray-50 rounded-lg p-4">
                                                      <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-medium">{order.order_id}</div>
                                <div className="text-sm text-gray-600">{formatDate(order.created_at)}</div>
                              </div>
                            <div className="text-right">
                              <div className="font-medium">{formatCurrency(order.amount_total)}</div>
                              <div className={`text-sm px-2 py-1 rounded ${
                                                              order.status === 'paid' ? 'bg-green-100 text-green-800' :
                              order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'vendor_paid' ? 'bg-teal-100 text-teal-800' :
                              order.status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {order.status === 'vendor_paid' ? 'Vendor Paid' : order.status}
                              </div>
                            </div>
                          </div>
                          
                          {/* Products */}
                          {order.order_items && order.order_items.length > 0 && (
                            <div className="mt-3 border-t pt-3">
                              <h5 className="text-sm font-medium mb-2">Products:</h5>
                              <div className="space-y-2">
                                {order.order_items.map((item, index) => {
                                  const productImage = item.product_data?.images?.[0]?.src || item.product_data?.image?.src;
                                  return (
                                    <div key={index} className="flex items-center space-x-3">
                                      {productImage && (
                                        <img 
                                          src={productImage} 
                                          alt={item.product_title}
                                          className="w-10 h-10 object-cover rounded"
                                        />
                                      )}
                                      <div className="flex-1">
                                        <div className="text-sm font-medium">{item.product_title}</div>
                                        {item.variant_title && item.variant_title !== 'Default Title' && (
                                          <div className="text-xs text-gray-600">{item.variant_title}</div>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        Qty: {item.quantity}
                                      </div>
                                      <div className="text-sm font-medium">
                                        {formatCurrency(item.price)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {order.discount_code && (
                            <div className="text-sm text-green-600 mt-2">
                              Discount: {order.discount_code} (-{formatCurrency(order.discount_amount)})
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-8">No orders found</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'discounts' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Discount Codes</h3>
                  
                  {/* Discount Usage */}
                  <div>
                    <h4 className="font-medium mb-3">Used Discount Codes</h4>
                    <div className="space-y-2">
                      {userData.discountUsage.length > 0 ? (
                        userData.discountUsage.map((usage, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium">{usage.discount_codes?.code || 'N/A'}</div>
                                <div className="text-sm text-gray-600">
                                  {usage.discount_codes?.code_type} • {formatDate(usage.used_at)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-green-600">
                                  -{formatCurrency(usage.discount_amount)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {usage.discount_codes?.discount_type === 'percentage' ? 
                                    `${usage.discount_codes?.discount_value}% off` : 
                                    `${formatCurrency(usage.discount_codes?.discount_value)} off`
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-4">No discount codes used</div>
                      )}
                    </div>
                  </div>

                  {/* Owned Discount Codes */}
                  <div>
                    <h4 className="font-medium mb-3">Owned Discount Codes</h4>
                    <div className="space-y-2">
                      {userData.userDiscountCodes.length > 0 ? (
                        userData.userDiscountCodes.map((code, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium">{code.code}</div>
                                <div className="text-sm text-gray-600">
                                  {code.code_type} • Created {formatDate(code.created_at)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-sm px-2 py-1 rounded ${
                                  code.is_used ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {code.is_used ? 'Used' : 'Available'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-4">No discount codes owned</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'points' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Points & Leaderboard</h3>
                  
                  {/* Points Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {userData.leaderboard.total_points.toLocaleString()}
                      </div>
                      <div className="text-sm text-blue-600">Total Points</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {userData.leaderboard.points_from_checkins.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-600">Check-in Points</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {userData.leaderboard.points_from_purchases.toLocaleString()}
                      </div>
                      <div className="text-sm text-purple-600">Purchase Points</div>
                    </div>
                    <div className="bg-pink-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-pink-600">
                        {(userData.leaderboard.points_from_mints || 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-pink-600">Mint Points</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {userData.leaderboard.checkin_streak}
                      </div>
                      <div className="text-sm text-orange-600">Day Streak</div>
                    </div>
                  </div>

                  {/* Recent Point Transactions */}
                  <div>
                    <h4 className="font-medium mb-3">Recent Point Transactions</h4>
                    <div className="space-y-2">
                      {userData.recentPointTransactions.length > 0 ? (
                        userData.recentPointTransactions.map((transaction) => (
                          <div key={transaction.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium">
                                  {transaction.transaction_type === 'daily_checkin' ? '📅 Daily Check-in' :
                                   transaction.transaction_type === 'purchase' ? '🛍️ Purchase' :
                                   transaction.transaction_type === 'bonus' ? '🎁 Bonus' :
                                   transaction.transaction_type === 'nft_mint' ? '🎨 NFT Mint' :
                                   '⚙️ Adjustment'}
                                </div>
                                <div className="text-sm text-gray-600">{formatDate(transaction.created_at)}</div>
                                {transaction.description && (
                                  <div className="text-sm text-gray-600">{transaction.description}</div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-green-600">
                                  +{transaction.points_earned.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {transaction.points_before.toLocaleString()} → {transaction.points_after.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-4">No point transactions found</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'raffles' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Raffle Wins</h3>
                  
                  <div className="space-y-3">
                    {userData.raffleWins.length > 0 ? (
                      userData.raffleWins.map((win) => (
                        <div key={win.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">
                                🏆 Position #{win.winner_position}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {win.raffle_winners?.raffle_criteria}
                              </div>
                              <div className="text-sm text-gray-600">
                                {formatDate(win.raffle_winners?.raffle_timestamp)}
                              </div>
                            </div>
                            <div className="text-right text-sm text-gray-600">
                              {win.raffle_winners?.total_winners} winners from {win.raffle_winners?.total_eligible_users} eligible
                            </div>
                          </div>
                          <div className="mt-3 text-sm text-gray-600">
                            Stats at time of win: {win.total_points?.toLocaleString()} points • {win.checkin_streak} day streak
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <div className="text-4xl mb-2">🎲</div>
                        <div>No raffle wins yet</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'missions' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">🎯 Minted Merch Missions</h3>
                  
                  {/* Mission Stats - Based on payout status */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {userData.missions?.filter(m => m.payout?.status === 'completed').length || 0}
                      </div>
                      <div className="text-sm text-green-600">Completed</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {userData.missions?.filter(m => m.payout?.status === 'claimable').length || 0}
                      </div>
                      <div className="text-sm text-yellow-600">Claimable</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {formatTokenBalance(userData.missionStats?.totalEarned || 0)}
                      </div>
                      <div className="text-sm text-purple-600">Tokens Earned</div>
                    </div>
                  </div>

                  {/* Missions List */}
                  <div>
                    <h4 className="font-medium mb-3">Mission History</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {userData.missions && userData.missions.length > 0 ? (
                        userData.missions.map((mission) => (
                          <div key={mission.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium">{mission.bounty?.title || 'Bounty'}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {mission.bounty?.bounty_type === 'farcaster_like' && '👍 Like'}
                                  {mission.bounty?.bounty_type === 'farcaster_recast' && '🔄 Recast'}
                                  {mission.bounty?.bounty_type === 'farcaster_comment' && '💬 Comment'}
                                  {mission.bounty?.bounty_type === 'farcaster_like_recast' && '⚡ Like & Recast'}
                                  {mission.bounty?.bounty_type === 'farcaster_engagement' && '🔥 Full Engagement'}
                                  {mission.bounty?.bounty_type === 'custom' && '📝 Custom Bounty'}
                                  {!['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_like_recast', 'farcaster_engagement', 'custom'].includes(mission.bounty?.bounty_type) && `📋 ${mission.bounty?.bounty_type || 'Unknown'}`}
                                </div>
                                {mission.proof_url && (
                                  <a 
                                    href={mission.proof_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline mt-1 block"
                                  >
                                    View Proof →
                                  </a>
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  Submitted: {formatDate(mission.submitted_at)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-green-600">
                                  +{(mission.bounty?.reward_tokens || 0).toLocaleString()}
                                </div>
                                {/* Show PAYOUT status, not submission status */}
                                <div className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                                  mission.payout?.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  mission.payout?.status === 'claimable' ? 'bg-yellow-100 text-yellow-800' :
                                  mission.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                  mission.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                                  mission.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {mission.payout?.status === 'completed' ? 'Completed' :
                                   mission.payout?.status === 'claimable' ? 'Claimable' :
                                   mission.status === 'approved' ? 'Approved' :
                                   mission.status}
                                </div>
                              </div>
                            </div>
                            
                            {/* Transaction Link for completed payouts */}
                            {mission.payout?.transaction_hash && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <a 
                                  href={`https://basescan.org/tx/${mission.payout.transaction_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  View Transaction →
                                </a>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          <div className="text-4xl mb-2">🎯</div>
                          <div>No missions completed yet</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'partner' && userData?.partner && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">🤝 Partner Dashboard</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      userData.partner.partner_type === 'collab' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {userData.partner.partner_type === 'collab' ? '👑 Collab Partner' : '📦 Fulfillment Partner'}
                    </span>
                  </div>
                  
                  {/* Partner Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium mb-3">Partner Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Name:</span>
                        <div className="font-medium">{userData.partner.name}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Email:</span>
                        <div className="font-medium">{userData.partner.email || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <div className={`font-medium ${userData.partner.is_active ? 'text-green-600' : 'text-red-600'}`}>
                          {userData.partner.is_active ? '✅ Active' : '❌ Inactive'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Joined:</span>
                        <div className="font-medium">{formatDate(userData.partner.created_at)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Partner Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {userData.partnerOrders?.length || 0}
                      </div>
                      <div className="text-sm text-blue-600">Total Assigned</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {userData.partnerOrders?.filter(o => o.status === 'assigned' || o.status === 'shipped').length || 0}
                      </div>
                      <div className="text-sm text-yellow-600">Pending</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {userData.partnerOrders?.filter(o => o.status === 'payment_processing').length || 0}
                      </div>
                      <div className="text-sm text-orange-600">Processing</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {userData.partnerOrders?.filter(o => o.status === 'vendor_paid').length || 0}
                      </div>
                      <div className="text-sm text-green-600">Paid</div>
                    </div>
                    <div className="bg-teal-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-teal-600">
                        {formatCurrency(userData.partnerOrders?.reduce((sum, o) => sum + (parseFloat(o.vendor_payout_amount) || 0), 0) || 0)}
                      </div>
                      <div className="text-sm text-teal-600">Total Paid</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className={`text-2xl font-bold ${
                        (userData.partnerOrders?.filter(o => o.status === 'payment_processing').reduce((sum, o) => sum + (parseFloat(o.vendor_payout_estimated) || 0), 0) || 0) < 0 
                          ? 'text-red-600' 
                          : 'text-yellow-600'
                      }`}>
                        ~{formatCurrency(userData.partnerOrders?.filter(o => o.status === 'payment_processing').reduce((sum, o) => sum + (parseFloat(o.vendor_payout_estimated) || 0), 0) || 0)}
                      </div>
                      <div className="text-sm text-yellow-600">Est. Processing</div>
                    </div>
                  </div>

                  {/* Assigned Orders */}
                  <div>
                    <h4 className="font-medium mb-3">Assigned Orders</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {userData.partnerOrders && userData.partnerOrders.length > 0 ? (
                        userData.partnerOrders.map((order) => (
                          <div key={order.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="font-medium">{order.order_id}</div>
                                <div className="text-xs text-gray-500 space-y-0.5">
                                  <div>📋 Assigned: {formatDate(order.assigned_at)}</div>
                                  {order.shipped_at && (
                                    <div>📦 Shipped: {formatDate(order.shipped_at)}</div>
                                  )}
                                  {order.payment_processing_at && (
                                    <div>⏳ Processing: {formatDate(order.payment_processing_at)}</div>
                                  )}
                                  {order.vendor_paid_at && (
                                    <div>💰 Paid: {formatDate(order.vendor_paid_at)}</div>
                                  )}
                                </div>
                                {order.profiles && (
                                  <div className="text-sm text-gray-600 mt-1">
                                    Customer: @{order.profiles.username}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{formatCurrency(order.amount_total)}</div>
                                <select
                                  value={order.status}
                                  onChange={(e) => handleAssignmentStatusChange(order.order_id, order.assignment_id, e.target.value, order.status)}
                                  disabled={updatingOrder === order.order_id}
                                  className={`mt-1 text-sm px-2 py-1 rounded border cursor-pointer ${
                                    order.status === 'assigned' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                    order.status === 'shipped' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                    order.status === 'payment_processing' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                    order.status === 'vendor_paid' ? 'bg-teal-100 text-teal-800 border-teal-300' :
                                    'bg-gray-100 text-gray-800 border-gray-300'
                                  }`}
                                >
                                  <option value="assigned">Assigned</option>
                                  <option value="shipped">Shipped</option>
                                  <option value="payment_processing">Payment Processing</option>
                                  <option value="vendor_paid">Vendor Paid</option>
                                </select>
                              </div>
                            </div>
                            
                            {/* Order Items */}
                            {order.order_items && order.order_items.length > 0 && (
                              <div className="border-t pt-2 mt-2">
                                <div className="text-xs text-gray-500 mb-1">Items:</div>
                                {order.order_items.map((item, idx) => (
                                  <div key={idx} className="text-sm text-gray-700">
                                    {item.product_title} × {item.quantity}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Estimated Payout (payment_processing) */}
                            {order.vendor_payout_estimated && order.status === 'payment_processing' && (
                              <div className={`border-t pt-2 mt-2 ${parseFloat(order.vendor_payout_estimated) < 0 ? 'bg-red-50' : 'bg-yellow-50'} -mx-4 -mb-4 px-4 py-2 rounded-b-lg`}>
                                <div className="flex justify-between items-center">
                                  <span className={`text-sm ${parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-700' : 'text-yellow-700'}`}>Est. Payout:</span>
                                  <span className={`font-bold ${parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-700' : 'text-yellow-700'}`}>
                                    ~{formatCurrency(order.vendor_payout_estimated)}
                                  </span>
                                </div>
                                {order.vendor_payout_internal_notes && (
                                  <div className={`text-xs text-gray-600 mt-1 pt-1 border-t ${parseFloat(order.vendor_payout_estimated) < 0 ? 'border-red-200' : 'border-yellow-200'}`}>
                                    <span className="font-medium">📝 Internal:</span> {order.vendor_payout_internal_notes}
                                  </div>
                                )}
                                {order.vendor_payout_partner_notes && (
                                  <div className={`text-xs ${parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-700' : 'text-yellow-700'} mt-1`}>
                                    <span className="font-medium">👤 Partner:</span> {order.vendor_payout_partner_notes}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Final Payout (vendor_paid) */}
                            {order.vendor_payout_amount && (
                              <div className={`border-t pt-2 mt-2 ${parseFloat(order.vendor_payout_amount) < 0 ? 'bg-red-50' : 'bg-teal-50'} -mx-4 -mb-4 px-4 py-2 rounded-b-lg`}>
                                <div className="flex justify-between items-center">
                                  <span className={`text-sm ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-700' : 'text-teal-700'}`}>Final Payout:</span>
                                  <span className={`font-bold ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-700' : 'text-teal-700'}`}>
                                    {formatCurrency(order.vendor_payout_amount)}
                                  </span>
                                </div>
                                {order.vendor_paid_at && (
                                  <div className={`text-xs ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-600' : 'text-teal-600'} mt-1`}>
                                    Paid: {formatDate(order.vendor_paid_at)}
                                  </div>
                                )}
                                {order.vendor_payout_internal_notes && (
                                  <div className={`text-xs text-gray-600 mt-1 pt-1 border-t ${parseFloat(order.vendor_payout_amount) < 0 ? 'border-red-200' : 'border-teal-200'}`}>
                                    <span className="font-medium">📝 Internal:</span> {order.vendor_payout_internal_notes}
                                  </div>
                                )}
                                {order.vendor_payout_partner_notes && (
                                  <div className={`text-xs ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-700' : 'text-teal-700'} mt-1`}>
                                    <span className="font-medium">👤 Partner:</span> {order.vendor_payout_partner_notes}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Tracking Info */}
                            {order.tracking_number && (
                              <div className="border-t pt-2 mt-2 text-sm">
                                <span className="text-gray-500">Tracking:</span> {order.tracking_number}
                                {order.carrier && <span className="text-gray-400 ml-2">({order.carrier})</span>}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          <div className="text-4xl mb-2">📦</div>
                          <div>No orders assigned yet</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vendor Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              {payoutModalType === 'estimated' ? '⏳ Set Payment Processing' : '💰 Record Final Payout'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {payoutModalType === 'estimated' 
                ? <>Set an estimated payout for order <strong>{payoutOrderId}</strong>. Partner will see this but won&apos;t be notified until final payout.</>
                : <>Enter the final payout details for order <strong>{payoutOrderId}</strong>. Partner will be notified.</>
              }
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {payoutModalType === 'estimated' ? 'Estimated Payout Amount ($)' : 'Final Payout Amount ($)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="0.00 (negative for amounts owed)"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${
                    payoutModalType === 'estimated' ? 'focus:ring-yellow-500' : 'focus:ring-teal-500'
                  }`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use negative values if partner owes money (e.g., giveaways)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📝 Internal Notes <span className="text-gray-400 font-normal">(admin only)</span>
                </label>
                <textarea
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="Payment method, transaction ID, internal tracking..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  👤 Partner Notes <span className="text-gray-400 font-normal">(visible to partner)</span>
                </label>
                <textarea
                  value={payoutPartnerNotes}
                  onChange={(e) => setPayoutPartnerNotes(e.target.value)}
                  placeholder="Message for the partner about this payout..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowPayoutModal(false);
                  setPayoutOrderId(null);
                  setPayoutModalType('final');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={submitVendorPayout}
                disabled={updatingOrder === payoutOrderId || (payoutModalType === 'final' && !payoutAmount)}
                className={`px-4 py-2 text-white rounded-md disabled:opacity-50 ${
                  payoutModalType === 'estimated' 
                    ? 'bg-yellow-600 hover:bg-yellow-700' 
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {updatingOrder === payoutOrderId 
                  ? 'Saving...' 
                  : payoutModalType === 'estimated' 
                    ? 'Set Payment Processing' 
                    : 'Mark as Vendor Paid'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 