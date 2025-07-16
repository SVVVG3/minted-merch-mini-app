'use client';

import { useState, useEffect } from 'react';

export default function UserModal({ isOpen, onClose, userFid }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (isOpen && userFid) {
      fetchUserData();
    }
  }, [isOpen, userFid]);

  const fetchUserData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/user-details?fid=${userFid}`);
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

  const truncateAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden">
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
          <div className="flex flex-col h-full max-h-[calc(90vh-80px)]">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 px-6">
              {[
                { id: 'overview', label: 'Overview', icon: '👤' },
                { id: 'wallets', label: 'Wallets', icon: '💳' },
                { id: 'orders', label: 'Orders', icon: '🛍️' },
                { id: 'discounts', label: 'Discounts', icon: '🎫' },
                { id: 'points', label: 'Points', icon: '⭐' },
                { id: 'raffles', label: 'Raffles', icon: '🎲' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 ${
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
                        <p className="text-gray-900">@{userData.username || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Email</label>
                        <p className="text-gray-900">{userData.email || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Joined</label>
                        <p className="text-gray-900">{formatDate(userData.created_at)}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-600">Bio</label>
                        <p className="text-gray-900">{userData.bio || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Bankr Membership */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3">Bankr Club Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Membership</label>
                        <p className={`font-medium ${userData.bankr_club_member ? 'text-green-600' : 'text-gray-600'}`}>
                          {userData.bankr_club_member ? '✅ Active Member' : '❌ Not a Member'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">X Username</label>
                        <p className="text-gray-900">{userData.x_username || 'N/A'}</p>
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

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  </div>
                </div>
              )}

              {activeTab === 'wallets' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Wallet Addresses</h3>
                  
                  {/* Custody Address */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Custody Address</h4>
                    <div className="font-mono text-sm bg-white p-2 rounded border">
                      {userData.walletAddresses.custody || 'N/A'}
                    </div>
                  </div>

                  {/* Primary Addresses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Primary Ethereum</h4>
                      <div className="font-mono text-sm bg-white p-2 rounded border">
                        {userData.walletAddresses.primary_eth || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">Primary Solana</h4>
                      <div className="font-mono text-sm bg-white p-2 rounded border">
                        {userData.walletAddresses.primary_sol || 'N/A'}
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
                            <div key={index} className="font-mono text-sm bg-white p-2 rounded border">
                              {addr}
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
                            <div key={index} className="font-mono text-sm bg-white p-2 rounded border">
                              {addr}
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-500 text-sm">No verified Solana addresses</div>
                        )}
                      </div>
                    </div>
                  </div>
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
                                order.status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {order.status}
                              </div>
                            </div>
                          </div>
                          {order.discount_code && (
                            <div className="text-sm text-green-600">
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 