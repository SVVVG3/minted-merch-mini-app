'use client';

import { useState } from 'react';

const ONCHAT_URL = 'https://onchat.sebayaki.com/minted-merch?theme=mintclub-mint&primary=3eb489&color-channel=3eb489&hide-mobile-tabs=true&hide-brand=true';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Chat Bubble Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
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

      {/* Chat Window */}
      {isOpen && (
        <div 
          className="fixed bottom-20 right-4 z-[9998] w-[350px] h-[500px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] rounded-xl overflow-hidden shadow-2xl border border-gray-700"
          style={{ backgroundColor: '#1a1a1a' }}
        >
          {/* Header */}
          <div className="bg-[#3eb489] px-4 py-3 flex items-center justify-between">
            <span className="text-white font-semibold">Minted Merch Chat</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* OnChat iframe */}
          <iframe
            src={ONCHAT_URL}
            className="w-full h-[calc(100%-48px)] border-0"
            title="Minted Merch Chat"
            allow="clipboard-write"
          />
        </div>
      )}
    </>
  );
}

