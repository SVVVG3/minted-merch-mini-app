'use client';

import { useEffect, useRef } from 'react';
import { Leaderboard } from './Leaderboard';

export function LeaderboardModal({ isOpen, onClose }) {
  const modalRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6)' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="leaderboard-title"
        aria-describedby="leaderboard-description"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
          aria-label="Close leaderboard"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Leaderboard content */}
        <div className="overflow-y-auto overscroll-contain">
          <Leaderboard isVisible={isOpen} />
        </div>
      </div>
    </div>
  );
} 