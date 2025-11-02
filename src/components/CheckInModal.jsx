'use client';

import { useState, useEffect } from 'react';
import { SpinWheel } from './SpinWheel';
import { AddMiniAppPrompt } from './AddMiniAppPrompt';
import { useFarcaster } from '@/lib/useFarcaster';

export function CheckInModal({ isOpen, onClose, onCheckInComplete }) {
  const [isVisible, setIsVisible] = useState(false);
  const [showAddMiniAppPrompt, setShowAddMiniAppPrompt] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(true); // Default to true to avoid showing prompt unnecessarily
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
  }, [isOpen]);

  // Check if user has notifications enabled
  const checkNotificationStatus = async () => {
    if (!isReady) return;
    
    const userFid = getFid();
    if (!userFid) return;

    try {
      const response = await fetch(`/api/update-notification-status?fid=${userFid}`);
      const data = await response.json();
      
      if (data.success) {
        setHasNotifications(data.notificationsEnabled || false);
        console.log('📊 User notification status:', data.notificationsEnabled ? 'Enabled ✅' : 'Disabled ❌');
      }
    } catch (error) {
      console.error('❌ Error checking notification status:', error);
      // Default to true to avoid showing prompt on error
      setHasNotifications(true);
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
    
    // Only show the add mini app prompt if:
    // 1. User is in mini app (not AuthKit)
    // 2. User doesn't have notifications enabled yet
    const isInMiniApp = user && !user.isAuthKit;
    
    if (isInMiniApp && !hasNotifications) {
      // Show prompt after a brief delay (let them see their spin result first)
      setTimeout(() => {
        console.log('🎯 Showing Add Mini App prompt after spin completion');
        setShowAddMiniAppPrompt(true);
      }, 3000); // 3 second delay to let them enjoy their spin result
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