'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/frame-sdk';
import { Portal } from './Portal';

export function ChatEligibilityPopup() {
  const { user, isInFarcaster, getSessionToken } = useFarcaster();
  const [showPopup, setShowPopup] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [eligibilityData, setEligibilityData] = useState(null);

  useEffect(() => {
    const checkEligibilityAndMembership = async () => {
      console.log('💬 ChatEligibilityPopup.checkEligibilityAndMembership starting...', {
        isInFarcaster,
        userFid: user?.fid,
        dismissed: sessionStorage.getItem(`chat-popup-dismissed-${user?.fid}`)
      });
      
      // Only check if user is in Farcaster and has an FID
      if (!isInFarcaster || !user?.fid) {
        console.log('💬 Skipping chat eligibility - not in Farcaster or no FID');
        return;
      }

      // Don't show if already dismissed in this session
      const dismissed = sessionStorage.getItem(`chat-popup-dismissed-${user.fid}`);
      if (dismissed) {
        console.log('💬 Skipping chat eligibility - popup already dismissed this session');
        return;
      }

      setIsChecking(true);

      try {
        // Use token gating system to check eligibility (single source of truth)
        // If user has ≥50M tokens for MERCH-MOGULS, they're eligible for chat
        // No need to fetch wallet addresses separately - the API will handle it internally

        // Check cached token balance directly from Supabase (no API calls)
        console.log('💬 ChatEligibilityPopup checking cached balance from Supabase...');
        
        let hasMerchMogulsDiscount = false;
        let cachedTokenBalance = 0;
        
        try {
          // 🔒 SECURITY: Include JWT token for authentication
          const sessionToken = getSessionToken();
          
          if (!sessionToken) {
            console.warn('⚠️ No session token available for ChatEligibilityPopup profile check');
            // Continue without showing popup - user may not be authenticated yet
            return;
          }
          
          // Get cached balance directly from database
          const profileResponse = await fetch('/api/user-profile', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ fid: user.fid })
          });
          const profileData = await profileResponse.json();
          
          if (profileData.success && profileData.data?.token_balance) {
            // Database already stores balance in tokens, no conversion needed
            cachedTokenBalance = parseFloat(profileData.data.token_balance);
            hasMerchMogulsDiscount = cachedTokenBalance >= 50000000; // 50M tokens required
            
            console.log(`💬 Using cached balance: ${cachedTokenBalance.toLocaleString()} tokens (eligible: ${hasMerchMogulsDiscount})`);
          } else {
            console.log('💬 No cached balance found - user likely not eligible');
          }
        } catch (error) {
          console.log('💬 Error checking cached balance:', error.message);
        }

        if (hasMerchMogulsDiscount) {
          // Check if already a chat member to avoid duplicate invites
          const sessionToken = getSessionToken();
          const headers = { 
            'Content-Type': 'application/json',
            ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` })
          };
          
          const chatCheckResponse = await fetch('/api/check-chat-eligibility', {
            method: 'POST',
            headers,
            body: JSON.stringify({ fid: user.fid })
          });

          const chatResult = await chatCheckResponse.json();
          
          if (chatResult.success && chatResult.shouldShowInvite) {
            // Use cached token balance for display
            setEligibilityData({
              ...chatResult,
              tokenBalance: cachedTokenBalance
            });
            setShowPopup(true);
          }
        }

      } catch (error) {
        console.error('❌ Error checking token gating eligibility for chat popup:', error);
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

      // Use Farcaster SDK to navigate to the group chat
      if (isInFarcaster && sdk?.actions?.openUrl) {
        console.log('🚀 Opening group chat via Farcaster SDK');
        await sdk.actions.openUrl(eligibilityData.inviteLink);
      } else {
        // Fallback to window.open for web/non-Farcaster environments
        console.log('🌐 Opening group chat via window.open (fallback)');
        window.open(eligibilityData.inviteLink, '_blank');
      }
      
      // Close popup and mark as dismissed
      handleDismiss();
    } catch (error) {
      console.error('❌ Error opening chat or tracking click:', error);
      // Fallback to window.open if SDK fails
      try {
        window.open(eligibilityData.inviteLink, '_blank');
        handleDismiss();
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        alert('Unable to open chat. Please try again.');
      }
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
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6" style={{ boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.1), 0 20px 50px rgba(0, 0, 0, 0.6), 0 10px 30px rgba(0, 0, 0, 0.4)' }}>
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
    </Portal>
  );
}
