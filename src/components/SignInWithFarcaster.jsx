'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSignIn, useProfile } from '@farcaster/auth-kit';

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
    if (!isAuthenticated) {
      reconnect();
    }
  }, [isAuthenticated, reconnect]);

  const handleSignIn = useCallback(async () => {
    console.log('🔐 Initiating Farcaster sign-in...');
    
    // Show modal
    setShowModal(true);
    
    // Reset any previous state
    signOut();
    
    // Start sign-in flow
    const signInResult = await signIn();
    console.log('Sign-in initiated:', signInResult);
    
    // Connect to the relay
    connect();
  }, [signIn, signOut, connect]);

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
      {/* Sign-in button */}
      <button
        onClick={handleSignIn}
        disabled={!isClient}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#8A63D2] hover:bg-[#7C5BC7] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
      >
        {/* Farcaster Arch Logo */}
        <svg className="w-5 h-5" viewBox="0 0 1000 1000" fill="currentColor">
          <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
          <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.445H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"/>
          <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.445H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"/>
        </svg>
        Sign in
      </button>

      {/* Modal with QR code */}
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

            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Sign in with Farcaster
              </h3>
              <p className="text-sm text-gray-600">
                Scan this QR code with your phone's camera or Warpcast app
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
              onClick={handleCancel}
              className="w-full mt-4 px-4 py-3 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

