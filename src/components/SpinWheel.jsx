'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';

export function SpinWheel({ onSpinComplete, isVisible = true }) {
  const { isInFarcaster, isReady, getFid } = useFarcaster();
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [canSpin, setCanSpin] = useState(false);
  const [userStatus, setUserStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Define wheel segments with weighted distribution matching points system
  const wheelSegments = [
    { min: 25, max: 35, color: '#ef4444', label: '25-35' },    // Red - 40% chance (low points)
    { min: 36, max: 50, color: '#f97316', label: '36-50' },    // Orange - 40% chance (low points)
    { min: 51, max: 65, color: '#eab308', label: '51-65' },    // Yellow - 35% chance (mid points)
    { min: 66, max: 80, color: '#22c55e', label: '66-80' },    // Green - 35% chance (mid points)
    { min: 81, max: 90, color: '#3b82f6', label: '81-90' },    // Blue - 25% chance (high points)
    { min: 91, max: 100, color: '#8b5cf6', label: '91-100' }   // Purple - 25% chance (high points)
  ];

  // Load user's check-in status
  useEffect(() => {
    if (!isInFarcaster || !isReady) return;
    
    const userFid = getFid();
    if (!userFid) return;

    loadUserStatus(userFid);
  }, [isInFarcaster, isReady]);

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

  const handleSpin = async () => {
    if (!isInFarcaster || !isReady || isSpinning || !canSpin) return;

    const userFid = getFid();
    if (!userFid) return;

    setIsSpinning(true);
    setSpinResult(null);

    try {
      // Perform check-in
      const response = await fetch('/api/points/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userFid }),
      });

      const result = await response.json();
      
      if (result.success) {
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
          const targetAngle = segmentIndex * segmentAngle + (segmentAngle / 2);
          
          // Add multiple full rotations for effect (3-5 full spins)
          const fullSpins = Math.floor(Math.random() * 3) + 3;
          const finalRotation = rotation + (fullSpins * 360) + (360 - targetAngle);
          
          setRotation(finalRotation);
          
          // Show result after animation completes
          setTimeout(() => {
            setSpinResult({
              pointsEarned: points,
              basePoints: basePoints,
              streakBonus: streakBonus,
              newStreak: result.data.newStreak,
              totalPoints: result.data.totalPoints,
              streakBroken: result.data.streakBroken,
              segment: targetSegment
            });
            setIsSpinning(false);
            setCanSpin(false);
            
            // Callback to parent component
            if (onSpinComplete) {
              onSpinComplete(result.data);
            }
          }, 3000); // Match animation duration
        }
      } else {
        setIsSpinning(false);
        // Handle error - maybe user already checked in
        if (result.alreadyCheckedIn) {
          setCanSpin(false);
        }
      }
    } catch (error) {
      console.error('Error spinning wheel:', error);
      setIsSpinning(false);
    }
  };

  const resetWheel = () => {
    setSpinResult(null);
    setRotation(0);
    if (userStatus) {
      loadUserStatus(getFid());
    }
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-lg max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Daily Check-in</h2>
        <p className="text-gray-600">Spin the wheel to earn points!</p>
        
        {userStatus && (
          <div className="mt-3 text-sm text-gray-500">
            <p>Total Points: <span className="font-semibold text-blue-600">{userStatus.totalPoints}</span></p>
            <p>Streak: <span className="font-semibold text-green-600">{userStatus.checkinStreak} days</span></p>
          </div>
        )}
      </div>

      {/* Spin Wheel */}
      <div className="relative mb-6">
        {/* Wheel Container */}
        <div className="relative w-64 h-64">
          {/* Wheel SVG */}
          <svg 
            className="w-full h-full" 
            viewBox="0 0 200 200"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none'
            }}
          >
            {/* Wheel Segments */}
            {wheelSegments.map((segment, index) => {
              const segmentAngle = 360 / wheelSegments.length;
              const startAngle = index * segmentAngle;
              const endAngle = (index + 1) * segmentAngle;
              
              // Calculate path coordinates for segment
              const centerX = 100;
              const centerY = 100;
              const radius = 90;
              
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
              const textRadius = radius * 0.7;
              const textX = centerX + textRadius * Math.cos(textAngleRad);
              const textY = centerY + textRadius * Math.sin(textAngleRad);
              
              return (
                <g key={index}>
                  <path
                    d={pathData}
                    fill={segment.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={textX}
                    y={textY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                    transform={`rotate(${textAngle}, ${textX}, ${textY})`}
                  >
                    {segment.label}
                  </text>
                </g>
              );
            })}
            
            {/* Center Circle */}
            <circle
              cx="100"
              cy="100"
              r="15"
              fill="#1f2937"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </svg>
          
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-gray-800"></div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="text-center">
        {isLoading ? (
          <div className="text-gray-500">Loading...</div>
        ) : spinResult ? (
          <div className="space-y-4">
            {/* Result Display */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  +{spinResult.pointsEarned} Points!
                </div>
                {spinResult.streakBonus > 0 && (
                  <div className="text-sm text-green-700 mb-2">
                    Base: {spinResult.basePoints} + Streak Bonus: {spinResult.streakBonus}
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  <p>New Streak: {spinResult.newStreak} days</p>
                  <p>Total Points: {spinResult.totalPoints}</p>
                </div>
                {spinResult.streakBroken && (
                  <div className="text-sm text-orange-600 mt-2">
                    Streak was reset - keep checking in daily!
                  </div>
                )}
              </div>
            </div>
            
            {/* Reset Button */}
            <button
              onClick={resetWheel}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <button
            onClick={handleSpin}
            disabled={!canSpin || isSpinning}
            className={`px-8 py-3 rounded-lg font-medium transition-all ${
              canSpin && !isSpinning
                ? 'bg-blue-600 hover:bg-blue-700 text-white transform hover:scale-105'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSpinning ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Spinning...
              </span>
            ) : canSpin ? (
              'Spin to Check In!'
            ) : (
              'Already Checked In Today'
            )}
          </button>
        )}
      </div>
    </div>
  );
} 