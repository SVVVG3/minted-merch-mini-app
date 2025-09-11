'use client';

import { useState, useEffect } from 'react';
import { SpinWheel } from './SpinWheel';

export function CheckInModal({ isOpen, onClose, onCheckInComplete }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Allow body scroll when modal is closed
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to reset overflow on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  const handleSpinComplete = (result) => {
    // Pass result to parent component
    if (onCheckInComplete) {
      onCheckInComplete(result);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay Background */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 transition-opacity"
        style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={handleOverlayClick}
      />
      
      {/* Modal Content Container with proper sizing */}
      <div className="relative z-10 w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute -top-4 -right-4 z-20 bg-white hover:bg-gray-100 rounded-full p-2 shadow-lg transition-colors"
          title="Close"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
} 