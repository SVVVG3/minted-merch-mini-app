'use client';

import { useEffect, useRef, useState } from 'react';

export function ChatWidget() {
  const widgetRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

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
      {/* Chat Bubble Button - always visible */}
      <button
        onClick={handleToggle}
        className="fixed bottom-4 right-4 z-[9999] w-14 h-14 rounded-full bg-[#3eb489] hover:bg-[#359970] shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          // X icon when open
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Chat icon when closed
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Window - stays mounted after first open, just hidden with CSS */}
      {hasBeenOpened && (
        <div 
          className={`fixed bottom-20 right-4 z-[9998] w-[350px] h-[500px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] rounded-xl overflow-hidden shadow-2xl border border-gray-700 transition-opacity duration-200 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          style={{ backgroundColor: '#1a1a1a' }}
        >
          {/* OnChat widget container */}
          <div 
            id="onchat-widget-container" 
            ref={widgetRef}
            className="w-full h-full"
          />
          
          {/* Loading state */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-gray-400">Loading chat...</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
