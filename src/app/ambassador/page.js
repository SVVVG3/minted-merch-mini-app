'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcaster } from '@/lib/useFarcaster';

export default function AmbassadorDashboard() {
  const { user, isSDKReady } = useFarcaster();
  const [loading, setLoading] = useState(true);
  const [isAmbassador, setIsAmbassador] = useState(false);
  const [profile, setProfile] = useState(null);
  const [bounties, setBounties] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [activeTab, setActiveTab] = useState('bounties'); // 'bounties', 'submissions', 'payouts'
  const [selectedBounty, setSelectedBounty] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Check ambassador status and load data
  useEffect(() => {
    console.log('🔄 Ambassador Dashboard: useEffect triggered', { isSDKReady, userFid: user?.fid });
    
    // Try to load immediately if we have a session token, don't wait for SDK
    const token = localStorage.getItem('fc_session_token');
    if (token && user?.fid) {
      console.log('⚡ Ambassador Dashboard: Fast path - token exists, loading immediately');
      checkAmbassadorStatus();
      return;
    }
    
    // Fallback: wait for SDK to be ready
    if (isSDKReady && user?.fid) {
      console.log('🐌 Ambassador Dashboard: Slow path - waiting for SDK ready');
      checkAmbassadorStatus();
    }
  }, [isSDKReady, user]);

  const checkAmbassadorStatus = async () => {
    try {
      console.log('🔍 Ambassador Dashboard: Starting status check...');
      setLoading(true);
      setError('');

      // Get existing session token (user is already authenticated)
      const token = localStorage.getItem('fc_session_token');
      console.log('🔑 Ambassador Dashboard: Token exists?', !!token);
      
      if (!token) {
        console.error('❌ Ambassador Dashboard: No token found!');
        setError('Authentication required. Please sign in again.');
        setLoading(false);
        return;
      }

      // Check ambassador status
      console.log('📡 Ambassador Dashboard: Checking status...');
      const statusResponse = await fetch('/api/ambassador/check-status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('📊 Ambassador Dashboard: Status response:', statusResponse.status);
      const statusData = await statusResponse.json();
      console.log('📦 Ambassador Dashboard: Status data:', statusData);

      if (!statusData.success || !statusData.isAmbassador) {
        setIsAmbassador(false);
        setError('You are not registered as an ambassador.');
        setLoading(false);
        return;
      }

      console.log('✅ Ambassador Dashboard: User is confirmed ambassador');
      setIsAmbassador(true);

      // Load all ambassador data
      console.log('📥 Ambassador Dashboard: Loading profile data...');
      await Promise.all([
        loadProfile(token),
        loadBounties(token),
        loadSubmissions(token),
        loadPayouts(token),
      ]);

      console.log('✅ Ambassador Dashboard: All data loaded successfully');
      setLoading(false);
    } catch (error) {
      console.error('❌ Ambassador Dashboard: Error during status check:', error);
      setError('Failed to load ambassador data. Please try again.');
      setLoading(false);
    }
  };

  const loadProfile = async (token) => {
    try {
      const response = await fetch('/api/ambassador/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadBounties = async (token) => {
    try {
      const response = await fetch('/api/ambassador/bounties', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log('📋 Bounties API response:', data);
      if (data.success) {
        setBounties(data.data || []);
        console.log('✅ Loaded bounties:', data.data?.length || 0);
      }
    } catch (error) {
      console.error('Error loading bounties:', error);
    }
  };

  const loadSubmissions = async (token) => {
    try {
      const response = await fetch('/api/ambassador/submissions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setSubmissions(data.data || []);
        console.log('✅ Loaded submissions:', data.data?.length || 0);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
    }
  };

  const loadPayouts = async (token) => {
    try {
      const response = await fetch('/api/ambassador/payouts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setPayouts(data.data || []);
        console.log('✅ Loaded payouts:', data.data?.length || 0);
      }
    } catch (error) {
      console.error('Error loading payouts:', error);
    }
  };

  const handleRefresh = async () => {
    await checkAmbassadorStatus();
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3eb489] mx-auto mb-4"></div>
          <div className="text-gray-600">Loading ambassador dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !isAmbassador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            {error || 'You are not registered as an ambassador.'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Want to become an ambassador? Apply through the Merch Mogul section in the app!
          </p>
          <button
            onClick={() => sdk.actions.close()}
            className="bg-[#3eb489] hover:bg-[#359970] text-white px-6 py-2 rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                try {
                  window.history.back();
                } catch (e) {
                  window.location.href = '/';
                }
              }}
              className="hover:opacity-80 transition-opacity cursor-pointer"
              title="Back to shop"
            >
              <img 
                src="/MintedMerchHeaderLogo.png" 
                alt="Minted Merch"
                className="h-12 w-auto"
              />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 mx-4 text-center flex-1">
              Ambassador Dashboard
            </h1>
            <button
              onClick={handleRefresh}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm flex-shrink-0"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Profile Stats */}
          {profile && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium mb-1">Total Earned</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatNumber(profile.total_earned_tokens)} 🪙
                </div>
                <div className="text-xs text-green-600 mt-1">$mintedmerch tokens</div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium mb-1">Bounties Completed</div>
                <div className="text-2xl font-bold text-gray-900">
                  {profile.total_bounties_completed}
                </div>
                <div className="text-xs text-blue-600 mt-1">Approved submissions</div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium mb-1">Active Bounties</div>
                <div className="text-2xl font-bold text-gray-900">
                  {bounties.length}
                </div>
                <div className="text-xs text-purple-600 mt-1">Available to complete</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-t-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('bounties')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'bounties'
                    ? 'border-[#3eb489] text-[#3eb489]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🎯 Active Bounties ({bounties.length})
              </button>
              <button
                onClick={() => setActiveTab('submissions')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'submissions'
                    ? 'border-[#3eb489] text-[#3eb489]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📝 My Submissions ({submissions.length})
              </button>
              <button
                onClick={() => setActiveTab('payouts')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'payouts'
                    ? 'border-[#3eb489] text-[#3eb489]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                💰 Payouts ({payouts.length})
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'bounties' && (
              <BountiesTab
                bounties={bounties}
                onSelectBounty={setSelectedBounty}
              />
            )}
            {activeTab === 'submissions' && (
              <SubmissionsTab submissions={submissions} />
            )}
            {activeTab === 'payouts' && (
              <PayoutsTab payouts={payouts} />
            )}
          </div>
        </div>
      </div>

      {/* Submit Bounty Modal */}
      {selectedBounty && (
        <SubmitBountyModal
          bounty={selectedBounty}
          onClose={() => setSelectedBounty(null)}
          onSuccess={async () => {
            setSelectedBounty(null);
            await handleRefresh();
          }}
        />
      )}
    </div>
  );
}

// Bounties Tab Component
function BountiesTab({ bounties, onSelectBounty }) {
  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No expiration';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  const isFull = (bounty) => {
    return bounty.current_completions >= bounty.max_completions;
  };

  const isLimitReached = (bounty) => {
    if (!bounty.max_submissions_per_ambassador) return false;
    return bounty.user_submissions_count >= bounty.max_submissions_per_ambassador;
  };

  const canSubmit = (bounty) => {
    return !isExpired(bounty.expires_at) && !isFull(bounty) && !isLimitReached(bounty);
  };

  if (bounties.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎯</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Bounties</h3>
        <p className="text-gray-600">Check back later for new bounty opportunities!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bounties.map((bounty) => {
        const availableSlots = bounty.max_completions - bounty.current_completions;
        const submittable = canSubmit(bounty);

        return (
          <div
            key={bounty.id}
            className={`border rounded-lg p-6 ${
              submittable
                ? 'border-gray-200 bg-white hover:border-[#3eb489] hover:shadow-md transition-all'
                : 'border-gray-200 bg-gray-50 opacity-75'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start gap-3">
                  {bounty.image_url && (
                    <img
                      src={bounty.image_url}
                      alt={bounty.title}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{bounty.title}</h3>
                    {bounty.category && (
                      <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full mb-2">
                        {bounty.category}
                      </span>
                    )}
                    <p className="text-sm text-gray-600 mb-3">{bounty.description}</p>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">Requirements:</span>
                        <span className="text-gray-600">{bounty.requirements}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">Proof needed:</span>
                        <span className="text-gray-600">{bounty.proof_requirements}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sm:text-right space-y-2">
                <div className="bg-green-100 border border-green-300 rounded-lg px-4 py-2">
                  <div className="text-xs text-green-600 font-medium">Reward</div>
                  <div className="text-2xl font-bold text-green-700">
                    {formatNumber(bounty.reward_tokens)} 🪙
                  </div>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <div>
                    <span className="font-medium">Slots:</span> {availableSlots}/{bounty.max_completions} available
                  </div>
                  {bounty.max_submissions_per_ambassador && (
                    <div>
                      <span className="font-medium">Your submissions:</span> {bounty.user_submissions_count}/
                      {bounty.max_submissions_per_ambassador}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Expires:</span> {formatDate(bounty.expires_at)}
                  </div>
                </div>

                <button
                  onClick={() => onSelectBounty(bounty)}
                  disabled={!submittable}
                  className={`w-full sm:w-auto px-6 py-2 rounded-md font-medium text-sm ${
                    submittable
                      ? 'bg-[#3eb489] hover:bg-[#359970] text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isExpired(bounty.expires_at)
                    ? '⏰ Expired'
                    : isFull(bounty)
                    ? '🚫 Full'
                    : isLimitReached(bounty)
                    ? '📊 Limit Reached'
                    : '📤 Submit Proof'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Submissions Tab Component
function SubmissionsTab({ submissions }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'approved':
        return '✅';
      case 'rejected':
        return '❌';
      default:
        return '📝';
    }
  };

  const handleOpenProof = async (url) => {
    try {
      await sdk.actions.openUrl(url);
    } catch (error) {
      console.error('Error opening URL:', error);
      window.open(url, '_blank');
    }
  };

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Submissions Yet</h3>
        <p className="text-gray-600">Start completing bounties to see your submissions here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className="border border-gray-200 rounded-lg p-6 bg-white hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {submission.bounties?.title || 'Bounty'}
                </h3>
                <span
                  className={`inline-block border px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                    submission.status
                  )}`}
                >
                  {getStatusIcon(submission.status)} {submission.status.toUpperCase()}
                </span>
              </div>

              {submission.proof_description && (
                <p className="text-sm text-gray-600 mb-3">{submission.proof_description}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Proof:</span>
                  <button
                    onClick={() => handleOpenProof(submission.proof_url)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    View Submission
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Submitted:</span>
                  <span className="text-gray-600">{formatDate(submission.submitted_at)}</span>
                </div>
                {submission.reviewed_at && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Reviewed:</span>
                    <span className="text-gray-600">{formatDate(submission.reviewed_at)}</span>
                  </div>
                )}
                {submission.admin_notes && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <span className="font-medium text-blue-900 text-xs">Admin Feedback:</span>
                    <p className="text-blue-800 text-sm mt-1">{submission.admin_notes}</p>
                  </div>
                )}
              </div>
            </div>

            {submission.bounties?.reward_tokens && (
              <div className="sm:text-right">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <div className="text-xs text-gray-600 font-medium">Reward</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatNumber(submission.bounties.reward_tokens)} 🪙
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Payouts Tab Component
function PayoutsTab({ payouts }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '💰';
    }
  };

  if (payouts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">💰</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payouts Yet</h3>
        <p className="text-gray-600">Complete bounties to start earning payouts!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {payouts.map((payout) => (
        <div
          key={payout.id}
          className="border border-gray-200 rounded-lg p-6 bg-white hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {payout.bounty_submissions?.bounties?.title || 'Payout'}
                </h3>
                <span
                  className={`inline-block border px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                    payout.status
                  )}`}
                >
                  {getStatusIcon(payout.status)} {payout.status.toUpperCase()}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Amount:</span>
                  <span className="text-green-600 font-bold">
                    {formatNumber(payout.amount_tokens)} 🪙 $mintedmerch
                  </span>
                </div>
                {payout.wallet_address && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Wallet:</span>
                    <span className="text-gray-600 text-xs font-mono">
                      {payout.wallet_address.slice(0, 6)}...{payout.wallet_address.slice(-4)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="text-gray-600">{formatDate(payout.created_at)}</span>
                </div>
                {payout.completed_at && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Completed:</span>
                    <span className="text-gray-600">{formatDate(payout.completed_at)}</span>
                  </div>
                )}
                {payout.transaction_hash && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">TX Hash:</span>
                    <span className="text-blue-600 text-xs font-mono">
                      {payout.transaction_hash.slice(0, 10)}...{payout.transaction_hash.slice(-8)}
                    </span>
                  </div>
                )}
                {payout.notes && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <span className="font-medium text-blue-900 text-xs">Note:</span>
                    <p className="text-blue-800 text-sm mt-1">{payout.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <div className="bg-green-100 border border-green-300 rounded-lg px-4 py-2">
                <div className="text-xs text-green-600 font-medium">Payout</div>
                <div className="text-2xl font-bold text-green-700">
                  {formatNumber(payout.amount_tokens)} 🪙
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Submit Bounty Modal Component
function SubmitBountyModal({ bounty, onClose, onSuccess }) {
  const [proofUrl, setProofUrl] = useState('');
  const [proofDescription, setProofDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!proofUrl.trim()) {
      setError('Please provide a link to your proof.');
      return;
    }

    try {
      setSubmitting(true);

      // Get existing session token (user is already authenticated)
      const token = localStorage.getItem('fc_session_token');
      if (!token) {
        setError('Authentication required. Please refresh the page.');
        setSubmitting(false);
        return;
      }

      // Submit bounty proof
      const response = await fetch('/api/ambassador/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bountyId: bounty.id,
          proofUrl: proofUrl.trim(),
          proofDescription: proofDescription.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to submit bounty proof.');
      }
    } catch (error) {
      console.error('Error submitting bounty:', error);
      setError('Failed to submit bounty proof. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Submit Bounty Proof</h2>
              <p className="text-gray-600">{bounty.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              disabled={submitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Bounty Details */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700">Requirements:</span>
                <p className="text-gray-600 mt-1">{bounty.requirements}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Proof Needed:</span>
                <p className="text-gray-600 mt-1">{bounty.proof_requirements}</p>
              </div>
              <div className="pt-2 border-t border-gray-300">
                <span className="font-medium text-gray-700">Reward:</span>
                <span className="text-green-600 font-bold ml-2">
                  {formatNumber(bounty.reward_tokens)} 🪙 $mintedmerch
                </span>
              </div>
            </div>
          </div>

          {/* Submission Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proof Link <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                placeholder="https://warpcast.com/..."
                disabled={submitting}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Link to your post on Farcaster, X, TikTok, or Instagram
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={proofDescription}
                onChange={(e) => setProofDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                placeholder="Add any additional context about your submission..."
                rows={3}
                disabled={submitting}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-3 rounded-md font-medium disabled:opacity-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-3 rounded-md font-medium disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : '📤 Submit Proof'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

