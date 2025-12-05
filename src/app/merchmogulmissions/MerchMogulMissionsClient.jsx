'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcaster } from '@/lib/useFarcaster';
import { ProfileModal } from '@/components/ProfileModal';
import { triggerHaptic } from '@/lib/haptics';
import Link from 'next/link';

export default function MerchMogulMissions() {
  const { user, isSDKReady, isInFarcaster } = useFarcaster();
  const [loading, setLoading] = useState(true);
  const [isMogul, setIsMogul] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [profile, setProfile] = useState(null);
  const [bounties, setBounties] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState('bounties');
  const [selectedBounty, setSelectedBounty] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Check mogul status and load data
  useEffect(() => {
    const token = localStorage.getItem('fc_session_token');
    if (token && user?.fid) {
      checkMogulStatus();
      return;
    }
    
    if (isSDKReady && user?.fid) {
      checkMogulStatus();
    }
  }, [isSDKReady, user]);

  const checkMogulStatus = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('fc_session_token');
      if (!token) {
        setError('Please sign in with Farcaster');
        setLoading(false);
        return;
      }

      // Fetch bounties - this will check mogul status
      const bountiesResponse = await fetch('/api/mogul/bounties', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const bountiesData = await bountiesResponse.json();

      if (bountiesResponse.status === 403) {
        // Not a mogul
        setIsMogul(false);
        setTokenBalance(bountiesData.tokenBalance || 0);
        setLoading(false);
        return;
      }

      if (!bountiesData.success) {
        setError(bountiesData.error || 'Failed to load data');
        setLoading(false);
        return;
      }

      setIsMogul(true);
      setTokenBalance(bountiesData.mogulStatus?.tokenBalance || 0);
      setBounties(bountiesData.data || []);

      // Load profile and submissions
      await Promise.all([
        loadProfile(token),
        loadSubmissions(token)
      ]);

      setLoading(false);
    } catch (err) {
      console.error('Error checking mogul status:', err);
      setError('Failed to load mogul data');
      setLoading(false);
    }
  };

  const loadProfile = async (token) => {
    try {
      const response = await fetch('/api/mogul/profile', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadSubmissions = async (token) => {
    try {
      const response = await fetch('/api/mogul/submissions', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setSubmissions(data.data || []);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
    }
  };

  const handleRefresh = async () => {
    await checkMogulStatus();
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const handleCompleteBounty = async (bounty) => {
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('fc_session_token');
      
      const response = await fetch('/api/mogul/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bountyId: bounty.id }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to complete bounty');
        setSubmitting(false);
        return;
      }

      // Success! Refresh data
      await triggerHaptic('success', isInFarcaster);
      await checkMogulStatus();
      setSelectedBounty(null);

    } catch (err) {
      console.error('Error completing bounty:', err);
      setError('Failed to complete bounty');
    }

    setSubmitting(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3eb489] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Merch Mogul Missions...</p>
        </div>
      </div>
    );
  }

  // Not a mogul
  if (!isMogul) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <img 
            src="/MerchMogulMissionsDashboardLogo.png" 
            alt="Merch Mogul Missions" 
            className="h-20 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Merch Mogul Status Required
          </h1>
          <p className="text-gray-600 mb-6">
            You need to hold <span className="font-bold text-[#3eb489]">50M+ $mintedmerch</span> tokens to access Mogul Missions.
          </p>
          <div className="bg-gray-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500">Your Balance</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(tokenBalance)} tokens</p>
            <p className="text-sm text-gray-500 mt-1">Need {formatNumber(50_000_000 - tokenBalance)} more</p>
          </div>
          <Link 
            href="/stake"
            className="inline-block w-full bg-[#3eb489] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#359970] transition-colors"
          >
            Stake to Earn More →
          </Link>
          <Link 
            href="/"
            className="block mt-4 text-gray-500 hover:text-gray-700"
          >
            ← Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  // Mogul dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-[#3eb489] text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Link href="/" className="text-white/80 hover:text-white text-sm">
              ← Back to Shop
            </Link>
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1"
            >
              {profile?.pfpUrl && (
                <img src={profile.pfpUrl} alt="" className="w-6 h-6 rounded-full" />
              )}
              <span className="text-sm">@{profile?.username || user?.username}</span>
            </button>
          </div>
          
          {/* Logo Header Image */}
          <div className="flex justify-center mb-3">
            <img 
              src="/MerchMogulMissionsDashboardLogo.png" 
              alt="Merch Mogul Missions" 
              className="h-24 object-contain"
            />
          </div>
          <p className="text-white/80 text-center text-sm">Complete missions to earn $mintedmerch!</p>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4 mb-4">
            <div className="bg-white/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{profile?.stats?.completedBounties || 0}</p>
              <p className="text-xs text-white/80">Completed</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{formatNumber(profile?.stats?.totalEarned || 0)}</p>
              <p className="text-xs text-white/80">Tokens Earned</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{bounties.filter(b => b.canSubmit).length}</p>
              <p className="text-xs text-white/80">Available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => { setActiveTab('bounties'); triggerHaptic('light', isInFarcaster); }}
              className={`flex-1 py-4 text-center font-semibold transition-colors ${
                activeTab === 'bounties' ? 'text-[#3eb489] border-b-2 border-[#3eb489]' : 'text-gray-500'
              }`}
            >
              🎯 Missions
            </button>
            <button
              onClick={() => { setActiveTab('payouts'); triggerHaptic('light', isInFarcaster); }}
              className={`flex-1 py-4 text-center font-semibold transition-colors ${
                activeTab === 'payouts' ? 'text-[#3eb489] border-b-2 border-[#3eb489]' : 'text-gray-500'
              }`}
            >
              💰 Payouts
            </button>
          </div>

          <div className="p-4">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                {error}
              </div>
            )}

            {activeTab === 'bounties' && (
              <BountiesTab 
                bounties={bounties} 
                onSelectBounty={setSelectedBounty}
                isInFarcaster={isInFarcaster}
              />
            )}

            {activeTab === 'payouts' && (
              <PayoutsTab submissions={submissions} />
            )}
          </div>
        </div>
      </div>

      {/* Bounty Action Modal */}
      {selectedBounty && (
        <BountyModal
          bounty={selectedBounty}
          onClose={() => setSelectedBounty(null)}
          onComplete={handleCompleteBounty}
          submitting={submitting}
          error={error}
          isInFarcaster={isInFarcaster}
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

// Bounties Tab
function BountiesTab({ bounties, onSelectBounty, isInFarcaster }) {
  const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num);

  if (bounties.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎯</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Missions</h3>
        <p className="text-gray-600">Check back later for new interaction bounties!</p>
      </div>
    );
  }

  const availableBounties = bounties.filter(b => b.canSubmit);

  return (
    <div className="space-y-4">
      {availableBounties.map((bounty) => {
        const getBountyIcon = () => {
          switch (bounty.bountyType) {
            case 'farcaster_like': return '❤️';
            case 'farcaster_recast': return '🔄';
            case 'farcaster_comment': return '💬';
            case 'farcaster_engagement': return '⚡';
            default: return '🎯';
          }
        };

        const getBountyAction = () => {
          switch (bounty.bountyType) {
            case 'farcaster_like': return 'Like the cast';
            case 'farcaster_recast': return 'Recast the post';
            case 'farcaster_comment': return 'Comment on the cast';
            case 'farcaster_engagement': return 'Like, Recast & Comment';
            default: return 'Complete action';
          }
        };

        return (
          <div
            key={bounty.id}
            className="border-2 rounded-xl p-5 border-gray-200 bg-white hover:border-[#3eb489] hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">{getBountyIcon()}</div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">{bounty.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{bounty.description || getBountyAction()}</p>
                
                <div className="flex items-center gap-4 text-sm">
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                    +{formatNumber(bounty.rewardTokens)} tokens
                  </span>
                  <span className="text-gray-500">
                    {bounty.slotsRemaining} slots left
                  </span>
                </div>

                <button
                  onClick={() => {
                    triggerHaptic('light', isInFarcaster);
                    onSelectBounty(bounty);
                  }}
                  className="mt-4 w-full bg-[#3eb489] hover:bg-[#359970] text-white py-3 rounded-xl font-semibold transition-colors"
                >
                  ⚡ Complete Mission
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {availableBounties.length === 0 && bounties.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          You've completed all available missions! Check back later for more.
        </div>
      )}
    </div>
  );
}

// Payouts Tab - shows completed missions and their payouts
function PayoutsTab({ submissions }) {
  const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num);

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">💰</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payouts Yet</h3>
        <p className="text-gray-600">Complete missions to earn $mintedmerch tokens!</p>
      </div>
    );
  }

  // Calculate totals
  const totalEarned = submissions
    .filter(s => s.status === 'approved')
    .reduce((sum, s) => sum + (s.rewardTokens || 0), 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-green-800 font-medium">Total Earned</span>
          <span className="text-green-800 font-bold text-lg">{formatNumber(totalEarned)} $mintedmerch</span>
        </div>
      </div>

      {/* Payout list */}
      {submissions.map((submission) => (
        <div key={submission.id} className="border rounded-xl p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">{submission.bountyTitle}</h4>
              <p className="text-sm text-gray-500">
                {new Date(submission.submittedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                submission.status === 'approved' ? 'bg-green-100 text-green-800' :
                submission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {submission.status === 'approved' ? '💰 Paid' :
                 submission.status === 'pending' ? '⏳ Processing' : '❌ Failed'}
              </span>
              {submission.status === 'approved' && (
                <p className="text-sm text-green-600 mt-1 font-semibold">
                  +{formatNumber(submission.rewardTokens)} tokens
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Bounty Action Modal
function BountyModal({ bounty, onClose, onComplete, submitting, error, isInFarcaster }) {
  const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num);

  const getBountySteps = () => {
    switch (bounty.bountyType) {
      case 'farcaster_like':
        return ['1. Open the cast below', '2. Like the cast', '3. Come back and tap "Verify & Claim"'];
      case 'farcaster_recast':
        return ['1. Open the cast below', '2. Recast the post', '3. Come back and tap "Verify & Claim"'];
      case 'farcaster_comment':
        return ['1. Open the cast below', '2. Leave a comment', '3. Come back and tap "Verify & Claim"'];
      case 'farcaster_engagement':
        return ['1. Open the cast below', '2. Like, Recast, AND Comment', '3. Come back and tap "Verify & Claim"'];
      default:
        return ['Complete the required action'];
    }
  };

  const handleOpenCast = async () => {
    await triggerHaptic('light', isInFarcaster);
    if (bounty.targetCastUrl) {
      if (isInFarcaster && sdk?.actions?.openUrl) {
        await sdk.actions.openUrl(bounty.targetCastUrl);
      } else {
        window.open(bounty.targetCastUrl, '_blank');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">{bounty.title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          <div className="bg-green-50 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-green-600">Reward</p>
            <p className="text-2xl font-bold text-green-800">
              {formatNumber(bounty.rewardTokens)} $mintedmerch
            </p>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Steps to Complete:</h3>
            <ol className="space-y-2">
              {getBountySteps().map((step, i) => (
                <li key={i} className="text-gray-600 text-sm">{step}</li>
              ))}
            </ol>
          </div>

          {bounty.targetCastUrl && (
            <button
              onClick={handleOpenCast}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold mb-4 transition-colors"
            >
              🔗 Open Cast in Farcaster
            </button>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={() => onComplete(bounty)}
            disabled={submitting}
            className={`w-full py-3 rounded-xl font-semibold transition-colors ${
              submitting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#3eb489] hover:bg-[#359970] text-white'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Verifying...
              </span>
            ) : (
              '✅ Verify & Claim Reward'
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full mt-3 py-3 text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

