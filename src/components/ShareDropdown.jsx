'use client';

import { useState, useRef, useEffect } from 'react';
import { shareProduct, shareCollection } from '@/lib/farcasterShare';

/**
 * ShareDropdown - A dropdown component for sharing products/collections
 * Options: Copy mini app URL or Share cast to Farcaster
 */
export function ShareDropdown({ 
  type, // 'product' or 'collection'
  handle, // productHandle or collectionHandle
  title, // productTitle or collectionName
  isInFarcaster = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate the mini app URL
  const getMiniAppUrl = () => {
    if (type === 'product') {
      return `${window.location.origin}/product/${handle}`;
    } else if (type === 'collection') {
      return `${window.location.origin}/?collection=${handle}`;
    }
    return window.location.origin;
  };

  // Copy URL to clipboard
  const handleCopyLink = async () => {
    try {
      const url = getMiniAppUrl();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Share cast to Farcaster
  const handleShareCast = async () => {
    setIsOpen(false);
    try {
      if (type === 'product') {
        await shareProduct({
          productHandle: handle,
          productTitle: title,
          isInFarcaster,
        });
      } else if (type === 'collection') {
        await shareCollection({
          collectionHandle: handle,
          collectionName: title,
          isInFarcaster,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Share Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-12 h-12 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white rounded-lg transition-colors"
        title="Share"
      >
        {/* Share icon */}
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
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
  );
}

