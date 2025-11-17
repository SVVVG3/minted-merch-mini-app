'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { checkChatEligibility } from '@/lib/chatEligibility';

export function ChatEligibilityBanner() {
  const { user, isInFarcaster, getSessionToken, isReady } = useFarcaster();
  const [isEligible, setIsEligible] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const checkEligibility = async () => {
      if (!user?.fid || !isInFarcaster || !isReady || hasChecked) return;

      console.log('🎫 Checking chat eligibility for banner, FID:', user.fid);
      setIsChecking(true);
      
      try {
        // 🔒 SECURITY: Include JWT token for authentication
        const sessionToken = getSessionToken();
        if (!sessionToken) {
          console.warn('⚠️ No session token available for chat eligibility check');
          setIsChecking(false);
          return;
        }
        
        // Get user's wallet addresses
        const response = await fetch(`/api/user-wallet-data?fid=${user.fid}`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const userData = await response.json();
        
        console.log('🎫 User wallet data:', userData);
        
        if (userData.success && userData.walletAddresses?.length > 0) {
          // Check eligibility
          const eligibility = await checkChatEligibility(userData.walletAddresses);
          console.log('🎫 Chat eligibility result:', eligibility);
          setIsEligible(eligibility.eligible);
          
          if (eligibility.eligible) {
            console.log('🎉 User is eligible for chat! Showing banner.');
          } else {
            console.log('❌ User not eligible:', eligibility.message);
          }
        } else {
          console.log('❌ No wallet addresses found for user');
        }
        
        setHasChecked(true);
      } catch (error) {
        console.error('❌ Error checking chat eligibility for banner:', error);
        setHasChecked(true);
      } finally {
        setIsChecking(false);
      }
    };

    // Small delay to avoid checking too early
    const timer = setTimeout(checkEligibility, 3000); // Increased delay
    return () => clearTimeout(timer);
  }, [user?.fid, isInFarcaster, isReady, hasChecked]);

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
