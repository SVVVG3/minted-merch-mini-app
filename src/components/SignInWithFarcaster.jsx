'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSignIn, useProfile } from '@farcaster/auth-kit';
import { QRCodeSVG } from 'qrcode.react';

/**
 * Deep Link Handler component - handles both mobile deep links and desktop QR codes
 */
function DeepLinkHandler({ url, channelToken, onCancel }) {
  const [isMobile, setIsMobile] = useState(false);
  const [deepLinkOpened, setDeepLinkOpened] = useState(false);

  useEffect(() => {
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(mobile);

    // Check if we're running in PWA/standalone mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true;

    // If on mobile and NOT in PWA mode, automatically open the Farcaster deep link
    if (mobile && !deepLinkOpened && !isPWA && url) {
      console.log('📱 Mobile detected (browser mode), opening Farcaster app with official URL...');
      console.log('📍 Using AuthKit URL:', url);
      
      // Try to open the Farcaster app using the official AuthKit URL
      const attemptDeepLink = () => {
        // Create a hidden iframe to trigger the deep link without navigating away
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url; // Use official URL from AuthKit
        document.body.appendChild(iframe);
        
        // Clean up iframe after attempting
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
        
        // If the app doesn't open (user doesn't have it or it failed), 
        // the manual button will be available for them to click
        console.log('📱 Deep link attempted via iframe with official URL');
      };

      attemptDeepLink();
      setDeepLinkOpened(true);
    } else if (isPWA) {
      console.log('📱 Running in PWA mode - user must manually tap to open Farcaster');
    }
  }, [url, deepLinkOpened]);

  if (isMobile) {
    return (
      <>
        <div className="text-center mb-3">
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-3 p-2">
            <img 
              src="/logo.png" 
              alt="Minted Merch" 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Sign in with Farcaster
          </h3>
          <p className="text-xs text-gray-700 mb-2 px-2">
            Sign in with Farcaster to access your profile, daily check-ins, leaderboard, notifications, order history, and token gated discounts!
          </p>
          <p className="text-sm text-gray-600">
            Scan this QR code with your phone's Farcaster app
          </p>
        </div>

        {/* QR Code - direct render instead of iframe */}
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4 mb-4 flex justify-center">
          <QRCodeSVG
            value={url}
            size={220}
            level="M"
            includeMargin={true}
          />
        </div>

        <button
          onClick={onCancel}
          className="w-full px-4 py-3 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </>
    );
  }

  // Desktop: Show QR code
  return (
    <>
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Sign in with Farcaster
        </h3>
        <p className="text-sm text-gray-600">
          Scan this QR code with your phone's camera or Farcaster app
        </p>
      </div>
      
      {/* QR Code - direct render instead of iframe */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-8 flex justify-center">
        <QRCodeSVG
          value={url}
          size={320}
          level="M"
          includeMargin={true}
        />
      </div>

      <button
        onClick={onCancel}
        className="w-full mt-4 px-4 py-3 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Cancel
      </button>
    </>
  );
}

/**
 * Sign in with Farcaster button for non-mini-app environments
 * Only shows when NOT in Farcaster/Base mini app
 */
export function SignInWithFarcaster({ onSignIn }) {
  const {
    signIn,
    signOut,
    connect,
    reconnect,
    isSuccess,
    isError,
    error,
    channelToken,
    url,
    data,
    validSignature,
  } = useSignIn({
    onSuccess: ({ fid, username, bio, displayName, pfpUrl }) => {
      console.log('✅ Farcaster AuthKit sign-in successful:', { fid, username, displayName });
    },
  });

  const { isAuthenticated, profile } = useProfile();
  const [isClient, setIsClient] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Only run on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle successful authentication
  useEffect(() => {
    if (isSuccess && validSignature && data) {
      console.log('✅ Farcaster AuthKit sign-in successful:', data);
      console.log('User FID:', data.fid);
      console.log('Username:', data.username);
      
      // Close modal on success
      setShowModal(false);
      
      // Force a small delay to ensure profile state updates
      setTimeout(() => {
        console.log('Authentication complete, profile should update now');
      }, 100);
      
      // The profile will be automatically updated via useProfile hook
      // which will trigger the useFarcaster hook to update
    }
  }, [isSuccess, validSignature, data]);

  // Log authentication state for debugging
  useEffect(() => {
    console.log('AuthKit State:', {
      isAuthenticated,
      hasProfile: !!profile,
      isSuccess,
      validSignature,
      hasData: !!data,
      showModal
    });
  }, [isAuthenticated, profile, isSuccess, validSignature, data, showModal]);

  // Handle errors
  useEffect(() => {
    if (isError) {
      console.error('❌ Farcaster AuthKit error:', error);
    }
  }, [isError, error]);

  // Auto-reconnect on mount if previously authenticated
  useEffect(() => {
    console.log('🔄 AuthKit attempting auto-reconnect...');
    reconnect();
  }, []); // Run only once on mount, not on every auth change

  const handleSignIn = useCallback(async () => {
    console.log('🔐 Initiating Farcaster sign-in...');
    
    try {
      // Detect if user is on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Start sign-in flow - this generates the channel
      console.log('Calling signIn()...');
      await signIn();
      
      console.log('SignIn called, channel created');
      
      // Wait a moment for url to be available
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // The connect() is automatically called by the hook
      // We don't need to call it manually
      
      // Show modal after sign-in is initiated
      // On mobile, the deep link will open Farcaster app
      // On desktop, show QR code
      setShowModal(true);
    } catch (error) {
      console.error('Sign-in error:', error);
      setShowModal(false);
    }
  }, [signIn]);

  const handleCancel = useCallback(() => {
    console.log('❌ Sign-in cancelled');
    setShowModal(false);
    signOut();
  }, [signOut]);

  const handleSignOut = useCallback(() => {
    console.log('👋 Signing out from Farcaster...');
    signOut();
    setShowModal(false);
    
    // Call parent callback
    if (onSignIn) {
      onSignIn(null);
    }
  }, [signOut, onSignIn]);

  // Don't render on server
  if (!isClient) {
    return null;
  }

  // Show authenticated state
  if (isAuthenticated && profile) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg">
        <img 
          src={profile.pfpUrl} 
          alt={profile.username}
          className="w-8 h-8 rounded-full"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {profile.displayName || profile.username}
          </div>
          <div className="text-xs text-gray-500">
            @{profile.username}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Sign-in button - compact version for header */}
      <button
        onClick={handleSignIn}
        disabled={!isClient}
        className="flex items-center justify-center gap-1 w-full h-12 px-2 bg-[#6A3CFF] hover:bg-[#5A2FE6] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium text-xs rounded-lg transition-colors"
        title="Sign in with Farcaster"
      >
        {/* Official Farcaster Logo (2024 rebrand) */}
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
        </svg>
        <span>Sign in</span>
      </button>

      {/* Modal with QR code or deep link */}
      {showModal && url && channelToken && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto" onClick={handleCancel}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative my-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleCancel}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <DeepLinkHandler url={url} channelToken={channelToken} onCancel={handleCancel} />
          </div>
        </div>
      )}
    </>
  );
}

