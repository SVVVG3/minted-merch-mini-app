'use client';

import { useState, useEffect, useRef } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getTimeUntilReset } from '@/lib/timezone';
import { triggerHaptic } from '@/lib/haptics';
import { AddMiniAppPrompt } from './AddMiniAppPrompt';
import { Portal } from './Portal';

// Airdrop contract ABI
const AIRDROP_ABI = [{
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
            { name: 'amount', type: 'uint256' },
          ],
        },
      ],
    },
    { name: 'signature', type: 'bytes' },
  ],
  outputs: [],
}];

export function DailySpinModal({ isOpen, onClose, onSpinComplete }) {
  const modalRef = useRef(null);
  const { isInFarcaster, isReady, getFid, user, hasNotifications: checkSdkNotifications, context, getSessionToken } = useFarcaster();
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending: isTxPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Core state
  const [tokens, setTokens] = useState([]);
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Spin state
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [currentSpin, setCurrentSpin] = useState(null);
  const [allSpins, setAllSpins] = useState([]);

  // Claim state
  const [isClaiming, setIsClaiming] = useState(false);
  const [currentClaimIndex, setCurrentClaimIndex] = useState(0);
  const [claimsData, setClaimsData] = useState([]);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimedWinnings, setClaimedWinnings] = useState([]);
  const [wasDonation, setWasDonation] = useState(false);
  const [isDonating, setIsDonating] = useState(false);

  // Countdown
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // Win modal
  const [showWinModal, setShowWinModal] = useState(false);

  // Add Mini App Prompt
  const [showAddMiniAppPrompt, setShowAddMiniAppPrompt] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(null);

  // Get session token from hook or localStorage
  const getToken = () => getSessionToken() || localStorage.getItem('fc_session_token');

  // Handle escape key and body scroll
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Check notification status when modal opens
  useEffect(() => {
    if (isOpen && isReady) {
      checkNotificationStatus();
    }
  }, [isOpen, isReady]);

  const checkNotificationStatus = async () => {
    if (!isReady) return;
    
    const userFid = getFid();
    if (!userFid) return;

    // Check SDK context first
    const sdkHasNotifs = checkSdkNotifications();
    if (sdkHasNotifs) {
      setHasNotifications(true);
      return;
    }
    
    // Check database
    try {
      const response = await fetch(`/api/update-notification-status?fid=${userFid}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setHasNotifications(data.notificationsEnabled === true);
        }
      }
    } catch (error) {
      console.error('Error checking notification status:', error);
      setHasNotifications(false);
    }
  };

  // Handle write errors
  useEffect(() => {
    if (writeError && isClaiming) {
      console.error('Transaction error:', writeError);
      let friendlyMessage = 'Transaction failed. Please try again.';
      const errorMsg = writeError.message?.toLowerCase() || '';
      if (errorMsg.includes('rejected') || errorMsg.includes('denied') || errorMsg.includes('cancelled') || errorMsg.includes('canceled')) {
        friendlyMessage = 'Transaction cancelled. Click "Claim All Tokens" to try again.';
      } else if (errorMsg.includes('insufficient')) {
        friendlyMessage = 'Insufficient funds for transaction.';
      }
      setError(friendlyMessage);
      setIsClaiming(false);
      resetWrite();
      triggerHaptic('error', isInFarcaster);
    }
  }, [writeError, isClaiming]);

  // Load tokens and status when modal opens
  useEffect(() => {
    if (isOpen && (isReady || user)) {
      loadData();
    }
  }, [isOpen, isReady, user]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch tokens (public endpoint)
      const tokensRes = await fetch('/api/dailyspin/tokens');
      const tokensData = await tokensRes.json();
      
      if (tokensData.success) {
        setTokens(tokensData.tokens);
      }

      // Fetch user status if authenticated
      const token = getToken();
      if (token) {
        const statusRes = await fetch('/api/dailyspin/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const statusData = await statusRes.json();
        
        if (statusData.success) {
          setStatus(statusData.status);
          if (statusData.unclaimed?.byToken?.length > 0) {
            setAllSpins(statusData.unclaimed.byToken.map(t => ({
              symbol: t.symbol,
              displayAmount: (parseFloat(t.totalAmount) / Math.pow(10, t.decimals)).toFixed(4),
              color: t.color
            })));
          }
          if (statusData.claimedToday?.length > 0) {
            setClaimedWinnings(statusData.claimedToday);
            if (!statusData.status.canSpin && statusData.unclaimed?.byToken?.length === 0) {
              setClaimSuccess(true);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (!isOpen) return;
    
    const updateCountdown = () => {
      const timeUntilReset = getTimeUntilReset();
      setCountdown(timeUntilReset);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Handle spin
  const handleSpin = async () => {
    if (isSpinning || !status?.canSpin) return;

    const token = getToken();
    if (!token) {
      setError('Please sign in to spin');
      return;
    }

    try {
      setIsSpinning(true);
      setCurrentSpin(null);
      setError(null);
      triggerHaptic('medium', isInFarcaster);

      const res = await fetch('/api/dailyspin/spin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Spin failed');
      }

      // Calculate rotation
      const winningToken = data.spin.token;
      const tokenIndex = tokens.findIndex(t => t.id === winningToken.id);
      const numSegments = tokens.length;
      const segmentAngle = 360 / numSegments;
      const segmentCenterOffset = (tokenIndex + 0.5) * segmentAngle;
      const targetAngle = 360 - segmentCenterOffset;
      const currentAngle = rotation % 360;
      let additionalRotation = targetAngle - currentAngle;
      if (additionalRotation < 0) additionalRotation += 360;
      const fullSpins = Math.floor(Math.random() * 3) + 4;
      const finalRotation = rotation + (fullSpins * 360) + additionalRotation;

      setRotation(finalRotation);

      // Wait for animation
      setTimeout(() => {
        setCurrentSpin(data.spin);
        
        if (data.spin.isWin) {
          triggerHaptic('success', isInFarcaster);
          setShowWinModal(true);
          setAllSpins(prev => [...prev, {
            symbol: data.spin.token.symbol,
            displayAmount: data.spin.displayAmount,
            color: data.spin.token.color
          }]);
        } else {
          triggerHaptic('warning', isInFarcaster);
        }
        
        setStatus(prev => ({
          ...prev,
          spinsUsedToday: data.status.spinsUsedToday,
          spinsRemaining: data.status.spinsRemaining,
          canSpin: data.status.canSpin
        }));
        setIsSpinning(false);

        // Notify parent of spin completion
        if (onSpinComplete) {
          onSpinComplete(data);
        }

        // Show Add Mini App prompt after spin if needed
        const isInMiniApp = user && !user.isAuthKit;
        if (isInMiniApp && hasNotifications === false && !data.status.canSpin) {
          setTimeout(() => setShowAddMiniAppPrompt(true), 3000);
        }
      }, 3500);

    } catch (err) {
      console.error('Spin error:', err);
      setError(err.message);
      setIsSpinning(false);
      triggerHaptic('error', isInFarcaster);
    }
  };

  // Handle claim
  const handleClaim = async (isDonation = false) => {
    if (!address || !isConnected) {
      setError('Please connect your wallet');
      return;
    }

    const token = getToken();
    if (!token) {
      setError('Please sign in');
      return;
    }

    try {
      setIsClaiming(true);
      setIsDonating(isDonation);
      setError(null);
      triggerHaptic('medium', isInFarcaster);

      const res = await fetch('/api/dailyspin/claim-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          walletAddress: address,
          donate: isDonation
        })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get claim data');
      }

      setClaimsData(data.claims);
      setCurrentClaimIndex(0);
      executeClaimTransaction(data.claims[0]);

    } catch (err) {
      console.error('Claim/Donate error:', err);
      setError(err.message);
      setIsClaiming(false);
      setIsDonating(false);
      triggerHaptic('error', isInFarcaster);
    }
  };

  const executeClaimTransaction = (claim) => {
    try {
      const reqWithBigInt = {
        uid: claim.claimData.req.uid,
        tokenAddress: claim.claimData.req.tokenAddress,
        expirationTimestamp: BigInt(claim.claimData.req.expirationTimestamp),
        contents: claim.claimData.req.contents.map(content => ({
          recipient: content.recipient,
          amount: BigInt(content.amount)
        }))
      };

      writeContract({
        address: claim.claimData.contractAddress,
        abi: AIRDROP_ABI,
        functionName: 'airdropERC20WithSignature',
        args: [reqWithBigInt, claim.claimData.signature],
        chainId: claim.claimData.chainId
      });
    } catch (err) {
      console.error('Transaction error:', err);
      setError(err.message);
      setIsClaiming(false);
    }
  };

  // Watch for transaction confirmation
  useEffect(() => {
    if (isConfirmed && hash && isClaiming) {
      handleTransactionConfirmed(hash);
    }
  }, [isConfirmed, hash, isClaiming]);

  const handleTransactionConfirmed = async (txHash) => {
    try {
      const currentClaim = claimsData[currentClaimIndex];
      const token = getToken();
      
      await fetch('/api/dailyspin/mark-claimed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          winningIds: currentClaim.winningIds,
          txHash,
          isDonation: isDonating
        })
      });

      const nextIndex = currentClaimIndex + 1;
      if (nextIndex < claimsData.length) {
        setCurrentClaimIndex(nextIndex);
        resetWrite();
        setTimeout(() => executeClaimTransaction(claimsData[nextIndex]), 500);
      } else {
        setClaimedWinnings([...allSpins]);
        setWasDonation(isDonating);
        setClaimSuccess(true);
        setIsClaiming(false);
        setIsDonating(false);
        setAllSpins([]);
        triggerHaptic('success', isInFarcaster);

        // Show Add Mini App prompt after claim if needed
        const isInMiniApp = user && !user.isAuthKit;
        if (isInMiniApp && hasNotifications === false) {
          setTimeout(() => setShowAddMiniAppPrompt(true), 2000);
        }
      }
    } catch (err) {
      console.error('Error handling confirmation:', err);
      setError(err.message);
      setIsClaiming(false);
    }
  };

  // Handle share - links to home page where modal opens
  // Note: To get DailySpinEmbed.png, we'd need to add OG meta handling for ?showDailySpin param
  const handleShare = async () => {
    triggerHaptic('medium', isInFarcaster);
    
    const winningsToShare = claimedWinnings.length > 0 ? claimedWinnings : allSpins;
    const aggregated = {};
    for (const spin of winningsToShare) {
      if (!aggregated[spin.symbol]) aggregated[spin.symbol] = 0;
      aggregated[spin.symbol] += parseFloat(spin.displayAmount);
    }
    
    const tokenList = Object.entries(aggregated).map(([symbol, amount]) => `${amount.toFixed(4)} $${symbol}`);
    let winningsSummary = 'tokens';
    if (tokenList.length === 1) {
      winningsSummary = tokenList[0];
    } else if (tokenList.length === 2) {
      winningsSummary = `${tokenList[0]} and ${tokenList[1]}`;
    } else if (tokenList.length > 2) {
      winningsSummary = `${tokenList.slice(0, -1).join(', ')}, and ${tokenList[tokenList.length - 1]}`;
    }
    const shareText = `I just claimed ${winningsSummary} on the /mintedmerch Daily Spin and boosted my Mojo Score!\n\nSpin to win tokens daily 👇`;
    
    try {
      const { sdk } = await import('@farcaster/frame-sdk');
      await sdk.actions.composeCast({
        text: shareText,
        embeds: [`${window.location.origin}/?showDailySpin=1`] // Links to home with daily spin modal
      });
    } catch (err) {
      console.error('Share error:', err);
      await navigator.clipboard.writeText(shareText);
      alert('Share text copied to clipboard!');
    }
  };

  // Handle share for mojo boost only (all misses or low mojo)
  const handleShareGeneric = async () => {
    triggerHaptic('medium', isInFarcaster);
    const shareText = `I just spun the /mintedmerch Daily Spin and boosted my Mojo Score!\n\nSpin to win tokens daily 👇`;
    
    try {
      const { sdk } = await import('@farcaster/frame-sdk');
      await sdk.actions.composeCast({
        text: shareText,
        embeds: [`${window.location.origin}/?showDailySpin=1`] // Links to home with daily spin modal
      });
    } catch (err) {
      console.error('Share error:', err);
      await navigator.clipboard.writeText(shareText);
      alert('Share text copied to clipboard!');
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleOverlayClick}
        />
        
        {/* Modal Content */}
        <div 
          ref={modalRef}
          className="relative z-10 w-full max-w-md max-h-[90vh] flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6)' }}
        >
          {/* Scrollable Content */}
          <div className="overflow-y-auto overscroll-contain p-4 pt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3eb489] mx-auto mb-4"></div>
                  <p className="text-white">Loading...</p>
                </div>
              </div>
            ) : !status ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white mb-4">Daily Token Spin</h2>
                  <p className="text-gray-400">Please sign in to spin the wheel!</p>
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                {/* Header */}
                <div className="text-center mb-4">
                  <img 
                    src="/MintedMerchDailySpin.png" 
                    alt="Minted Merch Daily Spin" 
                    className="mx-auto h-24 object-contain"
                  />
                </div>

                {/* Wheel */}
                <div className="relative mb-3">
                  {/* Pointer */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                    <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg"></div>
                  </div>

                  {/* Wheel Container */}
                  <div className="relative w-64 h-64 mx-auto">
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full h-full transition-transform duration-[3500ms] ease-out"
                      style={{ transform: `rotate(${rotation}deg)` }}
                    >
                      <defs>
                        {tokens.map((token, index) => (
                          <clipPath key={`clip-${token.id}`} id={`modal-clip-${index}`}>
                            <circle cx="0" cy="0" r="8" />
                          </clipPath>
                        ))}
                      </defs>
                      
                      {tokens.map((token, index) => {
                        const numSegments = tokens.length;
                        const segmentAngle = 360 / numSegments;
                        const startAngle = index * segmentAngle - 90;
                        const endAngle = startAngle + segmentAngle;
                        const largeArc = segmentAngle > 180 ? 1 : 0;

                        const startRad = (startAngle * Math.PI) / 180;
                        const endRad = (endAngle * Math.PI) / 180;

                        const x1 = 50 + 45 * Math.cos(startRad);
                        const y1 = 50 + 45 * Math.sin(startRad);
                        const x2 = 50 + 45 * Math.cos(endRad);
                        const y2 = 50 + 45 * Math.sin(endRad);

                        const midAngle = (startAngle + endAngle) / 2;
                        const midRad = (midAngle * Math.PI) / 180;
                        const logoX = 50 + 30 * Math.cos(midRad);
                        const logoY = 50 + 30 * Math.sin(midRad);

                        return (
                          <g key={token.id}>
                            <path
                              d={`M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArc} 1 ${x2} ${y2} Z`}
                              fill={token.color}
                              stroke="#1f2937"
                              strokeWidth="1"
                            />
                            
                            {token.logoUrl ? (
                              <g transform={`translate(${logoX}, ${logoY})`}>
                                <circle cx="0" cy="0" r="9" fill="white" />
                                <circle cx="0" cy="0" r="8" fill="white" />
                                <image
                                  href={token.logoUrl}
                                  x="-8"
                                  y="-8"
                                  width="16"
                                  height="16"
                                  clipPath={`url(#modal-clip-${index})`}
                                  preserveAspectRatio="xMidYMid slice"
                                />
                              </g>
                            ) : (
                              <g transform={`translate(${logoX}, ${logoY})`}>
                                <circle cx="0" cy="0" r="9" fill="#1f2937" />
                                <text
                                  x="0"
                                  y="0.5"
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="#ef4444"
                                  fontSize="14"
                                  fontWeight="bold"
                                >
                                  ✕
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                      
                      {/* Center circle */}
                      <defs>
                        <clipPath id="modalCenterClip">
                          <circle cx="50" cy="50" r="11" />
                        </clipPath>
                      </defs>
                      <circle cx="50" cy="50" r="12" fill="#1f2937" stroke="#3eb489" strokeWidth="2" />
                      {user?.pfpUrl ? (
                        <image
                          href={user.pfpUrl}
                          x="39"
                          y="39"
                          width="22"
                          height="22"
                          clipPath="url(#modalCenterClip)"
                          preserveAspectRatio="xMidYMid slice"
                        />
                      ) : (
                        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="5" fontWeight="bold">
                          SPIN
                        </text>
                      )}
                    </svg>
                  </div>
                </div>

                {/* Current Spin Result - Only show for losses */}
                {currentSpin && !currentSpin.isWin && (
                  <div className="rounded-xl p-4 mb-4 border bg-gradient-to-r from-gray-600/20 to-gray-500/20 border-gray-500/30">
                    <p className="text-center text-gray-300">
                      🥲 {currentSpin.message || 'Better Luck Next Time!'}
                      {status.canSpin && <span className="block text-sm mt-1 text-gray-400">Spin again!</span>}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {/* Spin Button */}
                  {status.canSpin && (
                    <>
                      <button
                        onClick={handleSpin}
                        disabled={isSpinning}
                        className="w-full py-4 bg-gradient-to-r from-[#3eb489] to-emerald-600 text-white font-bold rounded-xl 
                                 hover:from-[#2d9970] hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-all duration-200 shadow-lg"
                      >
                        {isSpinning ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                            Spinning...
                          </span>
                        ) : (
                          'Spin To Win'
                        )}
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic('light', isInFarcaster);
                          onClose();
                        }}
                        className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl 
                                 transition-all duration-200"
                      >
                        Back to Shop
                      </button>
                    </>
                  )}

                  {/* Claim Button */}
                  {!status.canSpin && !claimSuccess && (allSpins.length > 0 || status.spinsUsedToday > 0) && (
                    <div className="space-y-2">
                      {status.canClaim === false || allSpins.length === 0 ? (
                        <>
                          <button
                            onClick={() => handleClaim(true)}
                            disabled={isClaiming || !isConnected}
                            className="w-full py-4 bg-[#3eb489] hover:bg-[#2d9970] text-white font-bold rounded-xl 
                                     disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                          >
                            {isClaiming && isDonating ? (
                              <span className="flex items-center justify-center gap-2">
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                Processing {currentClaimIndex + 1}/{claimsData.length}...
                              </span>
                            ) : !isConnected ? (
                              'Connect Wallet'
                            ) : (
                              'Claim Mojo Boost'
                            )}
                          </button>
                          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-3 text-center">
                            {allSpins.length === 0 ? (
                              <>
                                <p className="text-yellow-400 text-sm">🎰 No tokens won today</p>
                                <p className="text-gray-400 text-xs mt-1">Claim your Mojo boost & try again tomorrow!</p>
                              </>
                            ) : (
                              <>
                                <p className="text-yellow-400 text-sm">⚠️ Mojo score of 0.2+ required to claim tokens.</p>
                                <p className="text-gray-400 text-xs mt-1">Your score: {status.mojoScore} - Claim your Mojo boost & try again tomorrow!</p>
                              </>
                            )}
                            {/* Mojo Boost Tips */}
                            <div className="mt-3 pt-3 border-t border-yellow-500/20">
                              <p className="text-yellow-400/80 text-xs font-medium mb-2">Ways to boost your Mojo:</p>
                              <div className="flex flex-wrap justify-center gap-2">
                                <button onClick={onClose} className="text-xs bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-300 px-3 py-1.5 rounded-lg transition-colors">
                                  Check-in Daily
                                </button>
                                <a href="/stake" className="text-xs bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-300 px-3 py-1.5 rounded-lg transition-colors">
                                  Stake $mintedmerch
                                </a>
                                <a href="/missions" className="text-xs bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-300 px-3 py-1.5 rounded-lg transition-colors">
                                  Complete Missions
                                </a>
                                <button onClick={onClose} className="text-xs bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-300 px-3 py-1.5 rounded-lg transition-colors">
                                  Shop on Minted Merch
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => handleClaim(false)}
                          disabled={isClaiming || !isConnected}
                          className="w-full py-4 bg-[#3eb489] hover:bg-[#2d9970] text-white font-bold rounded-xl 
                                   disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                        >
                          {isClaiming && !isDonating ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                              Claiming {currentClaimIndex + 1}/{claimsData.length}...
                            </span>
                          ) : !isConnected ? (
                            'Connect Wallet to Claim'
                          ) : (
                            'Claim Winnings'
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          triggerHaptic('light', isInFarcaster);
                          onClose();
                        }}
                        className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl 
                                 transition-all duration-200"
                      >
                        Back to Shop
                      </button>
                    </div>
                  )}

                  {/* Claim Success */}
                  {claimSuccess && (
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          triggerHaptic('light', isInFarcaster);
                          onClose();
                        }}
                        className="w-full py-4 bg-[#3eb489] hover:bg-[#2d9970] text-white font-bold rounded-xl 
                                 transition-all duration-200 shadow-lg"
                      >
                        Back to Shop
                      </button>
                      <button
                        onClick={wasDonation ? handleShareGeneric : handleShare}
                        className="w-full py-4 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white font-bold rounded-xl 
                                 transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
                      >
                        <span>{wasDonation ? 'Share Daily Spin' : 'Share Your Winnings'}</span>
                        <svg className="w-5 h-5" viewBox="0 0 520 457" fill="currentColor">
                          <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic('light', isInFarcaster);
                          window.location.href = '/stake';
                        }}
                        className="w-full py-4 bg-[#3eb489] hover:bg-[#2d9970] text-white font-bold rounded-xl 
                                 transition-all duration-200 shadow-lg flex items-center justify-center"
                      >
                        Stake Your $mintedmerch
                      </button>
                    </div>
                  )}

                  {/* No spins left */}
                  {!status.canSpin && allSpins.length === 0 && !claimSuccess && status.spinsUsedToday === 0 && (
                    <div className="space-y-3">
                      <div className="text-gray-400 text-center">
                        <p>No spins remaining today.</p>
                        <p className="text-sm mt-2">
                          ↓ Next spin in: {String(countdown.hours).padStart(2, '0')}:
                          {String(countdown.minutes).padStart(2, '0')}:
                          {String(countdown.seconds).padStart(2, '0')} ↓
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          triggerHaptic('light', isInFarcaster);
                          onClose();
                        }}
                        className="w-full py-4 bg-[#3eb489] hover:bg-[#2d9970] text-white font-bold rounded-xl 
                                 transition-all duration-200 shadow-lg"
                      >
                        Back to Shop
                      </button>
                      <button
                        onClick={claimedWinnings.length > 0 ? handleShare : handleShareGeneric}
                        className="w-full py-4 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white font-bold rounded-xl 
                                 transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
                      >
                        <span>{claimedWinnings.length > 0 ? 'Share Your Winnings' : 'Share Daily Spin'}</span>
                        <svg className="w-5 h-5" viewBox="0 0 520 457" fill="currentColor">
                          <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic('light', isInFarcaster);
                          window.location.href = '/stake';
                        }}
                        className="w-full py-4 bg-[#3eb489] hover:bg-[#2d9970] text-white font-bold rounded-xl 
                                 transition-all duration-200 shadow-lg flex items-center justify-center"
                      >
                        Stake Your $mintedmerch
                      </button>
                    </div>
                  )}
                </div>

                {/* Countdown after claim */}
                {claimSuccess && !status.canSpin && (
                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 mt-4 border border-green-500/30">
                    <p className="text-gray-400 text-sm text-center">
                      ↓ Next spin in: {String(countdown.hours).padStart(2, '0')}:
                      {String(countdown.minutes).padStart(2, '0')}:
                      {String(countdown.seconds).padStart(2, '0')} ↓
                    </p>
                  </div>
                )}

                {/* Winnings Display */}
                {(allSpins.length > 0 || claimedWinnings.length > 0) && (
                  <div className="bg-gray-800/50 rounded-xl px-4 py-2 mt-4 border border-gray-700">
                    <h3 className="text-white font-bold mb-1">
                      {claimSuccess ? (
                        <>Recent Winnings<span className="ml-2 text-sm font-normal text-green-400">({wasDonation ? 'Mojo Boosted' : 'Claimed'})</span></>
                      ) : status?.canClaim ? (
                        'Recent Winnings'
                      ) : (
                        <>Potential Winnings<span className="ml-2 text-sm font-normal text-yellow-400">(MMM {'>'} 0.2 required)</span></>
                      )}
                    </h3>
                    <div className="space-y-1">
                      {(allSpins.length > 0 ? allSpins : claimedWinnings).map((spin, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-gray-400">${spin.symbol}</span>
                          <span className="font-mono" style={{ color: spin.color }}>{spin.displayAmount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mojo Status */}
                <div className="bg-gray-800/50 rounded-xl px-4 py-3 my-4 border border-gray-700">
                  <div className="text-center text-sm">
                    <div className="mb-1">
                      <span className="text-gray-400">Minted Merch Mojo Score: </span>
                      <span className="text-[#3eb489] font-bold">{status.mojoScore}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span className={`font-bold ${
                        status.mojoTier === 'Gold' ? 'text-yellow-400' :
                        status.mojoTier === 'Silver' ? 'text-gray-300' :
                        'text-orange-400'
                      }`}>
                        {status.mojoTier} ({status.dailyAllocation} {status.dailyAllocation === 1 ? 'spin' : 'spins'}/day)
                      </span>
                      <span className="text-gray-500">|</span>
                      <span className="text-white">{status.spinsUsedToday}/{status.dailyAllocation} used</span>
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-center text-sm">{error}</p>
                    <button onClick={() => setError(null)} className="mt-2 text-gray-400 text-xs underline w-full text-center">
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Transaction Status */}
                {(isTxPending || isConfirming) && (
                  <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-xl">
                    <p className="text-yellow-400 text-center">
                      {isTxPending ? 'Waiting for wallet approval...' : 'Confirming transaction...'}
                    </p>
                  </div>
                )}

                {/* How It Works */}
                <div className="mt-6 p-4 bg-gray-800/30 rounded-xl border border-gray-700">
                  <h3 className="text-white font-bold mb-2">How It Works:</h3>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• Your Mojo Score determines daily spins</li>
                    <li>• Each spin is a chance to win tokens</li>
                    <li>• Complete all spins, then claim all tokens</li>
                    <li>• Resets daily at 8:00 AM PST</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Win Modal - overlays the main modal */}
        {showWinModal && currentSpin?.isWin && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 max-w-sm w-full border border-[#3eb489]/30 shadow-2xl">
              <div className="text-center mb-3">
                <h2 className="text-2xl font-bold text-white">
                  {status?.canClaim ? 'You Won:' : 'You Could Win:'}
                </h2>
              </div>
              <div className="bg-black/30 rounded-xl p-4 mb-3">
                <div className="flex items-center gap-3">
                  {tokens.find(t => t.id === currentSpin.token.id)?.logoUrl ? (
                    <img 
                      src={tokens.find(t => t.id === currentSpin.token.id)?.logoUrl}
                      alt={currentSpin.token.symbol}
                      className="w-14 h-14 rounded-full border-2 border-white/20 flex-shrink-0"
                    />
                  ) : (
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ backgroundColor: currentSpin.token.color }}
                    >
                      {currentSpin.token.symbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-lg">${currentSpin.token.symbol}</span>
                      <span className="text-gray-500 text-xs">≈ ${currentSpin.usdValue}</span>
                    </div>
                    <p className="text-2xl font-bold truncate" style={{ color: currentSpin.token.color }}>
                      {currentSpin.displayAmount}
                    </p>
                  </div>
                </div>
                {tokens.find(t => t.id === currentSpin.token.id)?.description && (
                  <p className="text-gray-400 text-sm mt-3 pt-3 border-t border-white/10">
                    {tokens.find(t => t.id === currentSpin.token.id)?.description}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                {(() => {
                  const tokenData = tokens.find(t => t.id === currentSpin.token.id);
                  const dexUrl = tokenData?.dexscreenerUrl || (currentSpin.token.contractAddress ? `https://dexscreener.com/base/${currentSpin.token.contractAddress}` : null);
                  if (!dexUrl) return null;
                  return (
                    <a
                      href={dexUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <span>View on DexScreener</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  );
                })()}
                {(() => {
                  const tokenData = tokens.find(t => t.id === currentSpin.token.id);
                  const shopUrl = tokenData?.shopUrl || '/';
                  const buttonText = tokenData?.shopUrl ? `Shop ${currentSpin.token.symbol} Collection` : 'Shop Merch Collection';
                  return (
                    <button
                      onClick={() => {
                        setShowWinModal(false);
                        onClose();
                        window.location.href = shopUrl;
                      }}
                      className="w-full py-3 bg-[#3eb489] hover:bg-[#2d9970] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <span>{buttonText}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </button>
                  );
                })()}
                <button
                  onClick={() => setShowWinModal(false)}
                  className="w-full py-3 bg-transparent border border-gray-600 hover:border-gray-500 text-gray-300 font-medium rounded-xl transition-colors"
                >
                  {status.canSpin ? 'Keep Spinning!' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Mini App Prompt */}
      <AddMiniAppPrompt 
        isOpen={showAddMiniAppPrompt}
        onClose={() => setShowAddMiniAppPrompt(false)}
      />
    </Portal>
  );
}

