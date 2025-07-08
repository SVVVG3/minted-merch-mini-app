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
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="leaderboard-title"
        aria-describedby="leaderboard-description"
      >
        {/* Close button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            aria-label="Close leaderboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Leaderboard content */}
        <Leaderboard isVisible={isOpen} />
      </div>
    </div>
  );
} 