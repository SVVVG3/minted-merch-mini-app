'use client';

import { useEffect, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export function InfoModal({ isOpen, onClose }) {
  const modalRef = useRef(null);

  // Handle Farcaster profile link click
  const handleFarcasterProfileClick = async (e) => {
    e.preventDefault();
    try {
      // Use the proper viewProfile action to show the profile in Farcaster
      await sdk.actions.viewProfile({ 
        fid: 466111 // svvvg3.eth's FID
      });
    } catch (error) {
      console.error('Error navigating to profile:', error);
      // Fallback: use openUrl with the web URL
      try {
        await sdk.actions.openUrl('https://farcaster.xyz/svvvg3.eth');
      } catch (urlError) {
        console.error('Error opening URL:', urlError);
      }
    }
  };

 

  // Focus management
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  // Keyboard navigation and body scroll prevention
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
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ width: '100vw', height: '100vh' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6), 0 10px 30px rgba(0, 0, 0, 0.4)' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="info-title"
        aria-describedby="info-description"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
          aria-label="Close info modal"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <img 
              src="/MintedMerchHeaderLogo.png" 
              alt="Minted Merch" 
              className="h-12"
            />
            <div>
              <h2 id="info-title" className="text-2xl font-bold text-gray-800">Mini App Guide</h2>
              <p className="text-sm text-gray-600">Everything you need to know about the Minted Merch mini app!</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Getting Started - Moved to top */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>🚀</span>
              How To Get Started:
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>1. <strong>Check-in Daily:</strong> Spin the wheel to earn points, move up the leaderboard, and be entered into random raffles for $mintedmerch, gift cards, and FREE merch!</p>
              <p>2. <strong>Spin The Wheel Often:</strong> Earn daily streak bonuses at 3, 7, and 30+ days!</p>
              <p>3. <strong>Buy Your Favorite Merch:</strong> Earn 100 points for every 1 USDC spent.</p>
              <p>4. <strong>Hold $mintedmerch:</strong> Earn multipliers for holding 50M, 200M, and 1B+ tokens.</p>
              <p>5. <strong>Add The Mini App:</strong> Receive daily check-in reminders, new product alerts, order confirmations, shipping alerts, and 15% off your first order!</p>
            </div>
          </div>

          {/* Merch Mogul Section */}
          <div className="bg-gradient-to-r from-purple-50 to-green-50 rounded-lg p-4 border border-purple-200">
            {/* Centered title above the image */}
            <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">
              Become a Merch Mogul 🤌
            </h3>
            
            {/* Merch Mogul Meme Image */}
            <div className="flex justify-center mb-4">
              <img 
                src="/merchmogulmeme.png" 
                alt="Merch Mogul Meme" 
                className="w-full max-w-sm h-auto object-contain rounded-lg"
              />
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <p>
                Hold <span className="font-bold text-green-600">50M+ $MINTEDMERCH tokens</span> and become a <span className="font-bold text-purple-600">Merch Mogul</span>!
              </p>
              
              {/* Benefits */}
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Merch Mogul Benefits:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Exclusive collab partner access</li>
                  <li>• Create/order custom merch</li>
                  <li>• 15% off store wide while you hold</li>
                  <li>• Merch Moguls group chat access</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              <strong>Need Help/Have Questions?</strong> Message <button onClick={handleFarcasterProfileClick} className="text-[#8A63D2] hover:underline">@svvvg3.eth</button> on Farcaster!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 