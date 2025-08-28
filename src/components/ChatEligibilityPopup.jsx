'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';

export function ChatEligibilityPopup() {
  const { user, isInFarcaster } = useFarcaster();
  const [showPopup, setShowPopup] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [eligibilityData, setEligibilityData] = useState(null);

  useEffect(() => {
    const checkEligibilityAndMembership = async () => {
      // Only check if user is in Farcaster and has an FID
      if (!isInFarcaster || !user?.fid) {
        return;
      }

      // Don't show if already dismissed in this session
      const dismissed = sessionStorage.getItem(`chat-popup-dismissed-${user.fid}`);
      if (dismissed) {
        return;
      }

      setIsChecking(true);

      try {
        // Check if user is eligible for chat and not already a member
        const response = await fetch('/api/check-chat-eligibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid: user.fid })
        });

        const result = await response.json();

        if (result.success && result.shouldShowInvite) {
          setEligibilityData(result);
          setShowPopup(true);
        }

      } catch (error) {
        console.error('❌ Error checking chat eligibility for popup:', error);
      } finally {
        setIsChecking(false);
      }
    };

    // Small delay to ensure app is fully loaded
    const timer = setTimeout(checkEligibilityAndMembership, 2000);
    return () => clearTimeout(timer);
  }, [user?.fid, isInFarcaster]);

  const handleJoinChat = async () => {
    if (!eligibilityData?.inviteLink) return;

    try {
      // Track that user clicked the invite
      await fetch('/api/track-chat-invite-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fid: user.fid,
          inviteToken: eligibilityData.inviteToken 
        })
      });

      // Open the chat invite link
      window.open(eligibilityData.inviteLink, '_blank');
      
      // Close popup and mark as dismissed
      handleDismiss();
    } catch (error) {
      console.error('❌ Error tracking invite click:', error);
      // Still open the link even if tracking fails
      window.open(eligibilityData.inviteLink, '_blank');
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setShowPopup(false);
    // Remember dismissal for this session
    sessionStorage.setItem(`chat-popup-dismissed-${user.fid}`, 'true');
  };

  // Don't render anything if not showing popup
  if (!showPopup || isChecking) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🎉</span>
            <h3 className="text-lg font-bold text-gray-800">You're Eligible!</h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Merch Mogul Meme Image */}
        <div className="flex justify-center mb-3">
          <img 
            src="/merchmogulmeme.png" 
            alt="Merch Mogul Meme" 
            className="w-full max-w-sm h-auto object-contain rounded-lg"
          />
        </div>

        {/* Content */}
        <div className="mb-4">
          <p className="text-gray-700 mb-3">
            🚀 You hold <span className="font-bold text-green-600">50M+ $MINTEDMERCH tokens</span> and are now eligible to join the <span className="font-bold text-purple-600">Merch Moguls Group Chat</span>!
          </p>
          
          {/* Token Balance Display */}
          {eligibilityData?.tokenBalance && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700">Your Balance:</span>
                <span className="font-bold text-green-800">
                  {(eligibilityData.tokenBalance / 1000000).toLocaleString()}M tokens
                </span>
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Merch Mogul Benefits:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Collab partner access</li>
              <li>• Create/order your own custom merch</li>
              <li>• 15% off store wide while you hold</li>
              <li>• Access to the Merch Moguls group chat</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={handleJoinChat}
            className="flex-1 bg-[#3eb489] text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
          >
            🤌 Join Chat
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-3 text-gray-500 hover:text-gray-700 transition-colors"
          >
            Maybe Later
          </button>
        </div>

        {/* Fine Print */}
        <p className="text-xs text-gray-500 mt-3 text-center">
          Your token balance is monitored automatically. You may be removed if it falls below 50M.
        </p>
      </div>
    </div>
  );
}
