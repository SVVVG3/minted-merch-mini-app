'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { DailySpinModal } from './DailySpinModal';
import { haptics } from '@/lib/haptics';
import { deduplicateRequest, clearCachedResult } from '@/lib/requestDeduplication';

export function CheckInButton() {
  const { user, isReady, getFid, getSessionToken } = useFarcaster();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [spinStatus, setSpinStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // Get session token from hook or localStorage
  const getToken = () => getSessionToken?.() || localStorage.getItem('fc_session_token');

  // Load user's daily spin status
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

    loadSpinStatus(userFid);
  }, [user?.fid, isReady]);

  // Auto-open modal after short delay if user has spins available
  useEffect(() => {
    if (!spinStatus || isLoading || hasAutoOpened) {
      return;
    }

    const canSpin = spinStatus?.canSpin;
    
    if (canSpin) {
      const timer = setTimeout(async () => {
        console.log('🎯 Auto-opening daily spin modal');
        
        // Add haptic feedback for auto-open (works in mini app)
        const isInMiniApp = user && !user.isAuthKit;
        await haptics.light(isInMiniApp);
        
        setIsModalOpen(true);
        setHasAutoOpened(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [spinStatus, isLoading, hasAutoOpened, user]);

  const loadSpinStatus = async (userFid) => {
    try {
      setIsLoading(true);
      const token = getToken();
      
      if (!token) {
        console.log('No session token available for spin status');
        setIsLoading(false);
        return;
      }

      // Use deduplication to prevent duplicate API calls
      const result = await deduplicateRequest(
        `dailyspin-status-${userFid}`,
        async () => {
          const response = await fetch('/api/dailyspin/status', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          return response.json();
        },
        5000 // 5 second cache
      );
      
      if (result.success) {
        setSpinStatus(result.status);
      }
    } catch (error) {
      console.error('Error loading spin status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = async () => {
    // Add haptic feedback (works in mini app)
    const isInMiniApp = user && !user.isAuthKit;
    await haptics.medium(isInMiniApp);
    
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSpinComplete = (result) => {
    // Reload status after spin
    if (user && isReady) {
      const userFid = getFid();
      if (userFid) {
        clearCachedResult(`dailyspin-status-${userFid}`);
        loadSpinStatus(userFid);
      }
    }
  };

  // Don't show button if not authenticated
  if (!user || !isReady) {
    return null;
  }

  const canSpin = spinStatus?.canSpin;
  const streak = spinStatus?.streak || 0;

  return (
    <>
      {/* Daily Spin Button */}
      <button
        onClick={handleOpenModal}
        className="flex items-center justify-center min-w-[3rem] h-12 px-2 bg-[#3eb489] hover:bg-[#359970] text-white rounded-lg transition-colors relative"
        title={canSpin ? "Daily Spin Available!" : "View Daily Spin & Streak"}
      >
        {canSpin ? (
          <>
            {/* Custom Rewards Icon */}
            <img 
              src="/RewardsIcon.png" 
              alt="Daily Rewards" 
              className="w-6 h-6" 
            />
            
            {/* New Spin Available Indicator */}
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

      {/* Daily Spin Modal */}
      <DailySpinModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSpinComplete={handleSpinComplete}
      />
    </>
  );
}
