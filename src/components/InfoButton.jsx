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
        className="flex items-center justify-center w-12 h-12 bg-[#3eb489] hover:bg-[#359970] text-white rounded-lg transition-colors"
        title="Mini App Guide"
        aria-label="View Mini App guide and help"
      >
        {/* Question Mark Icon */}
        <span className="text-lg font-bold">?</span>
      </button>

      <InfoModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
      />
    </>
  );
} 