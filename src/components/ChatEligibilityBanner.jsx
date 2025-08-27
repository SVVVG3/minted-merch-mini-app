'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { checkChatEligibility } from '@/lib/chatEligibility';

export function ChatEligibilityBanner() {
  const { user, isInFarcaster } = useFarcaster();
  const [isEligible, setIsEligible] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const checkEligibility = async () => {
      if (!user?.fid || !isInFarcaster || hasChecked) return;

      setIsChecking(true);
      
      try {
        // Get user's wallet addresses
        const response = await fetch(`/api/user-wallet-data?fid=${user.fid}`);
        const userData = await response.json();
        
        if (userData.success && userData.walletAddresses?.length > 0) {
          // Check eligibility
          const eligibility = await checkChatEligibility(userData.walletAddresses);
          setIsEligible(eligibility.eligible);
        }
        
        setHasChecked(true);
      } catch (error) {
        console.error('Error checking chat eligibility:', error);
        setHasChecked(true);
      } finally {
        setIsChecking(false);
      }
    };

    // Small delay to avoid checking too early
    const timer = setTimeout(checkEligibility, 2000);
    return () => clearTimeout(timer);
  }, [user?.fid, isInFarcaster, hasChecked]);

  // Don't show banner if not in Farcaster, still checking, or not eligible
  if (!isInFarcaster || !user || isChecking || !isEligible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 text-sm">
      <div className="flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🎫</span>
          <span>
            You're eligible! {' '}
            <a 
              href="/chat"
              className="underline hover:text-purple-200 transition-colors font-medium"
            >
              Join Merch Moguls Chat
            </a>
          </span>
          <span className="text-lg">→</span>
        </div>
      </div>
    </div>
  );
}
