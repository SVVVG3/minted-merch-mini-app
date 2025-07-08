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
      {/* Check-in Button */}
      <button
        onClick={handleOpenModal}
        className={`fixed top-4 right-20 p-3 rounded-full shadow-lg z-30 transition-all ${
          canCheckIn 
            ? 'bg-green-600 hover:bg-green-700 transform hover:scale-105' 
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white`}
        title={canCheckIn ? "Daily Check-in Available!" : "View Points & Streak"}
      >
        <div className="relative">
          {/* Check-in Icon */}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          
          {/* New Check-in Available Indicator */}
          {canCheckIn && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></div>
          )}
        </div>
      </button>

      {/* Points Preview (only show if user has points or streak) */}
      {(totalPoints > 0 || streak > 0) && !isLoading && (
        <div className="fixed top-16 right-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-30 min-w-[100px]">
          <div className="text-xs text-center space-y-1">
            <div className="text-blue-600 font-semibold">
              {totalPoints} pts
            </div>
            {streak > 0 && (
              <div className="text-green-600 font-semibold flex items-center justify-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {streak}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      <CheckInModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCheckInComplete={handleCheckInComplete}
      />
    </>
  );
} 