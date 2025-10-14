'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { CheckInModal } from './CheckInModal';
import { haptics } from '@/lib/haptics';

export function CheckInButton() {
  const { user, isReady, getFid } = useFarcaster();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userStatus, setUserStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user's check-in status and points
  useEffect(() => {
    if (!user || !isReady) {
      setIsLoading(false);
      return;
    }
    
    const userFid = user.fid;
    if (!userFid) {
      setIsLoading(false);
      return;
    }

    loadUserStatus(userFid);
  }, [user, isReady]); // Removed getFid from dependencies to prevent infinite loop

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
    // Add haptic feedback for check-in action (works in mini app AND mobile browser)
    const isInMiniApp = user && !user.isAuthKit;
    await haptics.medium(isInMiniApp);
    
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleCheckInComplete = (result) => {
    // Reload user status after successful check-in
    if (user && isReady) {
      const userFid = getFid();
      if (userFid) {
        loadUserStatus(userFid);
      }
    }
  };

  // Don't show button if not authenticated
  if (!user || !isReady) {
    return null;
  }

  const canCheckIn = userStatus?.canCheckInToday;
  const totalPoints = userStatus?.totalPoints || 0;
  const streak = userStatus?.checkinStreak || 0;

  return (
    <>
      {/* Check-in Button - Wider rectangle for horizontal content layout */}
      <button
        onClick={handleOpenModal}
        className="flex items-center justify-center min-w-[3rem] h-12 px-2 bg-[#3eb489] hover:bg-[#359970] text-white rounded-lg transition-colors relative"
        title={canCheckIn ? "Daily Check-in Available!" : "View Points & Streak"}
      >
        {canCheckIn ? (
          <>
            {/* Custom Rewards Icon */}
            <img 
              src="/RewardsIcon.png" 
              alt="Daily Rewards" 
              className="w-6 h-6" 
            />
            
            {/* New Check-in Available Indicator */}
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          </>
        ) : (
          <div className="flex items-center gap-1">
            {/* Checkmark Icon */}
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            
            {/* Streak Count */}
            {streak > 0 && (
              <div className="flex items-center gap-0.5">
                <span className="text-xs font-semibold leading-none">{streak}</span>
                {/* Lightning Bolt Icon */}
                <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"/>
                </svg>
              </div>
            )}
          </div>
        )}
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