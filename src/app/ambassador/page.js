'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcaster } from '@/lib/useFarcaster';
import { ProfileModal } from '@/components/ProfileModal';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { triggerHaptic } from '@/lib/haptics';

export default function AmbassadorDashboard() {
  const { user, isSDKReady, isInFarcaster } = useFarcaster();
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
  const [showProfileModal, setShowProfileModal] = useState(false);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="relative flex items-center justify-between">
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="hover:opacity-80 transition-opacity cursor-pointer z-10"
              title="Back to shop"
            >
              <img 
                src="/MintedMerchHeaderLogo.png" 
                alt="Minted Merch"
                className="h-12 w-auto"
              />
            </button>
            <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-bold text-gray-900 whitespace-nowrap">
              Ambassador Dashboard
            </h1>
            <div className="w-[48px]">
              {user?.pfpUrl && (
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="hover:opacity-80 transition-opacity z-10"
                  title="View Profile"
                >
                  <img 
                    src={user.pfpUrl} 
                    alt="Profile"
                    className="w-10 h-10 rounded-full border-2 border-gray-300"
                  />
                </button>
              )}
            </div>
          </div>

          {/* Profile Stats */}
          {profile && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium mb-1">Total Earned</div>
                <div className="text-2xl font-bold text-gray-900 flex items-center gap-1">
                  {formatNumber(profile.total_earned_tokens)} 
                  <img src="/splash.png" alt="Token" className="w-6 h-6 rounded-full inline-block" />
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
            <nav className="-mb-px flex justify-center">
              <button
                onClick={() => setActiveTab('bounties')}
                className={`px-4 py-4 text-xs font-medium border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'bounties'
                    ? 'border-[#3eb489] text-[#3eb489]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>🎯 Bounties</span>
                {bounties.filter(b => b.canSubmit).length > 0 && (
                  <span className="bg-[#3eb489] text-white text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {bounties.filter(b => b.canSubmit).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('submissions')}
                className={`px-4 py-4 text-xs font-medium border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'submissions'
                    ? 'border-[#3eb489] text-[#3eb489]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>📝 Submissions</span>
                {submissions.filter(s => s.status === 'pending' || s.status === 'rejected').length > 0 && (
                  <span className="bg-[#3eb489] text-white text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {submissions.filter(s => s.status === 'pending' || s.status === 'rejected').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('payouts')}
                className={`px-4 py-4 text-xs font-medium border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'payouts'
                    ? 'border-[#3eb489] text-[#3eb489]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>💰 Payouts</span>
                {payouts.filter(p => p.status === 'claimable' || p.status === 'pending' || p.status === 'processing').length > 0 && (
                  <span className="bg-[#3eb489] text-white text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {payouts.filter(p => p.status === 'claimable' || p.status === 'pending' || p.status === 'processing').length}
                  </span>
                )}
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
              <PayoutsTab payouts={payouts} onRefresh={handleRefresh} isInMiniApp={isInFarcaster} />
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

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
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
    return bounty.currentCompletions >= bounty.maxCompletions;
  };

  const isLimitReached = (bounty) => {
    if (!bounty.maxSubmissionsPerAmbassador) return false;
    return bounty.ambassadorSubmissions >= bounty.maxSubmissionsPerAmbassador;
  };

  const canSubmit = (bounty) => {
    return !isExpired(bounty.expiresAt) && !isFull(bounty) && !isLimitReached(bounty);
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
        const availableSlots = bounty.maxCompletions - bounty.currentCompletions;
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
                  {bounty.imageUrl && (
                    <img
                      src={bounty.imageUrl}
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
                        <span className="text-gray-600">{bounty.proofRequirements}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sm:text-right space-y-2">
                <div className="bg-green-100 border border-green-300 rounded-lg px-4 py-2">
                  <div className="text-xs text-green-600 font-medium">Reward</div>
                  <div className="text-2xl font-bold text-green-700 flex items-center gap-1">
                    {formatNumber(bounty.rewardTokens)} 
                    <img src="/splash.png" alt="Token" className="w-6 h-6 rounded-full inline-block" />
                  </div>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <div>
                    <span className="font-medium">Slots:</span> {availableSlots}/{bounty.maxCompletions} available
                  </div>
                  {bounty.maxSubmissionsPerAmbassador && (
                    <div>
                      <span className="font-medium">Your submissions:</span> {bounty.ambassadorSubmissions}/
                      {bounty.maxSubmissionsPerAmbassador}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Expires:</span> {formatDate(bounty.expiresAt)}
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
  const [deleting, setDeleting] = useState(null);

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

  const handleDeleteSubmission = async (submissionId) => {
    if (!confirm('Are you sure you want to delete this rejected submission?')) {
      return;
    }

    try {
      setDeleting(submissionId);
      const token = localStorage.getItem('fc_session_token');
      
      const response = await fetch(`/api/ambassador/submissions/${submissionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh page to update submissions list
        window.location.reload();
      } else {
        alert('Failed to delete submission: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
      alert('Failed to delete submission');
    } finally {
      setDeleting(null);
    }
  };

  // Filter to only show pending and rejected submissions
  const filteredSubmissions = submissions.filter(s => s.status === 'pending' || s.status === 'rejected');

  if (filteredSubmissions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Submissions</h3>
        <p className="text-gray-600">Your approved submissions are shown in the Payouts tab!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredSubmissions.map((submission) => (
        <div
          key={submission.id}
          className="border border-gray-200 rounded-lg p-6 bg-white hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {submission.bounty?.title || 'Bounty'}
                </h3>
                <span
                  className={`inline-block border px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${getStatusBadge(
                    submission.status
                  )}`}
                >
                  {getStatusIcon(submission.status)} {submission.status.toUpperCase()}
                </span>
              </div>

              {submission.proofDescription && (
                <p className="text-sm text-gray-600 mb-3">{submission.proofDescription}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Proof:</span>
                  <button
                    onClick={() => handleOpenProof(submission.proofUrl)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    View Submission
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Submitted:</span>
                  <span className="text-gray-600">{formatDate(submission.submittedAt)}</span>
                </div>
                {submission.reviewedAt && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Reviewed:</span>
                    <span className="text-gray-600">{formatDate(submission.reviewedAt)}</span>
                  </div>
                )}
                {submission.adminNotes && submission.adminNotes.toLowerCase() !== 'approved' && submission.adminNotes.trim() !== '' && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <span className="font-medium text-blue-900 text-xs">Admin Feedback:</span>
                    <p className="text-blue-800 text-sm mt-1">{submission.adminNotes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:text-right flex flex-col gap-2">
              {submission.bounty?.rewardTokens && (
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <div className="text-xs text-gray-600 font-medium">Reward</div>
                  <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                    {formatNumber(submission.bounty.rewardTokens)} 
                    <img src="/splash.png" alt="Token" className="w-5 h-5 rounded-full inline-block" />
                  </div>
                </div>
              )}
              
              {submission.status === 'rejected' && (
                <button
                  onClick={() => handleDeleteSubmission(submission.id)}
                  disabled={deleting === submission.id}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting === submission.id ? 'Deleting...' : '🗑️ Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Payouts Tab Component
function PayoutsTab({ payouts, onRefresh, isInMiniApp }) {
  const [claiming, setClaiming] = useState(null);
  const [claimError, setClaimError] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiOrigin, setConfettiOrigin] = useState({ x: 50, y: 50 }); // Track button position for confetti
  const [claimSuccess, setClaimSuccess] = useState(null); // Track successful claim for button state
  
  // Wagmi hooks for transaction handling (like SpinWheel)
  const { 
    writeContract, 
    data: hash, 
    isPending: isTxPending,
    error: writeError 
  } = useWriteContract();
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({
    hash,
  });

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
      case 'claimable':
        return 'bg-purple-100 text-purple-800 border-purple-300';
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
      case 'claimable':
        return '🎁';
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

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'PENDING';
      case 'claimable':
        return 'CLAIMABLE';
      case 'processing':
        return 'PROCESSING';
      case 'completed':
        return 'CLAIMED';
      case 'failed':
        return 'FAILED';
      default:
        return status.toUpperCase();
    }
  };

  // Watch for transaction confirmation (like SpinWheel)
  useEffect(() => {
    if (isConfirmed && hash && claiming) {
      console.log(`✅ Transaction confirmed! Hash:`, hash);
      
      // Mark payout as completed in backend
      markPayoutComplete(claiming, hash);
    }
  }, [isConfirmed, hash, claiming]);

  const markPayoutComplete = async (payoutId, txHash) => {
    try {
      const token = localStorage.getItem('fc_session_token');
      if (!token) {
        console.error('❌ No auth token for marking payout complete');
        return;
      }
      
      const response = await fetch(`/api/ambassador/payouts/${payoutId}/claim-complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactionHash: txHash })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Payout ${payoutId} marked as complete`);
        
        // DRAMATIC HAPTIC CELEBRATION! Multiple bursts for maximum impact
        triggerHaptic('success', isInMiniApp);
        setTimeout(() => triggerHaptic('heavy', isInMiniApp), 100);
        setTimeout(() => triggerHaptic('heavy', isInMiniApp), 250);
        setTimeout(() => triggerHaptic('medium', isInMiniApp), 400);
        
        // Show confetti celebration!
        setShowConfetti(true);
        setClaimSuccess(payoutId);
        
        // Clear claiming state immediately so button shows success
        setClaiming(null);
        
        // Auto-hide confetti and refresh after 3 seconds
        setTimeout(() => {
          setShowConfetti(false);
          setClaimSuccess(null);
          
          // Refresh payouts list to show TX hash AFTER animation
          if (onRefresh) {
            onRefresh();
          }
        }, 3000);
      } else {
        console.error(`❌ Failed to mark payout complete:`, result.error);
        setClaiming(null);
      }
      
    } catch (error) {
      console.error('❌ Error marking payout complete:', error);
      setClaiming(null);
      setPendingTxHash(null);
    }
  };

  const handleClaimPayout = async (payoutId, event) => {
    try {
      setClaiming(payoutId);
      setClaimError(null);
      
      // Capture button position for confetti origin
      if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        setConfettiOrigin({
          x: (rect.left + rect.width / 2) / window.innerWidth * 100,
          y: (rect.top + rect.height / 2) / window.innerHeight * 100
        });
      }
      
      console.log(`💰 Fetching claim data for payout ${payoutId}`);
      
      // Get authentication token
      const token = localStorage.getItem('fc_session_token');
      if (!token) {
        throw new Error('Not authenticated. Please sign in again.');
      }
      
      // 1. Fetch claim data (req + signature) from backend
      const response = await fetch(`/api/ambassador/payouts/${payoutId}/claim-data`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch claim data');
      }
      
      console.log(`✍️ Claim data fetched for payout ${payoutId}:`, {
        req: result.data.req,
        signatureLength: result.data.signature.length
      });
      
      // Convert string values back to BigInt for contract call
      const reqWithBigInt = {
        uid: result.data.req.uid,
        tokenAddress: result.data.req.tokenAddress,
        expirationTimestamp: BigInt(result.data.req.expirationTimestamp),
        contents: result.data.req.contents.map(content => ({
          recipient: content.recipient,
          amount: BigInt(content.amount)
        }))
      };
      
      console.log(`📝 Prepared airdrop transaction for payout ${payoutId}`);
      
      // 2. Airdrop contract ABI for airdropERC20WithSignature function
      const airdropABI = [
        {
          name: 'airdropERC20WithSignature',
          type: 'function',
          inputs: [
            {
              name: 'req',
              type: 'tuple',
              components: [
                { name: 'uid', type: 'bytes32' },
                { name: 'tokenAddress', type: 'address' },
                { name: 'expirationTimestamp', type: 'uint256' },
                {
                  name: 'contents',
                  type: 'tuple[]',
                  components: [
                    { name: 'recipient', type: 'address' },
                    { name: 'amount', type: 'uint256' }
                  ]
                }
              ]
            },
            { name: 'signature', type: 'bytes' }
          ],
          outputs: []
        }
      ];
      
      // 3. Send transaction via Wagmi (like the spin wheel)
      writeContract({
        address: result.data.contractAddress,
        abi: airdropABI,
        functionName: 'airdropERC20WithSignature',
        args: [reqWithBigInt, result.data.signature]
      });
      
      console.log('📤 writeContract called successfully - waiting for user approval...');
      // Transaction hash will be available in `hash` from useWriteContract
      // Confirmation will be handled by useEffect watching isConfirmed
      
    } catch (error) {
      console.error('❌ Claim preparation failed:', error);
      
      const errorMessage = error.message || 'Failed to prepare claim';
      setClaimError(errorMessage);
      alert(`❌ Claim failed: ${errorMessage}`);
      setClaiming(null);
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
    <>
      {/* Confetti Animation on Successful Claim - DRAMATIC EXPLOSION! */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(200)].map((_, i) => {
            // Random angle and MUCH HIGHER velocity for dramatic explosion
            const angle = (Math.random() * 360) * (Math.PI / 180);
            const velocity = 60 + Math.random() * 100; // 10x more dramatic!
            const duration = 2 + Math.random() * 1.5;
            const size = ['w-2 h-2', 'w-3 h-3', 'w-4 h-4', 'w-5 h-5', 'w-6 h-6'][Math.floor(Math.random() * 5)];
            const colors = ['#3eb489', '#22c55e', '#10b981', '#059669', '#047857', '#fbbf24', '#f59e0b', '#fcd34d', '#14b8a6', '#06b6d4'];
            
            return (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${confettiOrigin.x}%`,
                  top: `${confettiOrigin.y}%`,
                  animation: `confetti-explode ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                  '--tx': `${Math.cos(angle) * velocity}vw`,
                  '--ty': `${Math.sin(angle) * velocity}vh`,
                  animationDelay: `${Math.random() * 0.15}s`,
                  filter: 'drop-shadow(0 0 3px rgba(62, 180, 137, 0.5))'
                }}
              >
                <div 
                  className={`${size} rotate-45`}
                  style={{
                    backgroundColor: colors[Math.floor(Math.random() * colors.length)]
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
      
      {/* Confetti animation keyframes - DRAMATIC EXPLOSION */}
      <style jsx>{`
        @keyframes confetti-explode {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(0);
            opacity: 1;
          }
          20% {
            transform: translate(calc(var(--tx) * 0.2), calc(var(--ty) * 0.2)) rotate(144deg) scale(1.5);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) rotate(1080deg) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
      
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
                  {payout.bounty?.title || 'Payout'}
                </h3>
                <span
                  className={`inline-block border px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${getStatusBadge(
                    payout.status
                  )}`}
                >
                  {getStatusIcon(payout.status)} {getStatusText(payout.status)}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Amount:</span>
                  <span className="text-green-600 font-bold flex items-center gap-1">
                    {formatNumber(payout.amountTokens)} 
                    <img src="/splash.png" alt="Token" className="w-4 h-4 rounded-full inline-block" />
                    $mintedmerch
                  </span>
                </div>
                {payout.proofUrl && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Proof:</span>
                    <button
                      onClick={async () => {
                        try {
                          await sdk.actions.openUrl(payout.proofUrl);
                        } catch (error) {
                          console.error('Error opening proof:', error);
                          window.open(payout.proofUrl, '_blank');
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      View Submission
                    </button>
                  </div>
                )}
                {payout.walletAddress && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Wallet:</span>
                    <span className="text-gray-600 text-xs font-mono">
                      {payout.walletAddress.slice(0, 6)}...{payout.walletAddress.slice(-4)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="text-gray-600">{formatDate(payout.createdAt)}</span>
                </div>
                {payout.completedAt && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Completed:</span>
                    <span className="text-gray-600">{formatDate(payout.completedAt)}</span>
                  </div>
                )}
                {payout.transactionHash && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">TX Hash:</span>
                    <button
                      onClick={async () => {
                        try {
                          await sdk.actions.openUrl(`https://basescan.org/tx/${payout.transactionHash}`);
                        } catch (error) {
                          console.error('Error opening TX Hash:', error);
                          window.open(`https://basescan.org/tx/${payout.transactionHash}`, '_blank');
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs font-mono underline cursor-pointer"
                    >
                      {payout.transactionHash.slice(0, 10)}...{payout.transactionHash.slice(-8)}
                    </button>
                  </div>
                )}
                
                {/* Claim deadline for claimable payouts */}
                {payout.status === 'claimable' && payout.claimDeadline && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-medium text-gray-700">Claim by:</span>
                    <span className="text-gray-600">{formatDate(payout.claimDeadline)}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Claim Button */}
            {payout.status === 'claimable' && (
              <div className="sm:text-right mt-4 sm:mt-0">
                <button
                  onClick={(e) => handleClaimPayout(payout.id, e)}
                  disabled={claiming === payout.id || isConfirming || claimSuccess === payout.id}
                  className={`w-full sm:w-auto font-semibold px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${
                    claimSuccess === payout.id 
                      ? 'bg-green-600 scale-105' 
                      : 'bg-[#3eb489] hover:bg-[#359970]'
                  } text-white`}
                >
                  {claimSuccess === payout.id ? (
                    <>
                      <span className="text-xl">✅</span>
                      <span>Success!</span>
                    </>
                  ) : claiming === payout.id ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{isConfirming ? 'Confirming...' : 'Claiming...'}</span>
                    </>
                  ) : (
                    <>
                      <span>💰</span>
                      <span>Claim Tokens</span>
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  {formatNumber(payout.amountTokens)} tokens • Sign to claim
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
    </>
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
                <p className="text-gray-600 mt-1">{bounty.proofRequirements}</p>
              </div>
              <div className="pt-2 border-t border-gray-300">
                <span className="font-medium text-gray-700">Reward:</span>
                <span className="text-green-600 font-bold ml-2 flex items-center gap-1">
                  {formatNumber(bounty.rewardTokens)} 
                  <img src="/splash.png" alt="Token" className="w-4 h-4 rounded-full inline-block" />
                  $mintedmerch
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
                placeholder="https://farcaster.xyz/..."
                disabled={submitting}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Link to your post on Farcaster (farcaster.xyz), X, TikTok, or Instagram
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

