'use client';

import { useState, useEffect } from 'react';
import { SpinWheel } from './SpinWheel';
import { AddMiniAppPrompt } from './AddMiniAppPrompt';
import { useFarcaster } from '@/lib/useFarcaster';

export function CheckInModal({ isOpen, onClose, onCheckInComplete }) {
  const [isVisible, setIsVisible] = useState(false);
  const [showAddMiniAppPrompt, setShowAddMiniAppPrompt] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(null); // null = unknown, will be checked when modal opens
  const { user, getFid, isReady } = useFarcaster();

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      // Check if user has notifications enabled
      checkNotificationStatus();
    } else {
      // Allow body scroll when modal is closed
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to reset overflow on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isReady]);

  // Check if user has notifications enabled
  const checkNotificationStatus = async () => {
    if (!isReady) {
      console.log('⏳ SDK not ready yet, skipping notification status check');
      return;
    }
    
    const userFid = getFid();
    if (!userFid) {
      console.log('⏳ No FID available yet, skipping notification status check');
      return;
    }

    console.log('🔍 Checking notification status for FID:', userFid);

    try {
      const response = await fetch(`/api/update-notification-status?fid=${userFid}`);
      const data = await response.json();
      
      console.log('📊 Notification status API response:', data);
      
      if (data.success) {
        setHasNotifications(data.notificationsEnabled || false);
        console.log('📊 User notification status set to:', data.notificationsEnabled ? 'Enabled ✅' : 'Disabled ❌');
        console.log('📊 Source:', data.source);
      } else {
        console.warn('⚠️ API returned success: false, defaulting to false to show prompt');
        // Default to false so new users see the add mini app prompt
        setHasNotifications(false);
      }
    } catch (error) {
      console.error('❌ Error checking notification status:', error);
      // Default to false so users see the add mini app prompt
      // Better to prompt users who might already have it than to miss new users
      setHasNotifications(false);
      console.log('⚠️ Set hasNotifications to false (will show prompt) due to error');
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setShowAddMiniAppPrompt(false);
    onClose();
  };

  const handleSpinComplete = (result) => {
    // Pass result to parent component
    if (onCheckInComplete) {
      onCheckInComplete(result);
    }
    
    // Debug logging for troubleshooting
    console.log('🔍 Spin Complete - Checking Add Mini App eligibility:', {
      user: user,
      isAuthKit: user?.isAuthKit,
      hasNotifications: hasNotifications,
      userExists: !!user,
      isReady: isReady
    });
    
    // Only show the add mini app prompt if:
    // 1. User is in mini app (not AuthKit)
    // 2. User doesn't have notifications enabled yet
    const isInMiniApp = user && !user.isAuthKit;
    
    console.log('🎯 Add Mini App Eligibility Check:', {
      isInMiniApp: isInMiniApp,
      hasNotifications: hasNotifications,
      hasNotificationsIsNull: hasNotifications === null,
      willShowPrompt: isInMiniApp && hasNotifications === false
    });
    
    // Only show prompt if:
    // 1. User is in mini app (not AuthKit)
    // 2. hasNotifications is explicitly false (not null/unknown)
    if (isInMiniApp && hasNotifications === false) {
      // Show prompt after a brief delay (let them see their spin result first)
      console.log('✅ User is eligible! Showing prompt in 3 seconds...');
      setTimeout(() => {
        console.log('🎯 Now showing Add Mini App prompt');
        setShowAddMiniAppPrompt(true);
      }, 3000); // 3 second delay to let them enjoy their spin result
    } else {
      console.log('❌ Not showing prompt. Reason:', {
        notInMiniApp: !isInMiniApp,
        hasNotifications: hasNotifications,
        stillLoading: hasNotifications === null
      });
    }
    
    // Keep modal open to show results
    // User can close it manually
  };

  const handleOverlayClick = (e) => {
    // Close modal only if clicking the overlay background
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Handle escape key press
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Overlay Background */}
        <div 
          className="fixed inset-0 transition-opacity"
          onClick={handleOverlayClick}
        />
        
        {/* Modal Content Container with proper sizing */}
        <div className="relative z-10 w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-2xl" style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6), 0 10px 30px rgba(0, 0, 0, 0.4)' }}>
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 bg-white hover:bg-gray-100 rounded-full flex items-center justify-center shadow-lg transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Scrollable Content Container */}
          <div className="overflow-y-auto overscroll-contain">
            {/* Spin Wheel Component */}
            <SpinWheel
              isVisible={isVisible}
              onSpinComplete={handleSpinComplete}
            />
          </div>
        </div>
      </div>

      {/* Add Mini App Prompt - Shows after spin completion if notifications not enabled */}
      <AddMiniAppPrompt 
        isOpen={showAddMiniAppPrompt}
        onClose={() => setShowAddMiniAppPrompt(false)}
      />
    </>
  );
} 