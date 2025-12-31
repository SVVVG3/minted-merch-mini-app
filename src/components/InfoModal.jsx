'use client';

import { useEffect, useRef, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcaster } from '@/lib/useFarcaster';

export function InfoModal({ isOpen, onClose }) {
  const modalRef = useRef(null);
  const { user, getSessionToken } = useFarcaster();
  const [isMerchMogul, setIsMerchMogul] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(true);

  // Check if user is a Merch Mogul (50M+ staked)
  useEffect(() => {
    const checkMerchMogulStatus = async () => {
      if (!user?.fid || !isOpen) {
        setIsCheckingBalance(false);
        return;
      }

      try {
        setIsCheckingBalance(true);
        
        // 🔒 SECURITY: Include JWT token for authentication
        const sessionToken = getSessionToken();
        
        if (!sessionToken) {
          console.warn('⚠️ No session token available for InfoModal Merch Mogul check');
          setIsCheckingBalance(false);
          setIsMerchMogul(false);
          return;
        }
        
        const profileResponse = await fetch('/api/user-profile', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({ fid: user.fid })
        });
        
        const profileData = await profileResponse.json();
        
        if (profileData.success && profileData.data?.staked_balance) {
          const stakedBalance = parseFloat(profileData.data.staked_balance);
          const isMogul = stakedBalance >= 50000000; // 50M staked required
          setIsMerchMogul(isMogul);
          console.log(`💼 Merch Mogul Status: ${isMogul} (Staked: ${stakedBalance.toLocaleString()} tokens)`);
        } else {
          setIsMerchMogul(false);
        }
      } catch (error) {
        console.error('Error checking Merch Mogul status:', error);
        setIsMerchMogul(false);
      } finally {
        setIsCheckingBalance(false);
      }
    };

    checkMerchMogulStatus();
  }, [user?.fid, isOpen]);

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

  // Handle opening Google Form links
  const handleOpenForm = async (url, formType) => {
    try {
      await sdk.actions.openUrl(url);
      console.log(`📋 Opened ${formType} form`);
    } catch (error) {
      console.error(`Error opening ${formType} form:`, error);
      // Fallback: try window.open as last resort
      window.open(url, '_blank');
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
        aria-labelledby="info-title"
        aria-describedby="info-description"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
          aria-label="Close info modal"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable Content */}
        <div className="overflow-y-auto overscroll-contain">
          {/* Header */}
          <div className="border-b border-gray-700 p-6 pt-12">
            <div className="flex items-center gap-3 mb-4">
              <img 
                src="/MintedMerchHeaderLogo.png" 
                alt="Minted Merch" 
                className="h-12"
              />
              <div>
                <h2 id="info-title" className="text-2xl font-bold text-white">Mini App Guide</h2>
                <p className="text-sm text-gray-400">Everything you need to know about the Minted Merch mini app!</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
          {/* Getting Started - Moved to top */}
          <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-xl p-4 border border-green-700/50">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>🚀</span>
              How To Get Started:
            </h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>1. <strong className="text-white">Stake $mintedmerch:</strong> Boost your Mojo & spin-to-claim daily to compound your $mintedmerch rewards, with a bonus chance to win physical merch packs!</p>
              <p>2. <strong className="text-white">Check-in Daily:</strong> Spin the wheel for a chance to win tokens and earn a Mojo boost. The higher Mojo score, the more spins you get!</p>
              <p>3. <strong className="text-white">Buy Your Favorite Merch:</strong> Boost your Mojo score with every purchase!</p>
              <p>4. <strong className="text-white">Complete Missions:</strong> Boost your Mojo score by completing Minted Merch Missions. Must be staking 10M+ $mintedmerch to be eligible!</p>
              <p>5. <strong className="text-white">Add The Mini App:</strong> Receive daily check-in & staking reminders, new product alerts, order confirmations, shipping alerts, and 15% off your first order!</p>
            </div>
          </div>

          {/* Merch Mogul Section - Conditional based on staked balance */}
          {!isCheckingBalance && isMerchMogul ? (
            // For Merch Moguls: Show action buttons
            <div className="bg-gradient-to-r from-purple-900/30 to-green-900/30 rounded-xl p-4 border border-purple-700/50">
              <h3 className="text-lg font-semibold text-white mb-3 text-center">
                Merch Mogul Actions 🤌
              </h3>
              
              {/* Merch Mogul Meme Image */}
              <div className="flex justify-center mb-4">
                <img 
                  src="/merchmogulmeme.png" 
                  alt="Merch Mogul Meme" 
                  className="w-full max-w-sm h-auto object-contain rounded-lg"
                />
              </div>

              <p className="text-sm text-gray-300 mb-4 text-center">
                As a Merch Mogul, you have exclusive access to:
              </p>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handleOpenForm('https://forms.gle/MCQ4CyNEZBzdKMxW8', 'Collab Partner')}
                  className="w-full bg-[#3eb489] hover:bg-[#359970] text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-md"
                >
                  🤝 Become a Collab Partner
                </button>

                <button
                  onClick={() => handleOpenForm('https://forms.gle/3T5xqwLTfe2ujZV46', 'Custom Order')}
                  className="w-full bg-[#3eb489] hover:bg-[#359970] text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-md"
                >
                  🎨 Create a Custom Order
                </button>

                <button
                  onClick={() => handleOpenForm('https://forms.gle/KPhrjCXHqXRJUZZF8', 'Ambassador')}
                  className="w-full bg-[#3eb489] hover:bg-[#359970] text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-md"
                >
                  📢 Apply to be an Ambassador
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                These forms will open in your browser
              </p>
            </div>
          ) : (
            // For non-Merch Moguls: Show "Become a Merch Mogul" section
            <div className="bg-gradient-to-r from-purple-900/30 to-green-900/30 rounded-xl p-4 border border-purple-700/50">
              {/* Centered title above the image */}
              <h3 className="text-lg font-semibold text-white mb-3 text-center">
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

              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  Stake <span className="font-bold text-[#3eb489]">50M+ $MINTEDMERCH tokens</span> and become a <span className="font-bold text-purple-400">Merch Mogul</span>!
                </p>
                
                {/* Benefits */}
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700">
                  <p className="text-sm font-medium text-white mb-2">Merch Mogul Benefits:</p>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Exclusive collab partner access</li>
                    <li>• Create/order custom merch</li>
                    <li>• 15% off store wide while you stake</li>
                    <li>• Merch Moguls group chat access</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Support */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-sm text-gray-300">
              <strong className="text-white">Need Help/Have Questions?</strong> Message <button onClick={handleFarcasterProfileClick} className="text-[#8B5CF6] hover:underline">@svvvg3.eth</button> on Farcaster!
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
} 