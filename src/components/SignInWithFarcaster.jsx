'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSignIn, useProfile } from '@farcaster/auth-kit';

/**
 * Deep Link Handler component - handles both mobile deep links and desktop QR codes
 */
function DeepLinkHandler({ url, channelToken, onCancel }) {
  const [isMobile, setIsMobile] = useState(false);
  const [deepLinkOpened, setDeepLinkOpened] = useState(false);

  useEffect(() => {
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(mobile);

    // If on mobile, automatically open the Farcaster deep link
    if (mobile && !deepLinkOpened) {
      console.log('📱 Mobile detected, opening Farcaster app with deep link...');
      
      // Create Farcaster deep link with channel token
      const deepLinkUrl = `farcaster://sign-in?channelToken=${channelToken}`;
      const farcasterWebLink = `https://farcaster.xyz/~/sign-in-with-farcaster?channelToken=${channelToken}`;
      
      // Try to open the Farcaster app using custom URL scheme
      const attemptDeepLink = () => {
        // Create a hidden iframe to trigger the deep link without navigating away
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLinkUrl;
        document.body.appendChild(iframe);
        
        // Clean up iframe after attempting
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
        
        // If the app doesn't open (user doesn't have it or it failed), 
        // the manual button will be available for them to click
        console.log('📱 Deep link attempted via iframe');
      };

      attemptDeepLink();
      setDeepLinkOpened(true);
    }
  }, [channelToken, deepLinkOpened]);

  if (isMobile) {
    return (
      <div className="text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4 p-3">
            <img 
              src="/logo.png" 
              alt="Minted Merch" 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Opening Farcaster...
          </h3>
          <p className="text-sm text-gray-700 mb-3 px-2">
            Sign in with Farcaster to access your profile, daily check-ins, leaderboard, notifications, order history, and token gated discounts!
          </p>
          <p className="text-sm text-gray-600 mb-4">
            If the app doesn't open automatically, tap the button below
          </p>
        </div>

        <a
          href={`https://farcaster.xyz/~/sign-in-with-farcaster?channelToken=${channelToken}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white font-medium rounded-lg transition-colors mb-4"
        >
          {/* New Farcaster Logo (2024 rebrand) */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.5 3H18.5V21H15.5V11.5H15.4C15.1 8.9 13.3 7 11 7C8.7 7 6.9 8.9 6.6 11.5H6.5V21H3.5V3H5.5Z" fill="currentColor"/>
            <path d="M3 6L3.5 8H4.5V18.5C4.2 18.5 4 18.7 4 19V19.5H3.5C3.2 19.5 3 19.7 3 20V21H9V20C9 19.7 8.8 19.5 8.5 19.5H8V19C8 18.7 7.8 18.5 7.5 18.5H7V6H3Z" fill="currentColor"/>
            <path d="M16.5 18.5C16.2 18.5 16 18.7 16 19V19.5H15.5C15.2 19.5 15 19.7 15 20V21H21V20C21 19.7 20.8 19.5 20.5 19.5H20V19C20 18.7 19.8 18.5 19.5 18.5V8H20.5L21 6H17V18.5H16.5Z" fill="currentColor"/>
          </svg>
          <span>Open Farcaster</span>
        </a>

        <p className="text-xs text-gray-500 mb-4">
          After signing in with Farcaster, return to this tab to continue
        </p>

        <button
          onClick={onCancel}
          className="w-full px-4 py-3 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
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
      
      {/* QR Code iframe - larger size */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <iframe
          src={url}
          title="Farcaster Sign In"
          className="w-full h-[500px] border-0"
          allow="camera; publickey-credentials-get *"
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
        {/* New Farcaster Logo (2024 rebrand) */}
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.5 3H18.5V21H15.5V11.5H15.4C15.1 8.9 13.3 7 11 7C8.7 7 6.9 8.9 6.6 11.5H6.5V21H3.5V3H5.5Z" fill="currentColor"/>
          <path d="M3 6L3.5 8H4.5V18.5C4.2 18.5 4 18.7 4 19V19.5H3.5C3.2 19.5 3 19.7 3 20V21H9V20C9 19.7 8.8 19.5 8.5 19.5H8V19C8 18.7 7.8 18.5 7.5 18.5H7V6H3Z" fill="currentColor"/>
          <path d="M16.5 18.5C16.2 18.5 16 18.7 16 19V19.5H15.5C15.2 19.5 15 19.7 15 20V21H21V20C21 19.7 20.8 19.5 20.5 19.5H20V19C20 18.7 19.8 18.5 19.5 18.5V8H20.5L21 6H17V18.5H16.5Z" fill="currentColor"/>
        </svg>
        <span>Sign in</span>
      </button>

      {/* Modal with QR code or deep link */}
      {showModal && url && channelToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={handleCancel}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8 relative"
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

