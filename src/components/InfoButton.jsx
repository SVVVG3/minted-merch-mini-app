'use client';

import { useState } from 'react';
import { InfoModal } from './InfoModal';
import { sdk } from '@farcaster/miniapp-sdk';

export function InfoButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = async () => {
    // Add haptic feedback for info button selection
    try {
      const capabilities = await sdk.getCapabilities();
      if (capabilities.includes('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
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

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        title="Mini App Guide"
        aria-label="View Mini App guide and help"
      >
        {/* Info Icon */}
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      <InfoModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
      />
    </>
  );
} 