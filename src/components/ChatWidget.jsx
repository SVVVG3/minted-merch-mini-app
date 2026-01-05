'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';

export function ChatWidget({ buttonClassName = '', isInFarcaster = false }) {
  const widgetRef = useRef(null);
  const shareDropdownRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchParams = useSearchParams();

  // Close share dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(event.target)) {
        setShowShareDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get the chat share URL
  const getChatUrl = () => `${window.location.origin}/?showChat=1`;

  // Copy URL to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getChatUrl());
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowShareDropdown(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Share cast to Farcaster
  const handleShareCast = async () => {
    setShowShareDropdown(false);
    try {
      const shareText = "Join the Minted Merch community chat! 💬\n\nConnect with fellow merch enthusiasts onchain 🤌";
      const chatUrl = getChatUrl();
      
      if (isInFarcaster) {
        await sdk.actions.composeCast({
          text: shareText,
          embeds: [chatUrl],
        });
      } else {
        // Fallback for non-Farcaster environment
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(chatUrl)}`;
        window.open(warpcastUrl, '_blank');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Auto-open chat if showChat=1 param is present (from share links)
  useEffect(() => {
    const showChat = searchParams?.get('showChat');
    if (showChat === '1' && !hasAutoOpened) {
      setHasAutoOpened(true);
      setHasBeenOpened(true);
      setIsOpen(true);
    }
  }, [searchParams, hasAutoOpened]);

  // Lock body scroll and prevent Farcaster pull-to-minimize when chat is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (isOpen) {
      // Store current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      // Prevent overscroll/pull-to-refresh behavior
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [isOpen]);

  // Load and mount widget when opened for the first time
  useEffect(() => {
    if (!hasBeenOpened || isLoaded || typeof window === 'undefined') return;

    // Check if script is already loaded
    if (window.OnChat) {
      mountWidget();
      return;
    }

    // Create and load the script
    const script = document.createElement('script');
    script.src = 'https://onchat.sebayaki.com/widget.js';
    script.async = true;
    
    script.onload = () => {
      console.log('✅ OnChat script loaded');
      mountWidget();
    };
    
    script.onerror = (err) => {
      console.error('❌ Failed to load OnChat script:', err);
    };

    document.body.appendChild(script);
  }, [hasBeenOpened, isLoaded]);

  const mountWidget = () => {
    if (window.OnChat && widgetRef.current) {
      try {
        window.OnChat.mount('#onchat-widget-container', {
          channel: 'minted-merch',
          theme: 'mintclub-mint',
          hideMobileTabs: true,
          hideBrand: true,
          colors: {
            'primary': '#3eb489',
            'primary-muted': '#3eb489',
            'color-info': '#3eb489',
            'color-nick': '#3eb489',
            'color-channel': '#3eb489'
          }
        });
        setIsLoaded(true);
        console.log('✅ OnChat widget mounted');
      } catch (err) {
        console.error('❌ Failed to mount OnChat widget:', err);
      }
    }
  };

  const handleToggle = () => {
    if (!hasBeenOpened) {
      setHasBeenOpened(true);
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Chat Button - white background with green icon, matches ShareDropdown size */}
      <button
        onClick={handleToggle}
        className={`w-12 h-12 rounded-lg bg-white hover:bg-gray-100 flex items-center justify-center transition-colors ${buttonClassName}`}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {/* Chat icon - branded green */}
        <svg className="w-6 h-6 text-[#3eb489]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* Chat Modal Overlay - fixed, covers screen */}
      {hasBeenOpened && (
        <div 
          className={`fixed inset-0 z-[9998] transition-opacity duration-200 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Backdrop - touch-action none to prevent pull gestures */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
            style={{ touchAction: 'none' }}
          />
          
          {/* Chat Window - with header and close button at bottom */}
          <div 
            className="absolute left-4 right-4 top-7 max-w-md mx-auto rounded-xl overflow-hidden shadow-2xl border border-gray-700 flex flex-col"
            style={{ backgroundColor: '#1a1a1a', bottom: '80px', overscrollBehavior: 'contain' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#3eb489]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-white font-semibold">Minted Merch Community Chat</span>
              </div>
              
              {/* Share Dropdown */}
              <div className="relative" ref={shareDropdownRef}>
                <button
                  onClick={() => setShowShareDropdown(!showShareDropdown)}
                  className="flex items-center justify-center w-8 h-8 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white rounded-lg transition-colors"
                  title="Share Chat"
                >
                  {/* Farcaster Arch Logo */}
                  <svg className="w-4 h-4" viewBox="0 0 520 457" fill="currentColor">
                    <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showShareDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-[9999]">
                    {/* Copy Link Option */}
                    <button
                      onClick={handleCopyLink}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                    >
                      {copied ? (
                        <>
                          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-500 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    {/* Share Cast Option */}
                    <button
                      onClick={handleShareCast}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors border-t border-gray-100"
                    >
                      {/* Farcaster Logo */}
                      <svg className="w-5 h-5 text-[#6A3CFF]" viewBox="0 0 520 457" fill="currentColor">
                        <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
                      </svg>
                      <span>Share Cast</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* OnChat widget container */}
            <div 
              id="onchat-widget-container" 
              ref={widgetRef}
              className="flex-1 min-h-0 w-full"
              style={{ height: '100%' }}
            />
            
            {/* Loading state */}
            {!isLoaded && (
              <div className="absolute inset-0 top-12 flex items-center justify-center bg-gray-900">
                <div className="text-gray-400">Loading chat...</div>
              </div>
            )}
          </div>
          
          {/* Close button at bottom */}
          <div className="absolute left-4 right-4 bottom-4 max-w-md mx-auto">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-3 bg-[#3eb489] hover:bg-[#359970] text-white font-semibold rounded-xl shadow-lg transition-colors"
            >
              Close Chat
            </button>
          </div>
        </div>
      )}
    </>
  );
}
