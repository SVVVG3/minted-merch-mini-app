'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

const ONCHAT_URL = 'https://onchat.sebayaki.com/minted-merch?theme=mintclub-mint&primary=3eb489&color-channel=3eb489&hide-mobile-tabs=true&hide-brand=true';

export function ChatWidget() {
  const [isInFarcaster, setIsInFarcaster] = useState(false);

  useEffect(() => {
    // Check if we're in Farcaster mini-app context
    const inFarcaster = typeof window !== 'undefined' && (
      window.parent !== window ||
      document.referrer.includes('farcaster') ||
      document.referrer.includes('warpcast')
    );
    setIsInFarcaster(inFarcaster);
  }, []);

  const handleOpenChat = async () => {
    if (isInFarcaster) {
      // Use Farcaster SDK to open URL externally (bypasses CSP)
      try {
        await sdk.actions.openUrl(ONCHAT_URL);
      } catch (err) {
        console.error('Error opening chat URL:', err);
        // Fallback to regular window.open
        window.open(ONCHAT_URL, '_blank');
      }
    } else {
      // Outside Farcaster, just open in new tab
      window.open(ONCHAT_URL, '_blank');
    }
  };

  return (
    <button
      onClick={handleOpenChat}
      className="fixed bottom-4 right-4 z-[9999] w-14 h-14 rounded-full bg-[#3eb489] hover:bg-[#359970] shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105"
      aria-label="Open chat"
    >
      {/* Chat icon */}
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </button>
  );
}

