'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcaster } from '@/lib/useFarcaster';
import { ProfileModal } from '@/components/ProfileModal';
import { triggerHaptic } from '@/lib/haptics';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import Link from 'next/link';

export default function MissionsClient() {
  const { user, isSDKReady, isInFarcaster, getPfpUrl, getUsername } = useFarcaster();
  const [loading, setLoading] = useState(true);
  const [isEligible, setIsEligible] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [profile, setProfile] = useState(null);
  const [bounties, setBounties] = useState([]);
  const [payouts, setPayouts] = useState([]);
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
        setIsEligible(false);
        setTokenBalance(bountiesData.tokenBalance || 0);
        setLoading(false);
        return;
      }

      if (!bountiesData.success) {
        setError(bountiesData.error || 'Failed to load data');
        setLoading(false);
        return;
      }

      setIsEligible(true);
      setTokenBalance(bountiesData.mogulStatus?.tokenBalance || 0);
      setBounties(bountiesData.data || []);

      // Load profile and payouts
      await Promise.all([
        loadProfile(token),
        loadPayouts(token)
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

  const loadPayouts = async (token) => {
    try {
      const response = await fetch('/api/mogul/payouts', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setPayouts(data.data || []);
        console.log('✅ Loaded mogul payouts:', data.data?.length || 0);
      }
    } catch (error) {
      console.error('Error loading payouts:', error);
    }
  };

  const handleRefresh = async () => {
    await checkMogulStatus();
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const handleCompleteBounty = async (bounty, proofUrl = null, proofDescription = null) => {
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('fc_session_token');
      
      const body = { bountyId: bounty.id };
      
      // Add proof data for custom bounties
      if (bounty.isCustomBounty || bounty.bountyType === 'custom') {
        if (!proofUrl) {
          setError('Please provide a proof URL');
          setSubmitting(false);
          return;
        }
        body.proofUrl = proofUrl;
        body.proofDescription = proofDescription;
      }
      
      const response = await fetch('/api/mogul/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
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
          <p className="text-gray-600">Loading Minted Merch Missions...</p>
        </div>
      </div>
    );
  }

  // Not eligible for missions
  if (!isEligible) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <img 
            src="/MintedMerchMissionsLogo.png" 
            alt="Minted Merch Missions" 
            className="h-20 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            🎯 Missions Access Required
          </h1>
          <p className="text-gray-600 mb-6">
            Hold <span className="font-bold text-[#3eb489]">50M+ $mintedmerch</span> tokens<br />
            <span className="text-gray-500">or</span><br />
            Stake <span className="font-bold text-[#3eb489]">1M+ $mintedmerch</span> tokens
          </p>
          <div className="bg-gray-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500">Your Balance</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(tokenBalance)} tokens</p>
          </div>
          <button 
            onClick={() => {
              triggerHaptic('light', isInFarcaster);
              window.location.href = '/stake';
            }}
            className="w-full bg-[#3eb489] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#359970] transition-colors"
          >
            Stake 1M+ to Unlock →
          </button>
          <button 
            onClick={() => {
              triggerHaptic('light', isInFarcaster);
              window.location.href = '/';
            }}
            className="block mt-4 text-gray-500 hover:text-gray-700 mx-auto"
          >
            ← Back to Shop
          </button>
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
            <button
              onClick={() => {
                triggerHaptic('light', isInFarcaster);
                window.location.href = '/';
              }}
              className="text-white/80 hover:text-white text-sm"
            >
              ← Back to Shop
            </button>
            <button
              onClick={() => {
                triggerHaptic('light', isInFarcaster);
                setShowProfileModal(true);
              }}
              className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1"
            >
              {(getPfpUrl() || profile?.pfpUrl) && (
                <img src={getPfpUrl() || profile?.pfpUrl} alt="" className="w-6 h-6 rounded-full" />
              )}
              <span className="text-sm">@{getUsername() || profile?.username || user?.username}</span>
            </button>
          </div>
          
          {/* Logo Header Image */}
          <div className="flex justify-center mb-3">
            <img 
              src="/MintedMerchMissionsLogo.png" 
              alt="Minted Merch Missions" 
              className="h-24 object-contain"
            />
          </div>
          <p className="text-white/80 text-center text-sm">Complete missions to earn $mintedmerch!</p>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-4 mb-4">
            <div className="bg-white/20 rounded-xl p-3 flex flex-col items-center justify-center min-h-[70px]">
              <p className="text-xl font-bold text-center">{bounties.filter(b => b.canSubmit).length}</p>
              <p className="text-xs text-white/80 text-center">Available</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3 flex flex-col items-center justify-center min-h-[70px]">
              <p className="text-lg font-bold text-center leading-tight">{formatNumber(profile?.stats?.totalEarned || 0)}</p>
              <p className="text-xs text-white/80 text-center">Tokens Earned</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3 flex flex-col items-center justify-center min-h-[70px]">
              <p className="text-xl font-bold text-center">{profile?.stats?.completedBounties || 0}</p>
              <p className="text-xs text-white/80 text-center">Completed</p>
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
              <PayoutsTab payouts={payouts} onRefresh={handleRefresh} isInFarcaster={isInFarcaster} />
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
        <p className="text-gray-600">Check back later for new missions!</p>
      </div>
    );
  }

  // Show bounties that are either available OR have a pending/rejected submission (so users can see status)
  const visibleBounties = bounties.filter(b => 
    b.canSubmit || b.hasPendingSubmission || b.hasRejectedSubmission
  );
  
  // Separate interaction and custom bounties
  const interactionBounties = visibleBounties.filter(b => b.isInteractionBounty);
  const customBounties = visibleBounties.filter(b => b.isCustomBounty);

  const getBountyIcon = (bounty) => {
    if (bounty.isCustomBounty) return '📝';
    switch (bounty.bountyType) {
      case 'farcaster_like': return '❤️';
      case 'farcaster_recast': return '🔄';
      case 'farcaster_comment': return '💬';
      case 'farcaster_like_recast': return '⚡';
      case 'farcaster_engagement': return '🔥';
      default: return '🎯';
    }
  };

  const getBountyAction = (bounty) => {
    if (bounty.isCustomBounty) return bounty.requirements || 'Complete the mission requirements';
    switch (bounty.bountyType) {
      case 'farcaster_like': return 'Like the cast';
      case 'farcaster_recast': return 'Recast the post';
      case 'farcaster_comment': return 'Comment on the cast';
      case 'farcaster_like_recast': return 'Like and Recast!';
      case 'farcaster_engagement': return 'Like, Recast, and Comment!';
      default: return 'Complete action';
    }
  };

  const renderBountyCard = (bounty) => {
    // Determine button state and text based on submission status
    const getButtonState = () => {
      if (bounty.hasPendingSubmission) {
        return { 
          disabled: true, 
          text: '⏳ Under Review', 
          className: 'bg-yellow-100 text-yellow-800 cursor-not-allowed border-2 border-yellow-300'
        };
      }
      if (bounty.hasRejectedSubmission && !bounty.canSubmit) {
        return { 
          disabled: true, 
          text: '❌ Submission Denied', 
          className: 'bg-red-100 text-red-800 cursor-not-allowed border-2 border-red-200'
        };
      }
      if (bounty.hasRejectedSubmission && bounty.canSubmit) {
        return { 
          disabled: false, 
          text: 'Resubmit Mission', 
          className: bounty.isCustomBounty
            ? 'bg-purple-600 hover:bg-purple-700 text-white'
            : 'bg-[#3eb489] hover:bg-[#359970] text-white'
        };
      }
      if (!bounty.canSubmit) {
        return { 
          disabled: true, 
          text: bounty.hasApprovedSubmission ? '✅ Completed' : 'Unavailable', 
          className: bounty.hasApprovedSubmission 
            ? 'bg-green-100 text-green-800 cursor-not-allowed border-2 border-green-300'
            : 'bg-gray-100 text-gray-500 cursor-not-allowed'
        };
      }
      return { 
        disabled: false, 
        text: bounty.isCustomBounty ? 'View & Submit' : 'Complete Mission',
        className: bounty.isCustomBounty
          ? 'bg-purple-600 hover:bg-purple-700 text-white'
          : 'bg-[#3eb489] hover:bg-[#359970] text-white'
      };
    };

    const buttonState = getButtonState();

    return (
      <div
        key={bounty.id}
        className={`border-2 rounded-xl p-5 bg-white transition-all ${
          bounty.hasPendingSubmission
            ? 'border-yellow-300 bg-yellow-50/30'
            : bounty.hasRejectedSubmission
              ? 'border-red-200 bg-red-50/30'
              : bounty.hasApprovedSubmission
                ? 'border-green-300 bg-green-50/30'
                : bounty.isCustomBounty 
                  ? 'border-purple-200 hover:border-purple-400 hover:shadow-lg' 
                  : 'border-gray-200 hover:border-[#3eb489] hover:shadow-lg'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="text-4xl">{getBountyIcon(bounty)}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-gray-900">{bounty.title}</h3>
              {bounty.isCustomBounty && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  Mogul Mission
                </span>
              )}
              {bounty.hasPendingSubmission && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  ⏳ Under Review
                </span>
              )}
              {bounty.hasRejectedSubmission && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  ❌ Denied - {bounty.canSubmit ? 'Can Resubmit' : 'No Resubmit'}
                </span>
              )}
            </div>
            
            {/* Show rejection reason if available */}
            {bounty.hasRejectedSubmission && bounty.rejectionReason && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700">
                  <span className="font-semibold">Reason:</span> {bounty.rejectionReason}
                </p>
              </div>
            )}
            
            <p className="text-sm text-gray-600 mb-3">{bounty.description || getBountyAction(bounty)}</p>
            
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
                if (!buttonState.disabled) {
                  triggerHaptic('light', isInFarcaster);
                  onSelectBounty(bounty);
                }
              }}
              disabled={buttonState.disabled}
              className={`mt-4 w-full py-3 rounded-xl font-semibold transition-colors ${buttonState.className}`}
            >
              {buttonState.text}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Interaction Bounties Section */}
      {interactionBounties.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            ⚡ Quick Missions
          </h3>
          <div className="space-y-4">
            {interactionBounties.map(renderBountyCard)}
          </div>
        </div>
      )}

      {/* Custom Bounties Section */}
      {customBounties.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            📝 Mogul Missions <span className="text-purple-600">(50M+ Staked)</span>
          </h3>
          <div className="space-y-4">
            {customBounties.map(renderBountyCard)}
          </div>
        </div>
      )}

      {visibleBounties.length === 0 && bounties.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          You've completed all available missions! Check back later for more.
        </div>
      )}
    </div>
  );
}

// Payouts Tab - shows claimable and completed payouts
function PayoutsTab({ payouts, onRefresh, isInFarcaster }) {
  const [claiming, setClaiming] = useState(null);
  const [claimError, setClaimError] = useState(null);
  const [claimSuccess, setClaimSuccess] = useState(null);
  
  // Wagmi hooks for claim transactions
  const { writeContract, data: hash, error: writeError, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  
  const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num);

  // Handle claim completion when transaction confirms
  useEffect(() => {
    if (isConfirmed && hash && claiming) {
      markPayoutComplete(claiming, hash);
    }
  }, [isConfirmed, hash, claiming]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError && claiming) {
      console.error('❌ Transaction error:', writeError);
      const errorMessage = writeError.message?.includes('User rejected') 
        ? 'Transaction rejected by user'
        : writeError.message || 'Transaction failed';
      setClaimError(errorMessage);
      setClaiming(null);
    }
  }, [writeError, claiming]);

  // Mark payout as complete after on-chain claim
  const markPayoutComplete = async (payoutId, txHash) => {
    try {
      const token = localStorage.getItem('fc_session_token');
      if (!token) return;

      // Use mogul-specific claim-complete endpoint
      const response = await fetch(`/api/mogul/payouts/${payoutId}/claim-complete`, {
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
        triggerHaptic('success', isInFarcaster);
        setClaimSuccess(payoutId);
        setTimeout(() => {
          setClaimSuccess(null);
          onRefresh();
        }, 2000);
      }
    } catch (error) {
      console.error('Error marking payout complete:', error);
    } finally {
      setClaiming(null);
    }
  };

  // Handle claim button click
  const handleClaim = async (payoutId) => {
    try {
      setClaiming(payoutId);
      setClaimError(null);
      triggerHaptic('light', isInFarcaster);

      const token = localStorage.getItem('fc_session_token');
      if (!token) {
        setClaimError('Authentication required');
        setClaiming(null);
        return;
      }

      // Fetch claim data from mogul-specific endpoint
      const response = await fetch(`/api/mogul/payouts/${payoutId}/claim-data`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch claim data');
      }

      console.log('📝 Claim data fetched, executing transaction...');

      // Execute on-chain claim using Thirdweb airdrop contract
      const claimData = result.data;
      
      // Convert string values back to BigInt for contract call
      const reqWithBigInt = {
        uid: claimData.req.uid,
        tokenAddress: claimData.req.tokenAddress,
        expirationTimestamp: BigInt(claimData.req.expirationTimestamp),
        contents: claimData.req.contents.map(content => ({
          recipient: content.recipient,
          amount: BigInt(content.amount)
        }))
      };

      // Airdrop contract ABI for airdropERC20WithSignature function
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

      writeContract({
        address: claimData.contractAddress,
        abi: airdropABI,
        functionName: 'airdropERC20WithSignature',
        args: [reqWithBigInt, claimData.signature]
      });

    } catch (error) {
      console.error('Error claiming payout:', error);
      setClaimError(error.message || 'Failed to claim');
      setClaiming(null);
    }
  };

  // Get status display
  const getStatusBadge = (status) => {
    switch (status) {
      case 'claimable':
        return { bg: 'bg-purple-100 text-purple-800', icon: '', text: 'CLAIM' };
      case 'pending':
        return { bg: 'bg-yellow-100 text-yellow-800', icon: '⏳', text: 'PENDING' };
      case 'completed':
        return { bg: 'bg-green-100 text-green-800', icon: '✅', text: 'CLAIMED' };
      case 'failed':
        return { bg: 'bg-red-100 text-red-800', icon: '❌', text: 'FAILED' };
      default:
        return { bg: 'bg-gray-100 text-gray-800', icon: '', text: status.toUpperCase() };
    }
  };

  if (payouts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">💰</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payouts Yet</h3>
        <p className="text-gray-600">Complete missions to earn $mintedmerch tokens!</p>
      </div>
    );
  }

  // Calculate totals
  const totalClaimed = payouts
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amountTokens || 0), 0);
  const totalClaimable = payouts
    .filter(p => p.status === 'claimable')
    .reduce((sum, p) => sum + (p.amountTokens || 0), 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      {totalClaimable > 0 && (
        <div className="bg-green-50 border border-[#3eb489] rounded-xl p-3 mb-4">
          <p className="text-[#3eb489] font-semibold text-sm text-center">
            Ready to Claim: {formatNumber(totalClaimable)} $mintedmerch
          </p>
        </div>
      )}
      
      {totalClaimed > 0 && (
        <div className="bg-green-50 border border-[#3eb489] rounded-xl p-3 mb-4">
          <p className="text-[#3eb489] font-semibold text-sm text-center">
            ✅ Total Claimed: {formatNumber(totalClaimed)} $mintedmerch
          </p>
          <button
            onClick={() => {
              triggerHaptic('light', isInFarcaster);
              window.location.href = '/stake?action=stake';
            }}
            className="mt-3 w-full bg-[#3eb489] hover:bg-[#359970] text-white py-2 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>💰</span> Stake Your Earnings
          </button>
        </div>
      )}

      {claimError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700">
          {claimError}
        </div>
      )}

      {/* Payout list */}
      {payouts.map((payout) => {
        const status = getStatusBadge(payout.status);
        const isClaiming = claiming === payout.id;
        const isThisConfirmed = claimSuccess === payout.id;

        return (
          <div key={payout.id} className="border rounded-xl p-4 bg-gray-50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-sm truncate">{payout.bounty?.title || 'Mission Payout'}</h4>
                <p className="text-xs text-gray-500">
                  {new Date(payout.createdAt).toLocaleDateString()}
                </p>
                <p className="text-base font-bold text-[#3eb489] mt-1 whitespace-nowrap">
                  +{formatNumber(payout.amountTokens)} $mintedmerch
                </p>
              </div>
              <div className="flex-shrink-0">
                {payout.status === 'claimable' ? (
                  <button
                    onClick={() => handleClaim(payout.id)}
                    disabled={isClaiming || isConfirming || isThisConfirmed}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                      isThisConfirmed
                        ? 'bg-green-600 text-white'
                        : isClaiming || isConfirming
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#3eb489] hover:bg-[#359970] text-white'
                    }`}
                  >
                    {isThisConfirmed ? '✅ Claimed!' :
                     isClaiming ? 'Preparing...' :
                     isConfirming ? 'Confirming...' :
                     'Claim'}
                  </button>
                ) : (
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${status.bg}`}>
                    {status.icon}{status.icon ? ' ' : ''}{status.text}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Bounty Action Modal
function BountyModal({ bounty, onClose, onComplete, submitting, error, isInFarcaster }) {
  const [proofUrl, setProofUrl] = useState('');
  const [proofDescription, setProofDescription] = useState('');
  
  const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num);
  const isCustomBounty = bounty.isCustomBounty || bounty.bountyType === 'custom';

  const handleOpenCast = async () => {
    await triggerHaptic('light', isInFarcaster);
    if (bounty.targetCastUrl) {
      try {
        // Check if we're in Base app vs Farcaster
        const context = await sdk.context;
        const clientFid = context?.client?.clientFid;
        const isBaseApp = clientFid && clientFid !== 9152; // 9152 is Farcaster/Warpcast
        
        // Extract cast hash from URL for viewCast
        // Format: https://farcaster.xyz/username/0xabc123
        let castHash = null;
        const urlParts = bounty.targetCastUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart && lastPart.startsWith('0x')) {
          castHash = lastPart;
        }
        
        if (isBaseApp && sdk?.actions?.viewCast && castHash) {
          // Base app: Use viewCast with base.app/post/{hash} format per docs
          const baseAppCastUrl = `https://base.app/post/${castHash}`;
          await sdk.actions.viewCast(baseAppCastUrl);
        } else if (isInFarcaster && sdk?.actions?.openUrl) {
          // Farcaster: Use openUrl with the original farcaster.xyz URL
          await sdk.actions.openUrl(bounty.targetCastUrl);
        } else {
          window.open(bounty.targetCastUrl, '_blank');
        }
      } catch (error) {
        console.error('Error opening cast:', error);
        window.open(bounty.targetCastUrl, '_blank');
      }
    }
  };

  const handleSubmit = () => {
    if (isCustomBounty) {
      onComplete(bounty, proofUrl, proofDescription);
    } else {
      onComplete(bounty);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{bounty.title}</h2>
              {isCustomBounty && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  Mogul Mission
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          <div className={`rounded-xl p-4 mb-6 text-center ${isCustomBounty ? 'bg-purple-50' : 'bg-green-50'}`}>
            <p className={`text-sm ${isCustomBounty ? 'text-purple-600' : 'text-green-600'}`}>Reward</p>
            <p className={`text-2xl font-bold ${isCustomBounty ? 'text-purple-800' : 'text-green-800'}`}>
              {formatNumber(bounty.rewardTokens)} $mintedmerch
            </p>
          </div>

          {/* Requirements section for custom bounties */}
          {isCustomBounty && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">📋 Requirements</h3>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
                {bounty.requirements || bounty.description || 'Complete the mission requirements'}
              </div>
              
              {bounty.proofRequirements && (
                <div className="mt-3">
                  <h4 className="font-medium text-gray-700 mb-1">📎 Proof Required</h4>
                  <p className="text-sm text-gray-600">{bounty.proofRequirements}</p>
                </div>
              )}
            </div>
          )}

          {/* Interaction bounty - open cast button */}
          {!isCustomBounty && bounty.targetCastUrl && (
            <button
              onClick={handleOpenCast}
              className="w-full bg-[#6A3CFF] hover:bg-[#5930D9] text-white py-3 rounded-xl font-semibold mb-4 transition-colors flex items-center justify-center gap-2"
            >
              <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
              </svg>
              {bounty.bountyType === 'farcaster_like_recast' ? 'Like & Recast' :
               bounty.bountyType === 'farcaster_like' ? 'Like' :
               bounty.bountyType === 'farcaster_recast' ? 'Recast' :
               bounty.bountyType === 'farcaster_comment' ? 'Comment' :
               'Like, Recast, Comment'}
            </button>
          )}

          {/* Custom bounty - proof submission form */}
          {isCustomBounty && (
            <div className="mb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proof URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://warpcast.com/... or link to your proof"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={proofDescription}
                  onChange={(e) => setProofDescription(e.target.value)}
                  placeholder="Add any notes about your submission..."
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || (isCustomBounty && !proofUrl)}
            className={`w-full py-3 rounded-xl font-semibold transition-colors ${
              submitting || (isCustomBounty && !proofUrl)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isCustomBounty
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-[#3eb489] hover:bg-[#359970] text-white'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> {isCustomBounty ? 'Submitting...' : 'Verifying...'}
              </span>
            ) : isCustomBounty ? (
              'Submit for Review'
            ) : (
              'Verify & Claim Reward'
            )}
          </button>

          {isCustomBounty && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Submissions are reviewed by admins. Rewards are claimable once approved.
            </p>
          )}

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

