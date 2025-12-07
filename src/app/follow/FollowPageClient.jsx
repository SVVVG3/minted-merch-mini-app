'use client';

import { useState, useEffect, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcaster } from '@/lib/useFarcaster';
import { triggerHaptic } from '@/lib/haptics';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import Link from 'next/link';
import Image from 'next/image';

// Airdrop contract ABI (just the function we need)
const AIRDROP_ABI = [
  {
    name: 'airdropERC20WithSignature',
    type: 'function',
    stateMutability: 'nonpayable',
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

export default function FollowPageClient() {
  const { user, sessionToken, isInFarcaster, isReady } = useFarcaster();

  // Task status
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [tasks, setTasks] = useState({
    hasAddedApp: false,
    hasNotifications: false,
    isFollowingAccount: false,
    isFollowingChannel: false
  });
  const [allTasksCompleted, setAllTasksCompleted] = useState(false);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [error, setError] = useState(null);

  // Claim state
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Action loading states
  const [addingApp, setAddingApp] = useState(false);
  const [enablingNotifications, setEnablingNotifications] = useState(false);

  // Wagmi hooks for claiming
  const {
    writeContract,
    data: claimTxHash,
    isPending: isClaimTxPending,
    error: claimWriteError
  } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } =
    useWaitForTransactionReceipt({ hash: claimTxHash });

  // Check task status
  const checkStatus = useCallback(async () => {
    if (!sessionToken) return;

    try {
      setChecking(true);
      setError(null);

      const response = await fetch('/api/follow/status', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const data = await response.json();

      if (data.alreadyClaimed) {
        setAlreadyClaimed(true);
        setHasClaimed(true);
        setShowSuccess(true);
      } else if (data.success) {
        setTasks(data.tasks);
        setAllTasksCompleted(data.allTasksCompleted);
      } else {
        setError(data.error || 'Failed to check status');
      }
    } catch (err) {
      console.error('Error checking status:', err);
      setError('Failed to check status');
    } finally {
      setChecking(false);
      setLoading(false);
    }
  }, [sessionToken]);

  // Initial load
  useEffect(() => {
    if (sessionToken) {
      checkStatus();
    } else if (isReady && !user) {
      setLoading(false);
    }
  }, [sessionToken, isReady, user, checkStatus]);

  // Handle claim confirmation
  useEffect(() => {
    if (isClaimConfirmed && claimTxHash) {
      console.log('✅ Claim confirmed! TX:', claimTxHash);
      markAsClaimed(claimTxHash);
    }
  }, [isClaimConfirmed, claimTxHash]);

  // Handle claim errors
  useEffect(() => {
    if (claimWriteError) {
      console.error('Claim error:', claimWriteError);
      // Clean error message for user rejection
      if (claimWriteError.message?.includes('User rejected') || 
          claimWriteError.message?.includes('rejected the request')) {
        setClaimError('Transaction cancelled');
      } else {
        setClaimError(claimWriteError.message || 'Transaction failed');
      }
      setClaiming(false);
    }
  }, [claimWriteError]);

  // Mark claim as complete in database
  const markAsClaimed = async (txHash) => {
    try {
      await fetch('/api/follow/mark-claimed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ transactionHash: txHash })
      });
      setHasClaimed(true);
      setShowSuccess(true);
      setClaiming(false);
      triggerHaptic('success', isInFarcaster);
    } catch (err) {
      console.error('Error marking claimed:', err);
      setClaiming(false);
    }
  };

  // Add mini app handler with timeout fallback
  const handleAddApp = async () => {
    if (addingApp) return; // Prevent double-clicks
    triggerHaptic('light', isInFarcaster);
    
    if (isInFarcaster && sdk?.actions?.addFrame) {
      setAddingApp(true);
      
      // Safety timeout - reset state after 10 seconds if SDK hangs
      const timeoutId = setTimeout(() => {
        console.log('Add frame timeout - resetting state');
        setAddingApp(false);
        checkStatus(); // Re-check status
      }, 10000);
      
      try {
        const result = await sdk.actions.addFrame();
        console.log('Add frame result:', result);
        clearTimeout(timeoutId);
        // Re-check status after adding
        setTimeout(() => checkStatus(), 1000);
      } catch (err) {
        console.error('Error adding frame:', err);
        clearTimeout(timeoutId);
        // User may have dismissed - that's okay
      } finally {
        setAddingApp(false);
      }
    }
  };

  // Enable notifications handler with timeout fallback
  const handleEnableNotifications = async () => {
    if (enablingNotifications) return; // Prevent double-clicks
    triggerHaptic('light', isInFarcaster);
    
    setEnablingNotifications(true);
    
    // Safety timeout - reset state after 10 seconds if SDK hangs
    const timeoutId = setTimeout(() => {
      console.log('Notifications timeout - resetting state');
      setEnablingNotifications(false);
      checkStatus(); // Re-check status
    }, 10000);
    
    if (isInFarcaster && sdk?.actions?.requestNotificationPermission) {
      try {
        const result = await sdk.actions.requestNotificationPermission();
        console.log('Notification permission result:', result);
        clearTimeout(timeoutId);
        // Re-check status after enabling
        setTimeout(() => checkStatus(), 1000);
      } catch (err) {
        console.error('Error enabling notifications:', err);
        clearTimeout(timeoutId);
        // User may have dismissed - that's okay
      } finally {
        setEnablingNotifications(false);
      }
    } else if (isInFarcaster && sdk?.actions?.addFrame) {
      // Fallback to addFrame if requestNotificationPermission not available
      try {
        const result = await sdk.actions.addFrame();
        console.log('Add frame result (for notifications):', result);
        clearTimeout(timeoutId);
        setTimeout(() => checkStatus(), 1000);
      } catch (err) {
        console.error('Error with addFrame for notifications:', err);
        clearTimeout(timeoutId);
      } finally {
        setEnablingNotifications(false);
      }
    } else {
      clearTimeout(timeoutId);
      setEnablingNotifications(false);
    }
  };

  // Follow account handler
  const handleFollowAccount = async () => {
    triggerHaptic('light', isInFarcaster);
    // Open @mintedmerch profile
    const url = 'https://warpcast.com/mintedmerch';
    if (isInFarcaster && sdk?.actions?.openUrl) {
      await sdk.actions.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // Follow channel handler
  const handleFollowChannel = async () => {
    triggerHaptic('light', isInFarcaster);
    // Open /mintedmerch channel
    const url = 'https://warpcast.com/~/channel/mintedmerch';
    if (isInFarcaster && sdk?.actions?.openUrl) {
      await sdk.actions.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // Claim reward handler
  const handleClaim = async () => {
    triggerHaptic('light', isInFarcaster);
    setClaiming(true);
    setClaimError(null);

    try {
      // Get claim data
      const response = await fetch('/api/follow/claim-data', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get claim data');
      }

      const { claimData } = data;

      // Prepare req for contract call
      const req = {
        uid: claimData.req.uid,
        tokenAddress: claimData.req.tokenAddress,
        expirationTimestamp: BigInt(claimData.req.expirationTimestamp),
        contents: claimData.req.contents.map(c => ({
          recipient: c.recipient,
          amount: BigInt(c.amount)
        }))
      };

      // Execute claim transaction
      writeContract({
        address: claimData.contractAddress,
        abi: AIRDROP_ABI,
        functionName: 'airdropERC20WithSignature',
        args: [req, claimData.signature],
        chainId: claimData.chainId
      });

    } catch (err) {
      console.error('Error claiming:', err);
      setClaimError(err.message || 'Failed to claim');
      setClaiming(false);
    }
  };

  // Share handler
  const handleShare = async () => {
    triggerHaptic('light', isInFarcaster);
    
    const shareText = `I just earned 10,000 $mintedmerch for following /mintedmerch & turning on notifications! 

Complete the mission and claim yours 👇`;
    const shareUrl = 'https://app.mintedmerch.shop/follow';

    // Mark as shared
    try {
      await fetch('/api/follow/mark-shared', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({})
      });
    } catch (err) {
      console.error('Error marking shared:', err);
    }

    if (isInFarcaster && sdk?.actions?.openUrl) {
      const composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(shareUrl)}`;
      await sdk.actions.openUrl(composeUrl);
    } else {
      const composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(shareUrl)}`;
      window.open(composeUrl, '_blank');
    }
  };

  // Format number helper
  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#3eb489] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎁</div>
          <h1 className="text-2xl font-bold mb-4">Earn 10,000 $mintedmerch!</h1>
          <p className="text-gray-400 mb-8">
            Sign in with Farcaster to complete tasks and claim your reward.
          </p>
          <Link
            href="/"
            className="inline-block bg-[#3eb489] hover:bg-[#359970] text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-black text-white p-4">
        <div className="max-w-md mx-auto pt-1">
          {/* Share Button - Top */}
          <button
            onClick={handleShare}
            className="w-full bg-[#6A3CFF] hover:bg-[#5930D9] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors mb-3"
          >
            <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
            </svg>
            Share on Farcaster
          </button>

          {/* Mission Complete Info - Now first */}
          <div className="border-2 border-[#3eb489]/30 rounded-2xl p-4 mb-3 text-center">
            <h2 className="text-xl font-bold text-[#3eb489] mb-2">Mission Complete!</h2>
            <p className="text-gray-300 text-sm">
              You&apos;ve claimed <span className="text-[#3eb489] font-bold">{formatNumber(10000)} $mintedmerch</span> - thank you for following Minted Merch!
            </p>
          </div>

          {/* Staking Info Card - Now second */}
          <div className="border-2 border-[#3eb489]/30 rounded-2xl p-4 mb-3 text-center bg-gradient-to-b from-[#3eb489]/10 to-transparent">
            <h2 className="text-lg font-bold text-[#3eb489] mb-2">Where Staking Meets Merch!</h2>
            <p className="text-gray-300 text-xs mb-3">
              Stake any amount to earn daily rewards! Stake 50M+ $mintedmerch to become a{' '}
              <span className="text-[#3eb489] font-semibold">Merch Mogul</span>{' '}
              and unlock: exclusive collab partnerships, the ability to place custom orders, 
              group chat access, and 15% off store wide.
            </p>
            <p className="text-white text-xs font-bold mb-3">
              SPIN-TO-CLAIM ONCE PER DAY FOR A CHANCE TO WIN THE{' '}
              <span className="text-[#3eb489]">MONTHLY MEGA MERCH PACK JACKPOT</span>,{' '}
              ONE OF FOUR <span className="text-[#3eb489]">MINI MERCH PACKS</span>,{' '}
              THE <span className="text-[#3eb489]">1M $mintedmerch DAILY JACKPOT</span>{' '}
              OR THE <span className="text-[#3eb489]">100K $mintedmerch BONUSES</span>!
            </p>
            <Link
              href="/stake"
              className="inline-block bg-[#3eb489] hover:bg-[#359970] text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm"
            >
              Stake Now →
            </Link>
          </div>

          {/* Explore Shop Button */}
          <Link
            href="/"
            className="block w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors text-center"
          >
            Explore Shop
          </Link>
        </div>
      </div>
    );
  }

  // Main task list view
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header with Logo Image - no padding */}
      <div className="text-center px-4">
        <img 
          src="/MintedMerchMissionsLogo.png" 
          alt="Follow Mission" 
          className="mx-auto h-20 object-contain"
        />
      </div>

      {/* Reward display - single line */}
      <div className="mx-4 mb-2">
        <div className="bg-gradient-to-r from-[#3eb489]/20 to-[#3eb489]/10 border border-[#3eb489]/30 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold">
            <span className="text-gray-400">Reward: </span>
            <span className="text-[#3eb489]">{formatNumber(10000)} $mintedmerch</span>
          </p>
        </div>
      </div>

      {/* Task list */}
      <div className="px-4 space-y-2">
        {/* Task 1: Add Mini App */}
        <div className={`rounded-lg p-2.5 border-2 transition-all ${
          tasks.hasAddedApp 
            ? 'bg-green-900/20 border-green-500/50' 
            : 'bg-gray-900 border-gray-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${
                tasks.hasAddedApp ? 'bg-green-500' : 'bg-gray-700'
              }`}>
                {tasks.hasAddedApp ? '✓' : '1'}
              </div>
              <div>
                <p className="font-semibold text-sm">Add Mini App</p>
                <p className="text-xs text-gray-400">Add to your Farcaster client</p>
              </div>
            </div>
            {!tasks.hasAddedApp && isInFarcaster && (
              <button
                onClick={handleAddApp}
                disabled={addingApp}
                className="bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-1.5 rounded-lg font-medium text-xs transition-colors disabled:opacity-50"
              >
                {addingApp ? '...' : 'Add'}
              </button>
            )}
          </div>
        </div>

        {/* Task 2: Enable Notifications */}
        <div className={`rounded-lg p-2.5 border-2 transition-all ${
          tasks.hasNotifications 
            ? 'bg-green-900/20 border-green-500/50' 
            : 'bg-gray-900 border-gray-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${
                tasks.hasNotifications ? 'bg-green-500' : 'bg-gray-700'
              }`}>
                {tasks.hasNotifications ? '✓' : '2'}
              </div>
              <div>
                <p className="font-semibold text-sm">Enable Notifications</p>
                <p className="text-xs text-gray-400">Turn on notifications</p>
              </div>
            </div>
            {!tasks.hasNotifications && isInFarcaster && (
              <button
                onClick={handleEnableNotifications}
                disabled={enablingNotifications}
                className="bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-1.5 rounded-lg font-medium text-xs transition-colors disabled:opacity-50"
              >
                {enablingNotifications ? '...' : 'Enable'}
              </button>
            )}
          </div>
        </div>

        {/* Task 3: Follow @mintedmerch */}
        <div className={`rounded-lg p-2.5 border-2 transition-all ${
          tasks.isFollowingAccount 
            ? 'bg-green-900/20 border-green-500/50' 
            : 'bg-gray-900 border-gray-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${
                tasks.isFollowingAccount ? 'bg-green-500' : 'bg-gray-700'
              }`}>
                {tasks.isFollowingAccount ? '✓' : '3'}
              </div>
              <div>
                <p className="font-semibold text-sm">Follow @mintedmerch</p>
                <p className="text-xs text-gray-400">Follow our main account</p>
              </div>
            </div>
            {!tasks.isFollowingAccount && (
              <button
                onClick={handleFollowAccount}
                className="bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-1.5 rounded-lg font-medium text-xs transition-colors"
              >
                Follow
              </button>
            )}
          </div>
        </div>

        {/* Task 4: Follow /mintedmerch channel */}
        <div className={`rounded-lg p-2.5 border-2 transition-all ${
          tasks.isFollowingChannel 
            ? 'bg-green-900/20 border-green-500/50' 
            : 'bg-gray-900 border-gray-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${
                tasks.isFollowingChannel ? 'bg-green-500' : 'bg-gray-700'
              }`}>
                {tasks.isFollowingChannel ? '✓' : '4'}
              </div>
              <div>
                <p className="font-semibold text-sm">Follow /mintedmerch</p>
                <p className="text-xs text-gray-400">Join our channel</p>
              </div>
            </div>
            {!tasks.isFollowingChannel && (
              <button
                onClick={handleFollowChannel}
                className="bg-[#3eb489] hover:bg-[#359970] text-white px-3 py-1.5 rounded-lg font-medium text-xs transition-colors"
              >
                Join
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Re-check button */}
      <div className="px-4 mt-3">
        <button
          onClick={checkStatus}
          disabled={checking}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Refresh Status'}
        </button>
      </div>

      {/* Claim button */}
      <div className="px-4 mt-2 pb-4">
        {claimError && (
          <div className="mb-2 bg-red-900/50 border border-red-500/50 rounded-lg p-2">
            <p className="text-xs text-red-300">{claimError}</p>
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={!allTasksCompleted || claiming || isClaimTxPending || isClaimConfirming}
          className={`w-full py-3 rounded-xl font-bold text-base transition-all ${
            allTasksCompleted
              ? 'bg-[#3eb489] hover:bg-[#359970] text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {claiming || isClaimTxPending || isClaimConfirming ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {isClaimConfirming ? 'Confirming...' : 'Claiming...'}
            </span>
          ) : allTasksCompleted ? (
            `Claim ${formatNumber(10000)} $mintedmerch`
          ) : (
            'Complete All Tasks to Claim'
          )}
        </button>

        {!allTasksCompleted && (
          <p className="text-center text-gray-500 text-xs mt-2">
            {4 - Object.values(tasks).filter(Boolean).length} task(s) remaining
          </p>
        )}
      </div>

      {/* About Minted Merch Section */}
      <div className="mx-4 mt-4 border border-gray-800 rounded-xl p-4 space-y-3">
        {/* Spinner Logo */}
        <div className="flex justify-center">
          <Image
            src="/MintedMerchSpinnerLogo.png"
            alt="Minted Merch"
            width={180}
            height={180}
            className="object-contain"
          />
        </div>

        <div className="space-y-2 text-gray-300 text-center">
          <p className="text-base font-bold text-white">
            Where Tokens Meet Merch
          </p>

          <div className="space-y-1.5 text-left">
            <div className="flex items-start gap-2">
              <span className="text-xs">✅</span>
              <span className="text-xs">Exclusive collabs & drops</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs">✅</span>
              <span className="text-xs">Shop with 1200+ coins across 20+ chains</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs">✅</span>
              <span className="text-xs">Free daily spins w/ leaderboard & raffles</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs">✅</span>
              <span className="text-xs">Win $mintedmerch, gift cards, & merch</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-gray-900 rounded-lg space-y-1.5">
          <h3 className="text-sm font-semibold text-white text-center">
            Become a Merch Mogul 🤌
          </h3>
          <ul className="text-xs text-gray-400 space-y-0.5 ml-3">
            <li>• Exclusive Collab Partner Access</li>
            <li>• Custom Merch Orders</li>
            <li>• Group Chat Access</li>
            <li>• 15% off store wide</li>
            <li>• Ambassador Program</li>
          </ul>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-4">
          <div className="bg-red-900/50 border border-red-500/50 rounded-xl p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

