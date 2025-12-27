'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getTimeUntilReset } from '@/lib/timezone';
import { triggerHaptic } from '@/lib/haptics';
import { getAddress } from 'viem';

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
  const { isInFarcaster, isReady, getFid, user, getUsername, getPfpUrl } = useFarcaster();
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending: isTxPending, error: writeError } = useWriteContract();
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

  // Countdown
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // Get session token
  const getSessionToken = () => localStorage.getItem('fc_session_token');

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
      const winningToken = data.spin.token;
      const tokenIndex = tokens.findIndex(t => t.id === winningToken.id);
      const segmentAngle = 360 / tokens.length;
      const segmentCenterAngle = tokenIndex * segmentAngle + (segmentAngle / 2);
      const pointerAngle = 270; // Top position
      const rotationNeeded = pointerAngle - segmentCenterAngle;
      const fullSpins = Math.floor(Math.random() * 3) + 4;
      const totalSpins = fullSpins * 360;
      const finalRotation = rotation + totalSpins + rotationNeeded;

      setRotation(finalRotation);

      // Wait for animation then show result
      setTimeout(() => {
        setCurrentSpin(data.spin);
        
        // Only add to winnings if it's a win
        if (data.spin.isWin) {
          triggerHaptic('success', isInFarcaster);
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

  // Handle claim
  const handleClaim = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet to claim');
      return;
    }

    const token = getSessionToken();
    if (!token) {
      setError('Please sign in to claim');
      return;
    }

    try {
      setIsClaiming(true);
      setError(null);
      triggerHaptic('medium', isInFarcaster);

      // Get claim data for all unclaimed winnings
      const res = await fetch('/api/dailyspin/claim-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ walletAddress: address })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get claim data');
      }

      setClaimsData(data.claims);
      setCurrentClaimIndex(0);

      // Start first claim transaction
      await executeClaimTransaction(data.claims[0]);

    } catch (err) {
      console.error('Claim error:', err);
      setError(err.message);
      setIsClaiming(false);
      triggerHaptic('error', isInFarcaster);
    }
  };

  // Execute claim transaction
  const executeClaimTransaction = async (claim) => {
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
      
      // Mark winnings as claimed
      const token = getSessionToken();
      await fetch('/api/dailyspin/mark-claimed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          winningIds: currentClaim.winningIds,
          txHash
        })
      });

      // Check if more claims to process
      const nextIndex = currentClaimIndex + 1;
      if (nextIndex < claimsData.length) {
        setCurrentClaimIndex(nextIndex);
        await executeClaimTransaction(claimsData[nextIndex]);
      } else {
        // All claims complete!
        setClaimSuccess(true);
        setIsClaiming(false);
        triggerHaptic('success', isInFarcaster);
      }
    } catch (err) {
      console.error('Error handling confirmation:', err);
      setError(err.message);
      setIsClaiming(false);
    }
  };

  // Handle share
  const handleShare = async () => {
    triggerHaptic('medium', isInFarcaster);
    
    const winningsSummary = allSpins.map(s => `${s.displayAmount} $${s.symbol}`).join(' + ');
    const shareText = `🎰 I just won ${winningsSummary} on the @mintedmerch Daily Spin!\n\nSpin to win tokens daily 👇`;
    
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
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">🎰 Daily Token Spin</h1>
          <p className="text-gray-400">Spin to win partner tokens!</p>
        </div>

        {/* Mojo Status */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Mojo Score</span>
            <span className="text-[#3eb489] font-bold">{status.mojoScore}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Daily Spins</span>
            <span className="text-white">
              {status.spinsUsedToday} / {status.dailyAllocation} used
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Tier</span>
            <span className={`font-bold ${
              status.mojoTier === 'Gold' ? 'text-yellow-400' :
              status.mojoTier === 'Silver' ? 'text-gray-300' :
              'text-orange-400'
            }`}>
              {status.mojoTier} ({status.dailyAllocation} spins/day)
            </span>
          </div>
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
              {tokens.map((token, index) => {
                const segmentAngle = 360 / tokens.length;
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
                const textX = 50 + 30 * Math.cos(midRad);
                const textY = 50 + 30 * Math.sin(midRad);

                return (
                  <g key={token.id}>
                    <path
                      d={`M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill={token.color}
                      stroke="#1f2937"
                      strokeWidth="0.5"
                    />
                    <text
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="6"
                      fontWeight="bold"
                      transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                    >
                      ${token.symbol}
                    </text>
                  </g>
                );
              })}
              {/* Center circle */}
              <circle cx="50" cy="50" r="12" fill="#1f2937" stroke="#3eb489" strokeWidth="2" />
              <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="5" fontWeight="bold">
                SPIN
              </text>
            </svg>
          </div>
        </div>

        {/* Current Spin Result */}
        {currentSpin && (
          <div className={`rounded-xl p-4 mb-4 border ${
            currentSpin.isWin 
              ? 'bg-gradient-to-r from-[#3eb489]/20 to-blue-500/20 border-[#3eb489]/30'
              : 'bg-gradient-to-r from-gray-600/20 to-gray-500/20 border-gray-500/30'
          }`}>
            {currentSpin.isWin ? (
              <p className="text-center text-white">
                🎉 You won <span className="font-bold text-[#3eb489]">{currentSpin.displayAmount}</span>{' '}
                <span className="font-bold" style={{ color: currentSpin.token.color }}>${currentSpin.token.symbol}</span>!
              </p>
            ) : (
              <p className="text-center text-gray-300">
                😢 {currentSpin.message || 'Better Luck Next Time!'}
                {status.canSpin && <span className="block text-sm mt-1 text-gray-400">Spin again!</span>}
              </p>
            )}
          </div>
        )}

        {/* All Spins Summary */}
        {allSpins.length > 0 && !claimSuccess && (
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700">
            <h3 className="text-white font-bold mb-2">Your Winnings</h3>
            <div className="space-y-2">
              {allSpins.map((spin, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-gray-400">${spin.symbol}</span>
                  <span className="font-mono" style={{ color: spin.color }}>{spin.displayAmount}</span>
                </div>
              ))}
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
                `🎰 Spin (${status.spinsRemaining} left)`
              )}
            </button>
          )}

          {/* Claim Button */}
          {!status.canSpin && allSpins.length > 0 && !claimSuccess && (
            <button
              onClick={handleClaim}
              disabled={isClaiming || !isConnected}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl 
                       hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 shadow-lg"
            >
              {isClaiming ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Claiming {currentClaimIndex + 1}/{claimsData.length}...
                </span>
              ) : !isConnected ? (
                'Connect Wallet to Claim'
              ) : (
                '🎁 Claim All Tokens'
              )}
            </button>
          )}

          {/* Claim Success */}
          {claimSuccess && (
            <div className="text-center space-y-4">
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-6 border border-green-500/30">
                <div className="text-4xl mb-2">🎉</div>
                <h3 className="text-xl font-bold text-white mb-2">Tokens Claimed!</h3>
                <p className="text-gray-400">Your tokens have been sent to your wallet.</p>
              </div>
              
              <button
                onClick={handleShare}
                className="w-full py-4 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white font-bold rounded-xl 
                         hover:from-[#7C3AED] hover:to-[#6D28D9] transition-all duration-200 shadow-lg"
              >
                📢 Share Your Winnings
              </button>
            </div>
          )}

          {/* No spins left, nothing to claim */}
          {!status.canSpin && allSpins.length === 0 && !claimSuccess && (
            <div className="text-center text-gray-400">
              <p>No spins remaining today.</p>
              <p className="text-sm mt-2">
                Next spin in: {String(countdown.hours).padStart(2, '0')}:
                {String(countdown.minutes).padStart(2, '0')}:
                {String(countdown.seconds).padStart(2, '0')}
              </p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-center">{error}</p>
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
          <h3 className="text-white font-bold mb-2">How it works</h3>
          <ul className="text-gray-400 text-sm space-y-1">
            <li>• Your Mojo Score determines daily spins (1-3)</li>
            <li>• Each spin wins ~$0.01 worth of a partner token</li>
            <li>• Complete all spins, then claim all at once</li>
            <li>• Resets daily at 8:00 AM PST</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

