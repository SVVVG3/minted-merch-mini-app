'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/miniapp-sdk';
import { getTimeUntilReset } from '@/lib/timezone';
import { ethers } from 'ethers';
import { useAccount, useConnect } from 'wagmi';

export function SpinWheel({ onSpinComplete, isVisible = true }) {
  const { isInFarcaster, isReady, getFid } = useFarcaster();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [canSpin, setCanSpin] = useState(false);
  const [userStatus, setUserStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [wheelGlow, setWheelGlow] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  // Blockchain-specific state
  const [txStatus, setTxStatus] = useState(null); // 'pending', 'confirmed', 'failed'
  const [txHash, setTxHash] = useState(null);
  const [userWalletAddress, setUserWalletAddress] = useState(null);

  // Define wheel segments with enhanced visual styling
  const wheelSegments = [
    { min: 25, max: 35, color: '#ef4444', gradient: 'from-red-400 to-red-600', label: '25-35', rarity: 'common' },
    { min: 36, max: 50, color: '#f97316', gradient: 'from-orange-400 to-orange-600', label: '36-50', rarity: 'common' },
    { min: 51, max: 65, color: '#eab308', gradient: 'from-yellow-400 to-yellow-600', label: '51-65', rarity: 'uncommon' },
    { min: 66, max: 80, color: '#22c55e', gradient: 'from-green-400 to-green-600', label: '66-80', rarity: 'uncommon' },
    { min: 81, max: 90, color: '#3b82f6', gradient: 'from-blue-400 to-blue-600', label: '81-90', rarity: 'rare' },
    { min: 91, max: 100, color: '#8b5cf6', gradient: 'from-purple-400 to-purple-600', label: '91-100', rarity: 'epic' }
  ];

  // Share check-in result function
  const handleShareCheckIn = async () => {
    if (!isInFarcaster || !spinResult) return;

    // Add haptic feedback for share action
    await triggerHaptic('medium');

    try {
      // Create dynamic OG image URL with check-in data
      const baseUrl = window.location.origin;
      const shareParams = new URLSearchParams({
        checkin: 'true',
        points: spinResult.pointsEarned.toString(),
        streak: spinResult.newStreak.toString(),
        total: spinResult.totalPoints.toString(),
        base: spinResult.basePoints.toString(),
        bonus: spinResult.streakBonus.toString(),
        t: Date.now().toString() // Cache busting
      });
      
      const shareUrl = `${baseUrl}?${shareParams.toString()}`;
      
      // Create share text
      const streakEmoji = spinResult.newStreak >= 30 ? "👑" : 
                        spinResult.newStreak >= 14 ? "🔥" : 
                        spinResult.newStreak >= 7 ? "⚡" : 
                        spinResult.newStreak >= 3 ? "🌟" : "💫";
      
      const shareText = `🎯 Daily check-in complete!\n\n+${spinResult.pointsEarned} points earned! ${spinResult.streakBonus > 0 ? `(${spinResult.basePoints} base + ${spinResult.streakBonus} streak bonus)` : ''}\n\n${streakEmoji} ${spinResult.newStreak} day streak • 💎 ${spinResult.totalPoints} total points\n\nKeep your streak going on /mintedmerch! 🎰`;

      // Use the Farcaster SDK composeCast action
      const { sdk } = await import('../lib/frame');
      const result = await sdk.actions.composeCast({
        text: shareText,
        embeds: [shareUrl],
      });
      
      console.log('Check-in cast composed:', result);
    } catch (error) {
      console.error('Error sharing check-in:', error);
      // Fallback to copying link
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Check-in result copied to clipboard!');
      } catch (err) {
        console.log('Error copying to clipboard:', err);
      }
    }
  };

  // Load user's check-in status
  useEffect(() => {
    if (!isInFarcaster || !isReady) return;
    
    const userFid = getFid();
    if (!userFid) return;

    loadUserStatus(userFid);
  }, [isInFarcaster, isReady]);

  // Countdown timer effect for next spin availability
  useEffect(() => {
    const updateCountdown = () => {
      const timeUntilReset = getTimeUntilReset();
      setCountdown({
        hours: timeUntilReset.hours,
        minutes: timeUntilReset.minutes,
        seconds: timeUntilReset.seconds
      });
    };

    // Update immediately
    updateCountdown();

    // Then update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadUserStatus = async (userFid) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/points/checkin?userFid=${userFid}`);
      const result = await response.json();
      
      if (result.success) {
        setUserStatus(result.data);
        setCanSpin(result.data.canCheckInToday);
      }
    } catch (error) {
      console.error('Error loading user status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Haptic feedback functions
  const triggerHaptic = async (type = 'light') => {
    if (!isInFarcaster) return;
    
    try {
      const capabilities = await sdk.getCapabilities();
      
      switch (type) {
        case 'light':
          if (capabilities.includes('haptics.selectionChanged')) {
            await sdk.haptics.selectionChanged();
          }
          break;
        case 'medium':
          if (capabilities.includes('haptics.impactOccurred')) {
            await sdk.haptics.impactOccurred('medium');
          }
          break;
        case 'heavy':
          if (capabilities.includes('haptics.impactOccurred')) {
            await sdk.haptics.impactOccurred('heavy');
          }
          break;
        case 'success':
          if (capabilities.includes('haptics.notificationOccurred')) {
            await sdk.haptics.notificationOccurred('success');
          }
          break;
      }
    } catch (error) {
      console.log('Haptics not available:', error);
    }
  };

  const getStreakMessage = (streak) => {
    if (streak >= 30) return "🔥🔥🔥 LEGENDARY STREAK! You're unstoppable!";
    if (streak >= 14) return "🔥🔥 TWO WEEK STREAK! Amazing dedication!";
    if (streak >= 7) return "🔥 WEEK STREAK! You're on fire!";
    if (streak >= 3) return "⚡ Hot streak! Keep it going!";
    if (streak >= 1) return "✨ Great start! Come back tomorrow!";
    return "🎯 Ready to start your streak?";
  };

  const getStreakEmoji = (streak) => {
    if (streak >= 30) return "👑";
    if (streak >= 14) return "🔥";
    if (streak >= 7) return "⚡";
    if (streak >= 3) return "🌟";
    return "💫";
  };

  // Connect wallet using Farcaster Mini App connector
  const connectWallet = async () => {
    console.log('🔗 Connecting wallet...', { isConnected, connectors });
    
    if (isConnected && address) {
      console.log('✅ Already connected:', address);
      return address;
    }
    
    try {
      // Find the Farcaster Mini App connector
      const farcasterConnector = connectors.find(c => c.name === 'Farcaster Mini App');
      if (!farcasterConnector) {
        throw new Error('Farcaster Mini App connector not found');
      }
      
      console.log('🔗 Connecting with Farcaster connector...');
      await connect({ connector: farcasterConnector });
      
      // Wait a moment for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (address) {
        console.log('✅ Connected to wallet:', address);
        return address;
      } else {
        throw new Error('Connection successful but no address available');
      }
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      throw error;
    }
  };

  // Main spin function (always on-chain)
  const handleSpin = async () => {
    console.log('🎰 Spin button clicked!', { isInFarcaster, isReady, isSpinning, canSpin });
    
    if (!isInFarcaster || !isReady || isSpinning || !canSpin) {
      console.log('❌ Spin blocked:', { isInFarcaster, isReady, isSpinning, canSpin });
      return;
    }

    const userFid = getFid();
    console.log('👤 User FID:', userFid);
    if (!userFid) {
      console.log('❌ No user FID');
      return;
    }

    try {
      // Trigger haptic feedback on button press
      await triggerHaptic('medium');

      // Connect wallet using Farcaster Mini App connector
      console.log('🔗 Connecting wallet...');
      const walletAddress = await connectWallet();
      if (!walletAddress) {
        console.error('❌ No wallet address available');
        alert('❌ Wallet connection failed. Please try again.');
        return;
      }

      console.log('✅ Wallet connected:', walletAddress);

    setUserWalletAddress(walletAddress);
    setIsSpinning(true);
    setSpinResult(null);
    setWheelGlow(true);
    setTxStatus('pending');

    try {
      // Step 1: Request spin permit from backend
      console.log('🎫 Requesting spin permit...');
      const permitResponse = await fetch('/api/spin-permit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress: walletAddress, 
          fid: userFid 
        }),
      });

      const permitData = await permitResponse.json();
      
      if (!permitData.success) {
        throw new Error(permitData.error || 'Failed to get spin permit');
      }

      console.log('✅ Spin permit received');

      // Step 2: Submit blockchain transaction
      console.log('⛓️ Submitting blockchain transaction...');
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Contract ABI for the spin function
      const contractABI = [
        "function spin(tuple(address user, uint256 dayStart, uint256 expiresAt, bytes32 nonce) permit, bytes signature, bytes32 anonId)"
      ];
      
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_SPIN_REGISTRY_CONTRACT_ADDRESS || '0xe424E28FCDE2E009701F7d592842C56f7E041a3f',
        contractABI,
        signer
      );

      // Submit transaction
      const tx = await contract.spin(
        permitData.permit,
        permitData.signature,
        permitData.anonId
      );

      console.log('📤 Transaction submitted:', tx.hash);
      setTxHash(tx.hash);

      // Wait for confirmation
      console.log('⏳ Waiting for confirmation...');
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt);

      setTxStatus('confirmed');

      // Step 3: Confirm with backend and get points
      console.log('🎯 Confirming spin with backend...');
      const checkinResponse = await fetch('/api/points/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userFid, 
          txHash: tx.hash,
          skipBlockchainCheck: false
        }),
      });

      const result = await checkinResponse.json();
      
      if (result.success) {
        await handleSpinSuccess(result);
      } else {
        throw new Error(result.error || 'Failed to confirm spin');
      }

    } catch (error) {
      console.error('❌ On-chain spin failed:', error);
      setTxStatus('failed');
      await handleSpinError(error);
    }
  } catch (error) {
    console.error('❌ Spin function error:', error);
    alert(`❌ Error: ${error.message}`);
    setIsSpinning(false);
    setWheelGlow(false);
    setTxStatus(null);
  }
};

  // Unified spin success handler
  const handleSpinSuccess = async (result) => {
    const points = result.data.pointsEarned;
    const basePoints = result.data.basePoints;
    const streakBonus = result.data.streakBonus;
    
    // Calculate which segment the points landed on
    const targetSegment = wheelSegments.find(
      segment => basePoints >= segment.min && basePoints <= segment.max
    );
    
    if (targetSegment) {
      // Calculate target rotation to land on the correct segment
      const segmentIndex = wheelSegments.indexOf(targetSegment);
      const segmentAngle = 360 / wheelSegments.length;
      
      // Find the center angle of the target segment
      const segmentCenterAngle = segmentIndex * segmentAngle + (segmentAngle / 2);
      
      // The pointer is at the top (12 o'clock = 270 degrees in standard rotation)
      const pointerAngle = 270; // Top position
      const rotationNeeded = pointerAngle - segmentCenterAngle;
      
      // Add multiple full rotations for effect (4-6 full spins)
      const fullSpins = Math.floor(Math.random() * 3) + 4;
      const totalSpins = fullSpins * 360;
      
      // Final rotation: current position + full spins + alignment rotation
      const finalRotation = rotation + totalSpins + rotationNeeded;
      
      // Debug logging to verify alignment
      console.log(`🎯 Spinner Debug (on-chain):`, {
        basePoints,
        targetSegment: targetSegment.label,
        segmentIndex,
        segmentCenterAngle: segmentCenterAngle.toFixed(1),
        rotationNeeded: rotationNeeded.toFixed(1),
        finalRotation: finalRotation.toFixed(1),
        onChain: true,
        txHash: txHash || 'N/A'
      });
      
      setRotation(finalRotation);
      
      // Show result after animation completes
      setTimeout(async () => {
        // Trigger result haptic feedback and animations
        await triggerHaptic('success');
        setScreenShake(true);
        setShowConfetti(true);
        setWheelGlow(false);
        
        setTimeout(() => setScreenShake(false), 500);
        setTimeout(() => setShowConfetti(false), 3000);
        
        setSpinResult({
          pointsEarned: points,
          basePoints: basePoints,
          streakBonus: streakBonus,
          newStreak: result.data.newStreak,
          totalPoints: result.data.totalPoints,
          streakBroken: result.data.streakBroken,
          segment: targetSegment,
          onChain: true,
          txHash: txHash
        });
        setIsSpinning(false);
        setCanSpin(false);
        setTxStatus(null);
        setTxHash(null);
        
        // Callback to parent component
        if (onSpinComplete) {
          onSpinComplete(result.data);
        }
      }, 3500); // Match animation duration
    }
  };

  // Unified error handler
  const handleSpinError = async (error) => {
    console.error('Spin error:', error);
    setIsSpinning(false);
    setWheelGlow(false);
    setTxStatus(null);
    setTxHash(null);
    
    // Show error message to user
    // You could add a toast notification here
    await triggerHaptic('error');
  };



  const resetWheel = () => {
    setSpinResult(null);
    setRotation(0);
    setShowConfetti(false);
    setWheelGlow(false);
    setScreenShake(false);
    if (userStatus) {
      loadUserStatus(getFid());
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`relative ${screenShake ? 'animate-pulse' : ''}`}>
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            >
              <div 
                className="w-2 h-2 rotate-45"
                style={{
                  backgroundColor: wheelSegments[Math.floor(Math.random() * wheelSegments.length)].color
                }}
              />
            </div>
          ))}
        </div>
      )}

             <div className="flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 via-white to-green-50 rounded-xl shadow-xl w-full border border-gray-100">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6">
          {/* Logo with glow effect */}
          <div className="mb-4 relative">
            <img 
              src="/MintedMerchSpinnerLogo.png" 
              alt="Minted Merch" 
              className={`h-16 mx-auto transition-all duration-300 ${wheelGlow ? 'drop-shadow-lg scale-110' : ''}`}
            />
            {wheelGlow && (
              <div className="absolute inset-0 bg-yellow-400 blur-xl opacity-20 rounded-full"></div>
            )}
          </div>
          
          <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Daily Check-in
          </h2>
          
          <p className="text-gray-600 mb-3">
            Spin the wheel to earn points & be entered into raffles for FREE merch!
          </p>
          
          {userStatus && (
            <div className="space-y-2">
              {/* Points and streak display */}
              <div className="flex justify-center gap-4">
                <div className="bg-blue-100 px-3 py-1 rounded-full">
                  <span className="text-sm">
                    💎 <span className="font-semibold text-blue-700">{userStatus.totalPoints}</span> pts
                  </span>
                </div>
                <div className="bg-green-100 px-3 py-1 rounded-full">
                  <span className="text-sm">
                    {getStreakEmoji(userStatus.checkinStreak)} <span className="font-semibold text-green-700">{userStatus.checkinStreak}</span> day{userStatus.checkinStreak !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              
              {/* Streak message */}
              <div className="text-sm font-medium text-gray-700">
                {getStreakMessage(userStatus.checkinStreak)}
              </div>

              {/* Next milestone progress */}
              {userStatus.checkinStreak < 30 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">
                    Next milestone: {userStatus.checkinStreak < 3 ? '3 days' : userStatus.checkinStreak < 7 ? '7 days' : userStatus.checkinStreak < 14 ? '14 days' : '30 days'}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(userStatus.checkinStreak % (userStatus.checkinStreak < 3 ? 3 : userStatus.checkinStreak < 7 ? 7 : userStatus.checkinStreak < 14 ? 14 : 30)) / (userStatus.checkinStreak < 3 ? 3 : userStatus.checkinStreak < 7 ? 7 : userStatus.checkinStreak < 14 ? 14 : 30) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Enhanced Spin Wheel */}
        <div className="relative mb-4 sm:mb-6">
          {/* Glow effect during spin */}
          {wheelGlow && (
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-full blur-xl opacity-30 scale-110 animate-pulse"></div>
          )}
          
          {/* Wheel Container */}
          <div className={`relative w-56 h-56 sm:w-64 sm:h-64 transition-all duration-500 ${wheelGlow ? 'scale-105' : ''}`}>
            {/* Wheel SVG with enhanced styling */}
            <svg 
              className="w-full h-full drop-shadow-lg" 
              viewBox="0 0 200 200"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? 'transform 3.5s cubic-bezier(0.23, 1, 0.32, 1)' : 'none'
              }}
            >
              {/* Outer ring */}
              <circle
                cx="100"
                cy="100"
                r="92"
                fill="none"
                stroke="#d1d5db"
                strokeWidth="4"
              />
              
              {/* Wheel Segments with gradients */}
              {wheelSegments.map((segment, index) => {
                const segmentAngle = 360 / wheelSegments.length;
                const startAngle = index * segmentAngle;
                const endAngle = (index + 1) * segmentAngle;
                
                // Calculate path coordinates for segment
                const centerX = 100;
                const centerY = 100;
                const radius = 88;
                
                const startAngleRad = (startAngle * Math.PI) / 180;
                const endAngleRad = (endAngle * Math.PI) / 180;
                
                const x1 = centerX + radius * Math.cos(startAngleRad);
                const y1 = centerY + radius * Math.sin(startAngleRad);
                const x2 = centerX + radius * Math.cos(endAngleRad);
                const y2 = centerY + radius * Math.sin(endAngleRad);
                
                const largeArcFlag = segmentAngle > 180 ? 1 : 0;
                
                const pathData = [
                  `M ${centerX} ${centerY}`,
                  `L ${x1} ${y1}`,
                  `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  'Z'
                ].join(' ');
                
                // Text position
                const textAngle = startAngle + segmentAngle / 2;
                const textAngleRad = (textAngle * Math.PI) / 180;
                const textRadius = radius * 0.65;
                const textX = centerX + textRadius * Math.cos(textAngleRad);
                const textY = centerY + textRadius * Math.sin(textAngleRad);
                
                // Create gradient
                const gradientId = `gradient-${index}`;
                
                return (
                  <g key={index}>
                    <defs>
                      <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={segment.color} stopOpacity="0.8" />
                        <stop offset="100%" stopColor={segment.color} stopOpacity="1" />
                      </linearGradient>
                    </defs>
                    <path
                      d={pathData}
                      fill={`url(#${gradientId})`}
                      stroke="#ffffff"
                      strokeWidth="3"
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                    />
                    <text
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="11"
                      fontWeight="bold"
                      transform={`rotate(${textAngle}, ${textX}, ${textY})`}
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    >
                      {segment.label}
                    </text>
                  </g>
                );
              })}
              
              {/* Enhanced Center Circle */}
              <circle
                cx="100"
                cy="100"
                r="18"
                fill="url(#centerGradient)"
                stroke="#ffffff"
                strokeWidth="3"
                filter="drop-shadow(0 2px 8px rgba(0,0,0,0.2))"
              />
              
              <defs>
                <radialGradient id="centerGradient">
                  <stop offset="0%" stopColor="#374151" />
                  <stop offset="100%" stopColor="#1f2937" />
                </radialGradient>
              </defs>
            </svg>
            
            {/* Enhanced Pointer - Traditional Spinner Style */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
              <div className="relative">
                {/* Main arrow pointer */}
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-gray-800 drop-shadow-lg"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Controls */}
        <div className="text-center w-full">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading your progress...
            </div>
          ) : spinResult ? (
            <div className="space-y-4 w-full">
              {/* Share Button - First in results section */}
              <button
                onClick={handleShareCheckIn}
                className="w-full bg-[#8A63D2] hover:bg-[#7C5BC7] text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {/* Official Farcaster Logo */}
                <svg className="w-5 h-5" viewBox="0 0 1000 1000" fill="currentColor">
                  <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
                  <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.445H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"/>
                  <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.445H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"/>
                </svg>
                <span>Share My Daily Spin</span>
              </button>

              {/* Enhanced Result Display */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-4 sm:p-6 transform animate-pulse">
                <div className="text-center">
                  {/* Big celebration for the points */}
                  <div className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-3 animate-bounce">
                    +{spinResult.pointsEarned} Points! 🎉
                  </div>
                  
                  {/* Points breakdown */}
                  {spinResult.streakBonus > 0 && (
                    <div className="bg-yellow-100 rounded-lg p-3 mb-3">
                      <div className="text-sm text-yellow-800 font-medium">
                        🎯 Base: {spinResult.basePoints} + 🔥 Streak Bonus: {spinResult.streakBonus}
                      </div>
                    </div>
                  )}
                  
                  {/* Streak celebration */}
                  <div className="text-lg font-bold text-gray-800 mb-2">
                    {getStreakEmoji(spinResult.newStreak)} {spinResult.newStreak} Day Streak!
                  </div>
                  
                  {/* Total points */}
                  <div className="text-sm text-gray-600 mb-3">
                    Total Points: <span className="font-bold text-blue-600">{spinResult.totalPoints}</span>
                  </div>
                  
                  {/* Motivational message */}
                  <div className="bg-blue-100 rounded-lg p-3 mb-4">
                    <div className="text-sm font-medium text-blue-800">
                      {spinResult.newStreak === 1 ? 
                        "🌟 Great start! Return at 8 AM PST for your next reward!" :
                        `⚡ Amazing! Come back at 8 AM PST to reach ${spinResult.newStreak + 1} days!`
                      }
                    </div>
                  </div>
                  
                  {spinResult.streakBroken && (
                    <div className="bg-orange-100 border border-orange-200 rounded-lg p-3 mb-4">
                      <div className="text-sm text-orange-700 font-medium">
                        🔄 Streak was reset - but you're back on track! Keep it going!
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Close Button */}
              <button
                onClick={resetWheel}
                className="w-full px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                ✨ Awesome! See you tomorrow!
              </button>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {/* Tomorrow preview for already checked in users */}
              {!canSpin && userStatus && userStatus.checkinStreak > 0 && (
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-200 rounded-xl p-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl mb-2">🔮</div>
                    <div className="text-sm font-medium text-purple-800 mb-1">
                      Tomorrow's Potential
                    </div>
                    <div className="text-xs text-purple-600">
                      Keep your {userStatus.checkinStreak + 1}-day streak going for bonus rewards!
                    </div>
                  </div>
                </div>
              )}
              
              {/* Transaction Status */}
              {(txStatus === 'pending' || txHash) && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    {txStatus === 'pending' && (
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        Confirming on-chain transaction...
                      </div>
                    )}
                    {txHash && (
                      <a 
                        href={`https://basescan.org/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        🔗 View Transaction on Basescan
                      </a>
                    )}
                  </div>
                </div>
              )}
              
              {/* Main spin button */}
              <button
                onClick={handleSpin}
                disabled={!canSpin || isSpinning}
                className={`w-full px-8 py-4 rounded-xl font-bold transition-all duration-200 transform ${
                  canSpin && !isSpinning
                    ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                } ${isSpinning ? 'animate-pulse' : ''}`}
              >
                {isSpinning ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-lg">Spinning the wheel...</span>
                    <span className="animate-bounce">🎰</span>
                  </span>
                ) : canSpin ? (
                  <span className="text-lg">✨ Spin the Wheel ✨</span>
                ) : (
                  <span className="text-lg">✅ Already Checked In Today</span>
                )}
              </button>
              
              {/* Live countdown for return users */}
              {!canSpin && (
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-2">
                    Next spin available in:
                  </div>
                  <div className="bg-gradient-to-r from-blue-100 to-green-100 border border-blue-200 rounded-lg p-3">
                    <div className="flex justify-center items-center gap-1 text-sm font-mono font-semibold text-gray-800">
                      <div className="bg-white rounded px-2 py-1 min-w-[2.5rem] text-center">
                        {countdown.hours.toString().padStart(2, '0')}
                      </div>
                      <span className="text-gray-500">h</span>
                      <div className="bg-white rounded px-2 py-1 min-w-[2.5rem] text-center">
                        {countdown.minutes.toString().padStart(2, '0')}
                      </div>
                      <span className="text-gray-500">m</span>
                      <div className="bg-white rounded px-2 py-1 min-w-[2.5rem] text-center">
                        {countdown.seconds.toString().padStart(2, '0')}
                      </div>
                      <span className="text-gray-500">s</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      until 8 AM PST
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 