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
        className="bg-white rounded-lg shadow-2xl drop-shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="info-title"
        aria-describedby="info-description"
      >
        {/* Close button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            aria-label="Close info modal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
              <p className="text-gray-600">Everything you need to know about Minted Merch</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Getting Started - Moved to top */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>🚀</span>
              Getting Started
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>1. <strong>Daily Check-in:</strong> Spin the wheel to start earning points</p>
              <p>2. <strong>Enable Notifications:</strong> Get reminders and updates</p>
              <p>3. <strong>Browse Products:</strong> Find merch designed after your favorite coins, NFTs, and communities</p>
              <p>4. <strong>Pay with USDC on Base</strong> for seamless checkout</p>
              <p>5. <strong>Share your purchases and streaks</strong> on Farcaster</p>
            </div>
          </div>

          {/* Daily Check-in */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#3eb489] rounded-lg flex items-center justify-center">
                <img src="/RewardsIcon.png" alt="Daily Rewards" className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Daily Check-in 🎯</h3>
                <p className="text-sm text-gray-600">Spin the wheel daily to earn points</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 text-sm text-gray-700">
              <p>• Wheel resets at 8 AM PST every day</p>
              <p>• Earn 25-100 points randomly per spin</p>
              <p>• Build streaks for bonus points (longer streaks = bigger bonuses)</p>
              <p>• Purchase merch to earn even more points</p>
              <p>• Get entered into raffles for FREE merch (scheduled at random)</p>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#3eb489] rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M2.5.5A.5.5 0 0 1 3 0h10a.5.5 0 0 1 .5.5c0 .538-.012 1.05-.034 1.536a3 3 0 1 1-1.133 5.89c-.79 1.865-1.878 2.777-2.833 3.011v2.173l1.425.356c.194.048.377.135.537.255L13.3 15.1a.5.5 0 0 1-.3.9H3a.5.5 0 0 1-.3-.9l1.838-1.379c.16-.12.343-.207.537-.255L6.5 13.11v-2.173c-.955-.234-2.043-1.146-2.833-3.012a3 3 0 1 1-1.132-5.89A33.076 33.076 0 0 1 2.5.5zm.099 2.54a2 2 0 0 0 .72 3.935c-.333-1.05-.588-2.346-.72-3.935zm10.083 3.935a2 2 0 0 0 .72-3.935c-.133 1.59-.388 2.885-.72 3.935z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Leaderboard 🏆</h3>
                <p className="text-sm text-gray-600">Compete with other users</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 text-sm text-gray-700">
              <p>• View rankings by total points, streak length, or purchases</p>
              <p>• See your position among all users</p>
              <p>• Top users get entered into random raffles for FREE merch</p>
              <p>• Track your progress over time</p>
            </div>
          </div>

          {/* Order History */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Order History 📋</h3>
                <p className="text-sm text-gray-600">Track all your purchases</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 text-sm text-gray-700">
              <p>• View all your past orders and their status</p>
              <p>• Track shipping updates and delivery</p>
              <p>• See your total spending and order count</p>
            </div>
          </div>

          {/* Shopping & Payments */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#3eb489] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Shopping Cart 🛒</h3>
                <p className="text-sm text-gray-600">Pay with crypto onchain</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 text-sm text-gray-700">
              <p>• Browse apparel, accessories, & more designed after your favorite coins, communities, and NFTs</p>
              <p>• Pay securely with USDC on Base</p>
              <p>• Share your purchases on Farcaster</p>
            </div>
          </div>

          {/* Share Button */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#8A63D2] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 1000 1000" fill="currentColor">
                  <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
                  <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.445H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"/>
                  <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.445H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Share on Farcaster 📡</h3>
                <p className="text-sm text-gray-600">Share your achievements and purchases</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 text-sm text-gray-700">
              <p>• Share daily check-in results</p>
              <p>• Show off your purchases</p>
              <p>• Cast about new products to earn social engagement</p>
            </div>
          </div>

          {/* Discounts & Token Gating */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Exclusive Discounts 🎫</h3>
                <p className="text-sm text-gray-600">Token-gated perks & offers</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 text-sm text-gray-700">
              <p>• Automatic discounts for holding specific NFTs & tokens</p>
              <p>• Welcome discounts for new users who enable notifications</p>
              <p>• Special offers for Bankr Club members</p>
              <p>• Free shipping rewards and exclusive promo codes</p>
              <p>• Earn points from purchases for future rewards</p>
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C10.896 2 10 2.896 10 4V4.586C7.837 5.838 6.279 8.14 6.279 10.818V16L4 18V19H20V18L17.721 16V10.818C17.721 8.14 16.163 5.838 14 4.586V4C14 2.896 13.104 2 12 2ZM10 20C10 21.1 10.9 22 12 22C13.1 22 14 21.1 14 20H10Z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Smart Notifications 🔔</h3>
                <p className="text-sm text-gray-600">Stay updated on everything</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 text-sm text-gray-700">
              <p>• Daily check-in reminders at 8 AM PST</p>
              <p>• Order confirmations and shipping notifications</p>
              <p>• Welcome discount for new users</p>
              <p>• New product releases and limited-time offers</p>
              <p>• Enable notifications when adding the Mini App to access these perks</p>
            </div>
          </div>

          {/* Support */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              <strong>Need Help?</strong> Message <button onClick={handleFarcasterProfileClick} className="text-[#8A63D2] hover:underline">@svvvg3.eth</button> on Farcaster!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 