'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { CheckInModal } from './CheckInModal';
import { sdk } from '@farcaster/miniapp-sdk';

export function CheckInButton() {
  const { isInFarcaster, isReady, getFid } = useFarcaster();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userStatus, setUserStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user's check-in status and points
  useEffect(() => {
    if (!isInFarcaster || !isReady) {
      setIsLoading(false);
      return;
    }
    
    const userFid = getFid();
    if (!userFid) {
      setIsLoading(false);
      return;
    }

    loadUserStatus(userFid);
  }, [isInFarcaster, isReady]);

  const loadUserStatus = async (userFid) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/points/checkin?userFid=${userFid}`);
      const result = await response.json();
      
      if (result.success) {
        setUserStatus(result.data);
      }
    } catch (error) {
      console.error('Error loading user status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = async () => {
    // Add haptic feedback for check-in action
    try {
      const capabilities = await sdk.getCapabilities();
      if (capabilities.includes('haptics.impactOccurred')) {
        await sdk.haptics.impactOccurred('medium');
      }
    } catch (error) {
      // Haptics not available, continue without feedback
      console.log('Haptics not available:', error);
    }
    
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleCheckInComplete = (result) => {
    // Reload user status after successful check-in
    if (isInFarcaster && isReady) {
      const userFid = getFid();
      if (userFid) {
        loadUserStatus(userFid);
      }
    }
  };

  // Don't show button if not in Farcaster
  if (!isInFarcaster || !isReady) {
    return null;
  }

  const canCheckIn = userStatus?.canCheckInToday;
  const totalPoints = userStatus?.totalPoints || 0;
  const streak = userStatus?.checkinStreak || 0;

  return (
    <>
      {/* Check-in Button - Rectangular button with state-based content */}
      <button
        onClick={handleOpenModal}
        className={`flex items-center justify-center px-3 py-2 rounded-lg transition-colors ${
          canCheckIn 
            ? 'bg-[#3eb489] hover:bg-[#359970] text-white' 
            : 'bg-[#3eb489] hover:bg-[#359970] text-white'
        }`}
        title={canCheckIn ? "Daily Check-in Available!" : "View Points & Streak"}
      >
        <div className="relative flex items-center gap-1">
          {canCheckIn ? (
            <>
              {/* Gift Box Icon with Ribbon - Clear Present Design */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                {/* Gift box body */}
                <rect x="4" y="8" width="16" height="12" rx="1" />
                {/* Vertical ribbon */}
                <rect x="11" y="8" width="2" height="12" />
                {/* Horizontal ribbon */}
                <rect x="4" y="13" width="16" height="2" />
                {/* Bow - left loop */}
                <path d="M8 8c0-2 2-4 4-4s4 2 4 4" stroke="currentColor" strokeWidth="1" fill="none"/>
                {/* Bow - right loop */}
                <path d="M8 8c0-2 2-2 4-2s4 0 4 2" stroke="currentColor" strokeWidth="1" fill="none"/>
                {/* Bow center knot */}
                <circle cx="12" cy="8" r="1"/>
              </svg>
              
              {/* New Check-in Available Indicator */}
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse ml-1"></div>
            </>
          ) : (
            <>
              {/* Checkmark Icon */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              
                             {/* Streak Count */}
               {streak > 0 && (
                 <div className="flex items-center gap-0.5">
                   <span className="text-xs font-semibold">{streak}</span>
                   {/* Lightning Bolt Icon */}
                   <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                     <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"/>
                   </svg>
                 </div>
               )}
            </>
          )}
        </div>
      </button>

      {/* Check-in Modal */}
      <CheckInModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCheckInComplete={handleCheckInComplete}
      />
    </>
  );
} 