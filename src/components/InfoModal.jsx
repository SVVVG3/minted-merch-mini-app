'use client';

import { useEffect, useRef } from 'react';

export function InfoModal({ isOpen, onClose }) {
  const modalRef = useRef(null);

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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ width: '100vw', height: '100vh' }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
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
          {/* Daily Check-in */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <img src="/RewardsIcon.png" alt="Daily Rewards" className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Daily Check-in 🎯</h3>
                <p className="text-sm text-gray-600">Spin the wheel daily to earn points</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 text-sm text-gray-700">
              <p>• Spin the wheel once per day (resets at 8 AM PST)</p>
              <p>• Earn 25-100 points randomly per spin</p>
              <p>• Build streaks for bonus points (longer streaks = bigger bonuses)</p>
              <p>• Share your daily results on Farcaster with beautiful OG images</p>
              <p>• Get entered into raffles for FREE merch with every check-in</p>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 16 16">
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
              <p>• Top users get special recognition with crown, medals, etc.</p>
              <p>• Track your progress over time</p>
            </div>
          </div>

          {/* Order History */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <p>• Quickly reorder your favorite items</p>
            </div>
          </div>

          {/* Shopping & Payments */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5-5M7 13l-2.5 5M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Shopping Cart 🛒</h3>
                <p className="text-sm text-gray-600">Pay with crypto onchain</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 text-sm text-gray-700">
              <p>• Browse crypto-themed apparel and accessories</p>
              <p>• Pay securely with USDC on Base blockchain</p>
              <p>• Connect your wallet for seamless checkout</p>
              <p>• Share your purchases on Farcaster with dynamic OG images</p>
              <p>• Automatic order fulfillment through Shopify integration</p>
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
              <p>• Automatic discounts for holding specific NFTs or tokens</p>
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
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a3 3 0 00-3-3H8a3 3 0 00-3 3v5h5l-5 5-5-5h5V12a5 5 0 015-5h4a5 5 0 015 5v5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Smart Notifications 🔔</h3>
                <p className="text-sm text-gray-600">Stay updated on everything</p>
              </div>
            </div>
            <div className="ml-13 space-y-2 text-sm text-gray-700">
              <p>• Daily check-in reminders at 8 AM PST</p>
              <p>• Order status updates and shipping notifications</p>
              <p>• Welcome messages for new users</p>
              <p>• Special announcements and limited-time offers</p>
              <p>• Enable notifications when adding the Mini App to get perks</p>
            </div>
          </div>

          {/* Getting Started */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>🚀</span>
              Getting Started
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>1. <strong>Daily Check-in:</strong> Spin the wheel to start earning points</p>
              <p>2. <strong>Enable Notifications:</strong> Get reminders and updates</p>
              <p>3. <strong>Browse Products:</strong> Find crypto merch you love</p>
              <p>4. <strong>Connect Wallet:</strong> Pay with USDC for seamless checkout</p>
              <p>5. <strong>Share Everything:</strong> Show off your purchases and streaks</p>
            </div>
          </div>

          {/* Support */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              <strong>Need Help?</strong> Find us on Farcaster <span className="text-[#8A63D2]">@mintedmerch</span> or message <span className="text-[#8A63D2]">@madyak</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 