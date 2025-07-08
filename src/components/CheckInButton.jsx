'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { CheckInModal } from './CheckInModal';

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

  const handleOpenModal = () => {
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
      {/* Check-in Button - Inline square button */}
      <button
        onClick={handleOpenModal}
        className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
          canCheckIn 
            ? 'bg-[#3eb489] hover:bg-[#359970] text-white' 
            : 'bg-[#3eb489] hover:bg-[#359970] text-white'
        }`}
        title={canCheckIn ? "Daily Check-in Available!" : "View Points & Streak"}
      >
        <div className="relative">
          {/* Check-in Icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          
          {/* New Check-in Available Indicator */}
          {canCheckIn && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 border border-white rounded-full animate-pulse"></div>
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