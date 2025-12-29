'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getTimeUntilReset } from '@/lib/timezone';
import { triggerHaptic } from '@/lib/haptics';

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

export default function DailySpinClient() {
  const { isInFarcaster, isReady, getFid, user } = useFarcaster();
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
  const [claimedWinnings, setClaimedWinnings] = useState([]); // Store winnings for sharing after claim
  const [wasDonation, setWasDonation] = useState(false); // Track if last action was donation

  // Countdown
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // Win modal
  const [showWinModal, setShowWinModal] = useState(false);

  // Get session token
  const getSessionToken = () => localStorage.getItem('fc_session_token');

  // Handle write errors (user rejected transaction)
  useEffect(() => {
    if (writeError && isClaiming) {
      console.error('Transaction error:', writeError);
      
      // Show user-friendly message instead of technical error
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

  // Load tokens and status
  useEffect(() => {
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
        const token = getSessionToken();
        if (token) {
          const statusRes = await fetch('/api/dailyspin/status', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const statusData = await statusRes.json();
          
          if (statusData.success) {
            setStatus(statusData.status);
            // If there are unclaimed winnings, set them
            if (statusData.unclaimed?.byToken?.length > 0) {
              setAllSpins(statusData.unclaimed.byToken.map(t => ({
                symbol: t.symbol,
                displayAmount: (parseFloat(t.totalAmount) / Math.pow(10, t.decimals)).toFixed(4),
                color: t.color
              })));
            }
            // If user already claimed today, store those winnings for display/sharing
            if (statusData.claimedToday?.length > 0) {
              setClaimedWinnings(statusData.claimedToday);
              // If no more spins and all claimed, show success state
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

    if (isReady || user) {
      loadData();
    }
  }, [isReady, user]);

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const timeUntilReset = getTimeUntilReset();
      setCountdown(timeUntilReset);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle spin
  const handleSpin = async () => {
    if (isSpinning || !status?.canSpin) return;

    const token = getSessionToken();
    if (!token) {
      setError('Please sign in to spin');
      return;
    }

    try {
      setIsSpinning(true);
      setCurrentSpin(null);
      setError(null);
      triggerHaptic('medium', isInFarcaster);

      // Call spin API
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

      // Calculate rotation to land on winning token
      // The wheel has N segments, each segment is 360/N degrees
      // Segment 0 starts at -90 degrees (top of SVG), pointer is fixed at top
      const winningToken = data.spin.token;
      const tokenIndex = tokens.findIndex(t => t.id === winningToken.id);
      const numSegments = tokens.length;
      const segmentAngle = 360 / numSegments;
      
      // Calculate where the segment center needs to be
      const segmentCenterOffset = (tokenIndex + 0.5) * segmentAngle;
      const targetAngle = 360 - segmentCenterOffset; // Target position (mod 360)
      
      // Account for current wheel position
      const currentAngle = rotation % 360;
      let additionalRotation = targetAngle - currentAngle;
      if (additionalRotation < 0) additionalRotation += 360;
      
      // Add random full rotations (4-6 spins) for visual effect
      const fullSpins = Math.floor(Math.random() * 3) + 4;
      
      // Final rotation: current + full spins + precise additional rotation
      const finalRotation = rotation + (fullSpins * 360) + additionalRotation;

      console.log('🎯 Spin calculation:', {
        winningToken: winningToken.symbol,
        tokenIndex,
        numSegments,
        segmentAngle,
        segmentCenterOffset,
        targetAngle,
        currentAngle,
        additionalRotation,
        finalRotation
      });

      setRotation(finalRotation);

      // Wait for animation then show result
      setTimeout(() => {
        setCurrentSpin(data.spin);
        
        // Only add to winnings if it's a win
        if (data.spin.isWin) {
          triggerHaptic('success', isInFarcaster);
          setShowWinModal(true); // Show win modal
          setAllSpins(prev => [...prev, {
            symbol: data.spin.token.symbol,
            displayAmount: data.spin.displayAmount,
            color: data.spin.token.color
          }]);
        } else {
          // No win - different haptic
          triggerHaptic('warning', isInFarcaster);
        }
        
        setStatus(prev => ({
          ...prev,
          spinsUsedToday: data.status.spinsUsedToday,
          spinsRemaining: data.status.spinsRemaining,
          canSpin: data.status.canSpin
        }));
        setIsSpinning(false);
      }, 3500);

    } catch (err) {
      console.error('Spin error:', err);
      setError(err.message);
      setIsSpinning(false);
      triggerHaptic('error', isInFarcaster);
    }
  };

  // State for donation mode
  const [isDonating, setIsDonating] = useState(false);

  // Handle claim (or donate if isDonation=true)
  const handleClaim = async (isDonation = false) => {
    if (!address || !isConnected) {
      setError('Please connect your wallet');
      return;
    }

    const token = getSessionToken();
    if (!token) {
      setError('Please sign in');
      return;
    }

    try {
      setIsClaiming(true);
      setIsDonating(isDonation);
      setError(null);
      triggerHaptic('medium', isInFarcaster);

      // Get claim data for all unclaimed winnings
      const res = await fetch('/api/dailyspin/claim-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          walletAddress: address,
          donate: isDonation // Send to donation wallet if true
        })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get claim data');
      }

      setClaimsData(data.claims);
      setCurrentClaimIndex(0);

      // Start first claim transaction
      executeClaimTransaction(data.claims[0]);

    } catch (err) {
      console.error('Claim/Donate error:', err);
      setError(err.message);
      setIsClaiming(false);
      setIsDonating(false);
      triggerHaptic('error', isInFarcaster);
    }
  };

  // Execute claim transaction
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

  // Handle transaction confirmation
  const handleTransactionConfirmed = async (txHash) => {
    try {
      const currentClaim = claimsData[currentClaimIndex];
      
      // Mark winnings as claimed (or donated)
      const token = getSessionToken();
      await fetch('/api/dailyspin/mark-claimed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          winningIds: currentClaim.winningIds,
          txHash,
          isDonation: isDonating // Pass donation flag
        })
      });

      // Check if more claims to process
      const nextIndex = currentClaimIndex + 1;
      if (nextIndex < claimsData.length) {
        setCurrentClaimIndex(nextIndex);
        resetWrite();
        setTimeout(() => {
          executeClaimTransaction(claimsData[nextIndex]);
        }, 500);
      } else {
        // All claims complete!
        setClaimedWinnings([...allSpins]); // Save winnings for sharing before clearing
        setWasDonation(isDonating); // Remember if this was a donation
        setClaimSuccess(true);
        setIsClaiming(false);
        setIsDonating(false);
        setAllSpins([]); // Clear winnings display
        triggerHaptic('success', isInFarcaster);
      }
    } catch (err) {
      console.error('Error handling confirmation:', err);
      setError(err.message);
      setIsClaiming(false);
    }
  };

  // Handle share (with winnings)
  const handleShare = async () => {
    triggerHaptic('medium', isInFarcaster);
    
    // Use claimedWinnings (saved before clearing) for the share text
    const winningsToShare = claimedWinnings.length > 0 ? claimedWinnings : allSpins;
    
    // Aggregate same tokens together
    const aggregated = {};
    for (const spin of winningsToShare) {
      if (!aggregated[spin.symbol]) {
        aggregated[spin.symbol] = 0;
      }
      aggregated[spin.symbol] += parseFloat(spin.displayAmount);
    }
    
    // Format the aggregated winnings with proper grammar
    const tokenList = Object.entries(aggregated).map(([symbol, amount]) => `${amount.toFixed(4)} $${symbol}`);
    let winningsSummary = 'tokens';
    if (tokenList.length === 1) {
      winningsSummary = tokenList[0];
    } else if (tokenList.length === 2) {
      winningsSummary = `${tokenList[0]} and ${tokenList[1]}`;
    } else if (tokenList.length > 2) {
      // Oxford comma: "A, B, and C"
      winningsSummary = `${tokenList.slice(0, -1).join(', ')}, and ${tokenList[tokenList.length - 1]}`;
    }
    const shareText = `I just claimed ${winningsSummary} on the /mintedmerch Daily Spin and boosted my Mojo Score!\n\nSpin to win tokens daily 👇`;
    
    try {
      const { sdk } = await import('@farcaster/frame-sdk');
      await sdk.actions.composeCast({
        text: shareText,
        embeds: [`${window.location.origin}/dailyspin`]
      });
    } catch (err) {
      console.error('Share error:', err);
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareText);
      alert('Share text copied to clipboard!');
    }
  };

  // Handle generic share (when no specific winnings to show)
  const handleShareGeneric = async () => {
    triggerHaptic('medium', isInFarcaster);
    
    const shareText = `I just spun the /mintedmerch Daily Spin and boosted my Mojo Score!\n\nSpin to win tokens daily 👇`;
    
    try {
      const { sdk } = await import('@farcaster/frame-sdk');
      await sdk.actions.composeCast({
        text: shareText,
        embeds: [`${window.location.origin}/dailyspin`]
      });
    } catch (err) {
      console.error('Share error:', err);
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareText);
      alert('Share text copied to clipboard!');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3eb489] mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!status) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Daily Token Spin</h1>
          <p className="text-gray-400">Please sign in to spin the wheel!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4 overflow-x-hidden">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <img 
            src="/MintedMerchDailySpin.png" 
            alt="Minted Merch Daily Spin" 
            className="mx-auto h-28 object-contain"
          />
        </div>

        {/* Wheel */}
        <div className="relative mb-6">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
            <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg"></div>
          </div>

          {/* Wheel Container */}
          <div className="relative w-72 h-72 mx-auto">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full transition-transform duration-[3500ms] ease-out"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <defs>
                {/* Define clip paths for circular logos */}
                {tokens.map((token, index) => (
                  <clipPath key={`clip-${token.id}`} id={`clip-${index}`}>
                    <circle cx="0" cy="0" r="8" />
                  </clipPath>
                ))}
              </defs>
              
              {tokens.map((token, index) => {
                const numSegments = tokens.length;
                const segmentAngle = 360 / numSegments;
                // Start at top (-90 degrees)
                const startAngle = index * segmentAngle - 90;
                const endAngle = startAngle + segmentAngle;
                const largeArc = segmentAngle > 180 ? 1 : 0;

                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;

                const x1 = 50 + 45 * Math.cos(startRad);
                const y1 = 50 + 45 * Math.sin(startRad);
                const x2 = 50 + 45 * Math.cos(endRad);
                const y2 = 50 + 45 * Math.sin(endRad);

                // Position for logo/text (centered in segment)
                const midAngle = (startAngle + endAngle) / 2;
                const midRad = (midAngle * Math.PI) / 180;
                const logoX = 50 + 30 * Math.cos(midRad);
                const logoY = 50 + 30 * Math.sin(midRad);

                return (
                  <g key={token.id}>
                    {/* Segment */}
                    <path
                      d={`M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill={token.color}
                      stroke="#1f2937"
                      strokeWidth="1"
                    />
                    
                    {/* Logo or text */}
                    {token.logoUrl ? (
                      <g transform={`translate(${logoX}, ${logoY})`}>
                        {/* White circle background for logo */}
                        <circle cx="0" cy="0" r="9" fill="white" />
                        <circle cx="0" cy="0" r="8" fill="white" />
                        <image
                          href={token.logoUrl}
                          x="-8"
                          y="-8"
                          width="16"
                          height="16"
                          clipPath={`url(#clip-${index})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </g>
                    ) : (
                      // MISS segment - show red X
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
              
              {/* Center circle with user profile picture */}
              <defs>
                <clipPath id="centerClip">
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
                  clipPath="url(#centerClip)"
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

        {/* Current Spin Result - Only show for losses (wins show modal) */}
        {currentSpin && !currentSpin.isWin && (
          <div className="rounded-xl p-4 mb-4 border bg-gradient-to-r from-gray-600/20 to-gray-500/20 border-gray-500/30">
            <p className="text-center text-gray-300">
              🥲 {currentSpin.message || 'Better Luck Next Time!'}
              {status.canSpin && <span className="block text-sm mt-1 text-gray-400">Spin again!</span>}
            </p>
          </div>
        )}

        {/* Win Modal */}
        {showWinModal && currentSpin?.isWin && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 max-w-sm w-full border border-[#3eb489]/30 shadow-2xl">
              {/* Header */}
              <div className="text-center mb-3">
                <h2 className="text-2xl font-bold text-white">You Won:</h2>
              </div>
              {/* Token info - compact 2-line layout */}
              <div className="bg-black/30 rounded-xl p-4 mb-3">
                <div className="flex items-center gap-3">
                  {/* Token logo */}
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
                  {/* Token name and amount */}
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
                {/* Token description */}
                {tokens.find(t => t.id === currentSpin.token.id)?.description && (
                  <p className="text-gray-400 text-sm mt-3 pt-3 border-t border-white/10">
                    {tokens.find(t => t.id === currentSpin.token.id)?.description}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                {/* View on DexScreener - use custom URL if available */}
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
                
                {/* Shop Collection link - uses shop_url from token if available */}
                {(() => {
                  const tokenData = tokens.find(t => t.id === currentSpin.token.id);
                  const shopUrl = tokenData?.shopUrl || '/';
                  const buttonText = tokenData?.shopUrl ? `Shop ${currentSpin.token.symbol} Collection` : 'Shop Merch Collection';
                  return (
                    <a
                      href={shopUrl}
                      onClick={(e) => {
                        e.preventDefault();
                        setShowWinModal(false);
                        window.location.href = shopUrl;
                      }}
                      className="w-full py-3 bg-[#3eb489] hover:bg-[#2d9970] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <span>{buttonText}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </a>
                  );
                })()}

                {/* Continue spinning or close */}
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

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Spin Button */}
          {status.canSpin && (
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
          )}

          {/* Claim Button */}
          {!status.canSpin && allSpins.length > 0 && !claimSuccess && (
            <div className="space-y-2">
              {status.canClaim === false ? (
                <>
                  {/* Low Mojo score - show Mojo boost option */}
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
                    <p className="text-yellow-400 text-sm">
                      ⚠️ Mojo score of 0.2+ required to claim tokens.
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      Your score: {status.mojoScore} - Claim your Mojo boost & try again tomorrow!
                    </p>
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
            </div>
          )}

          {/* Claim Success - just show share button, success message moves below winnings */}
          {claimSuccess && (
            <div className="text-center">
              <button
                onClick={handleShare}
                className="w-full py-4 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white font-bold rounded-xl 
                         hover:from-[#7C3AED] hover:to-[#6D28D9] transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
              >
                <span>Share Your Winnings</span>
                <svg className="w-5 h-5" viewBox="0 0 520 457" fill="currentColor">
                  <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
                </svg>
              </button>
            </div>
          )}

          {/* No spins left, nothing to claim */}
          {!status.canSpin && allSpins.length === 0 && !claimSuccess && (
            <div className="text-center space-y-4">
              <div className="text-gray-400">
                <p>No spins remaining today.</p>
                <p className="text-sm mt-2">
                  Next spin in: {String(countdown.hours).padStart(2, '0')}:
                  {String(countdown.minutes).padStart(2, '0')}:
                  {String(countdown.seconds).padStart(2, '0')}
                </p>
              </div>
              
              <button
                onClick={claimedWinnings.length > 0 ? handleShare : handleShareGeneric}
                className="w-full py-4 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white font-bold rounded-xl 
                         hover:from-[#7C3AED] hover:to-[#6D28D9] transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
              >
                <span>{claimedWinnings.length > 0 ? 'Share Your Winnings' : 'Share Daily Spin'}</span>
                <svg className="w-5 h-5" viewBox="0 0 520 457" fill="currentColor">
                  <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Your Winnings Today - show allSpins before claim, claimedWinnings after */}
        {(allSpins.length > 0 || claimedWinnings.length > 0) && (
          <div className="bg-gray-800/50 rounded-xl px-4 py-2 mt-4 border border-gray-700">
            <h3 className="text-white font-bold mb-1">
              Recent Winnings
              {claimSuccess && (
                <span className="ml-2 text-sm font-normal text-green-400">
                  ({wasDonation ? 'Mojo Boosted' : 'Claimed'})
                </span>
              )}
            </h3>
            <div className="space-y-1">
              {/* Show allSpins if still unclaimed, otherwise show claimedWinnings */}
              {(allSpins.length > 0 ? allSpins : claimedWinnings).map((spin, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-gray-400">${spin.symbol}</span>
                  <span className="font-mono" style={{ color: spin.color }}>{spin.displayAmount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next spin countdown - show after claiming when no spins left */}
        {claimSuccess && !status.canSpin && (
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 mt-4 border border-green-500/30">
            <p className="text-gray-400 text-sm text-center">
              Next spin in: {String(countdown.hours).padStart(2, '0')}:
              {String(countdown.minutes).padStart(2, '0')}:
              {String(countdown.seconds).padStart(2, '0')}
            </p>
          </div>
        )}

        {/* Mojo Status - Single Line */}
        <div className="bg-gray-800/50 rounded-xl px-4 py-3 my-4 border border-gray-700">
          <div className="flex items-center justify-center gap-2 flex-wrap text-sm">
            <span className="text-gray-400">Mojo Score:</span>
            <span className="text-[#3eb489] font-bold">{status.mojoScore}</span>
            <span className={`font-bold ${
              status.mojoTier === 'Gold' ? 'text-yellow-400' :
              status.mojoTier === 'Silver' ? 'text-gray-300' :
              'text-orange-400'
            }`}>
              {status.mojoTier} ({status.dailyAllocation} {status.dailyAllocation === 1 ? 'spin' : 'spins'}/day)
            </span>
            <span className="text-white">{status.spinsUsedToday}/{status.dailyAllocation} used</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-center text-sm">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-2 text-gray-400 text-xs underline w-full text-center"
            >
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

        {/* Info Section */}
        <div className="mt-8 p-4 bg-gray-800/30 rounded-xl border border-gray-700">
          <h3 className="text-white font-bold mb-2">How It Works:</h3>
          <ul className="text-gray-400 text-sm space-y-1">
            <li>• Your Mojo Score determines daily spins (1-3)</li>
            <li>• Each spin is a chance to win tokens</li>
            <li>• Complete all spins, then claim all tokens</li>
            <li>• Resets daily at 8:00 AM PST</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
