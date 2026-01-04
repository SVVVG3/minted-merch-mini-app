'use client';

import { useEffect } from 'react';
import Script from 'next/script';

export function ChatWidget() {
  useEffect(() => {
    // Initialize OnChat when script is loaded and component mounts
    if (typeof window !== 'undefined' && window.OnChat) {
      window.OnChat.mount('#onchat-widget', {
        channel: 'minted-merch',
        theme: 'mintclub-mint',
        hideMobileTabs: true,
        hideBrand: true,
        colors: { 
          'primary': '#3eb489', 
          'color-channel': '#3eb489' 
        }
      });
    }
  }, []);

  const handleScriptLoad = () => {
    // Initialize OnChat after script loads
    if (typeof window !== 'undefined' && window.OnChat) {
      window.OnChat.mount('#onchat-widget', {
        channel: 'minted-merch',
        theme: 'mintclub-mint',
        hideMobileTabs: true,
        hideBrand: true,
        colors: { 
          'primary': '#3eb489', 
          'color-channel': '#3eb489' 
        }
      });
    }
  };

  return (
    <>
      {/* OnChat Widget Container */}
      <div id="onchat-widget" />
      
      {/* Load OnChat Script */}
      <Script 
        src="https://onchat.sebayaki.com/widget.js"
        strategy="lazyOnload"
        onLoad={handleScriptLoad}
      />
    </>
  );
}

