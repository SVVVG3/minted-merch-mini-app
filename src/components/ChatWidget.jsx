'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

export function ChatWidget() {
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (scriptLoaded && typeof window !== 'undefined' && window.OnChat) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        try {
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
          console.log('✅ OnChat widget mounted');
        } catch (err) {
          console.error('❌ OnChat mount error:', err);
        }
      }, 100);
    }
  }, [scriptLoaded]);

  const handleScriptLoad = () => {
    console.log('✅ OnChat script loaded, OnChat object:', typeof window.OnChat);
    setScriptLoaded(true);
  };

  return (
    <>
      {/* OnChat Widget Container */}
      <div id="onchat-widget" style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 9999 }} />
      
      {/* Load OnChat Script */}
      <Script 
        src="https://onchat.sebayaki.com/widget.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
        onError={(e) => console.error('❌ OnChat script error:', e)}
      />
    </>
  );
}

