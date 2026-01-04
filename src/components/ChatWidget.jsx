'use client';

import { useEffect, useRef, useState } from 'react';

export function ChatWidget({ buttonClassName = '' }) {
  const widgetRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  // Lock body scroll when chat is open - robust approach
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
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
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
      {/* Chat Button - inline, can be placed anywhere */}
      <button
        onClick={handleToggle}
        className={`w-12 h-12 rounded-xl bg-[#3eb489] hover:bg-[#359970] shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 ${buttonClassName}`}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {/* Chat icon */}
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Chat Window - centered */}
          <div 
            className="absolute inset-4 top-16 bottom-4 max-w-md mx-auto rounded-xl overflow-hidden shadow-2xl border border-gray-700 flex flex-col"
            style={{ backgroundColor: '#1a1a1a' }}
          >
            {/* Header with close button */}
            <div className="bg-[#3eb489] px-4 py-3 flex items-center justify-between shrink-0">
              <span className="text-white font-semibold">Minted Merch Chat</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* OnChat widget container */}
            <div 
              id="onchat-widget-container" 
              ref={widgetRef}
              className="flex-1 overflow-hidden"
            />
            
            {/* Loading state */}
            {!isLoaded && (
              <div className="absolute inset-0 top-12 flex items-center justify-center bg-gray-900">
                <div className="text-gray-400">Loading chat...</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
