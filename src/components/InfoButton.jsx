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
        className="flex items-center justify-center w-15 h-15 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        title="Mini App Guide"
        aria-label="View Mini App guide and help"
      >
        {/* Question Mark Icon */}
        <span className="text-2xl font-bold">?</span>
      </button>

      <InfoModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
      />
    </>
  );
} 