'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PartnerProvider, usePartner } from '@/lib/PartnerContext';
import { useFarcaster } from '@/lib/useFarcaster';
import { useSignIn, useProfile } from '@farcaster/auth-kit';
import { QRCodeSVG } from 'qrcode.react';

function LoginForm() {
  const [error, setError] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const isRedirecting = useRef(false);
  const hasProcessedSignIn = useRef(false);
  
  const { loginWithFarcaster, isAuthenticated, loading: partnerLoading } = usePartner();
  const { user, isInFarcaster, sessionToken, isLoading: farcasterLoading } = useFarcaster();
  const router = useRouter();

  // AuthKit hooks for desktop sign-in
  const {
    signIn,
    signOut,
    isSuccess,
    isError,
    error: signInError,
    channelToken,
    url,
    data,
    validSignature,
  } = useSignIn({
    onSuccess: ({ fid, username }) => {
      console.log('✅ Partner login: AuthKit sign-in successful', { fid, username });
    },
  });

  const { isAuthenticated: authKitAuthenticated } = useProfile();

  // Redirect if already authenticated as partner
  useEffect(() => {
    if (!partnerLoading && isAuthenticated && !isRedirecting.current) {
      console.log('✅ Already authenticated as partner, redirecting...');
      isRedirecting.current = true;
      router.replace('/partner');
    }
  }, [isAuthenticated, partnerLoading, router]);

  // Auto-login in Farcaster mini-app environment
  useEffect(() => {
    const attemptAutoLogin = async () => {
      if (autoLoginAttempted || partnerLoading || farcasterLoading || isRedirecting.current) return;
      if (!isInFarcaster || !user?.fid || !sessionToken) return;
      
      setAutoLoginAttempted(true);
      console.log('🤝 Partner login: Auto-login via Farcaster mini-app...');
      setIsSigningIn(true);
      setError('');

      const result = await loginWithFarcaster(sessionToken);
      
      if (result.success) {
        console.log('✅ Partner auto-login successful');
        isRedirecting.current = true;
        router.replace('/partner');
      } else {
        console.log('⚠️ Partner auto-login failed:', result.error);
        setError(result.error || 'No partner account linked to this Farcaster account');
        setIsSigningIn(false);
      }
    };

    attemptAutoLogin();
  }, [isInFarcaster, user?.fid, sessionToken, partnerLoading, farcasterLoading, autoLoginAttempted, loginWithFarcaster, router]);

  // Handle AuthKit sign-in success - this is where we login as partner WITHOUT reloading
  useEffect(() => {
    const processSignIn = async () => {
      if (!isSuccess || !validSignature || !data) return;
      if (hasProcessedSignIn.current || isRedirecting.current) return;
      
      hasProcessedSignIn.current = true;
      console.log('🔐 Partner login: Processing AuthKit sign-in data...', { fid: data.fid });
      setShowQRModal(false);
      setIsSigningIn(true);
      setError('');

      try {
        // Use production domain for consistency
        const PRODUCTION_DOMAIN = 'app.mintedmerch.shop';
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const authDomain = isDevelopment ? window.location.host : PRODUCTION_DOMAIN;

        // First, create a Farcaster session token
        console.log('📝 Creating Farcaster session token...');
        const sessionResponse = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authKitData: {
              message: data.message,
              signature: data.signature,
              nonce: data.nonce,
              domain: authDomain,
              fid: data.fid,
              username: data.username
            }
          })
        });

        const sessionResult = await sessionResponse.json();

        if (!sessionResult.success || !sessionResult.token) {
          console.error('❌ Failed to create session:', sessionResult.error);
          setError(sessionResult.error || 'Failed to create Farcaster session');
          setIsSigningIn(false);
          hasProcessedSignIn.current = false;
          return;
        }

        console.log('✅ Session token created, logging in as partner...');
        
        // Store the session token for other app features
        localStorage.setItem('fc_session_token', sessionResult.token);

        // Now login as partner
        const partnerResult = await loginWithFarcaster(sessionResult.token);
        
        if (partnerResult.success) {
          console.log('✅ Partner login successful! Redirecting...');
          isRedirecting.current = true;
          router.replace('/partner');
        } else {
          console.log('⚠️ Partner login failed:', partnerResult.error);
          setError(partnerResult.error || 'No partner account linked to this Farcaster account');
          setIsSigningIn(false);
          hasProcessedSignIn.current = false;
        }
      } catch (err) {
        console.error('❌ Partner login error:', err);
        setError('Failed to complete sign-in. Please try again.');
        setIsSigningIn(false);
        hasProcessedSignIn.current = false;
      }
    };

    processSignIn();
  }, [isSuccess, validSignature, data, loginWithFarcaster, router]);

  // Handle AuthKit errors
  useEffect(() => {
    if (isError && signInError) {
      console.error('❌ AuthKit error:', signInError);
      setError('Farcaster sign-in failed. Please try again.');
      setShowQRModal(false);
      setIsSigningIn(false);
    }
  }, [isError, signInError]);

  // Initiate sign-in
  const handleSignIn = useCallback(async () => {
    console.log('🔐 Partner login: Initiating Farcaster sign-in...');
    setError('');
    hasProcessedSignIn.current = false;
    
    try {
      await signIn();
      // Wait for URL to be generated
      await new Promise(resolve => setTimeout(resolve, 300));
      setShowQRModal(true);
    } catch (err) {
      console.error('Sign-in initiation error:', err);
      setError('Failed to start sign-in. Please try again.');
    }
  }, [signIn]);

  const handleCancel = useCallback(() => {
    console.log('❌ Sign-in cancelled');
    setShowQRModal(false);
    signOut();
    hasProcessedSignIn.current = false;
  }, [signOut]);

  // Loading states
  if (partnerLoading || (isInFarcaster && farcasterLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3eb489] mx-auto mb-4"></div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (isSigningIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3eb489] mx-auto mb-4"></div>
          <div className="text-gray-600">Signing you in...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <img 
            src="/MintedMerchSpinnerLogo.png" 
            alt="Minted Merch"
            className="h-12 w-auto mx-auto mb-4"
          />
          <h2 className="mt-2 text-center text-3xl font-bold text-gray-900">
            Partner Portal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in with Farcaster to manage your assigned orders
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Custom Sign In Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSignIn}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white font-medium text-sm rounded-lg transition-colors"
            >
              {/* Farcaster Logo */}
              <svg className="w-5 h-5" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
              </svg>
              Sign in with Farcaster
            </button>
          </div>

          <div className="text-center space-y-3">
            <p className="text-xs text-gray-500">
              Your Farcaster account must be linked to a partner account.
            </p>
            <p className="text-xs text-gray-500">
              Need access? Contact the admin to create your partner account.
            </p>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={handleCancel}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 sm:p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleCancel}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
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
                {url && channelToken 
                  ? "Scan this QR code with your phone's camera or Farcaster app"
                  : "Generating sign-in link..."
                }
              </p>
            </div>
            
            {/* QR Code or Loading */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-8 flex justify-center items-center mb-4 min-h-[320px]">
              {url && channelToken ? (
                <QRCodeSVG
                  value={url}
                  size={280}
                  level="M"
                  includeMargin={true}
                />
              ) : (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6A3CFF] mx-auto mb-4"></div>
                  <p className="text-gray-500 text-sm">Connecting to Farcaster...</p>
                </div>
              )}
            </div>

            <button
              onClick={handleCancel}
              className="w-full px-4 py-3 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PartnerLoginPage() {
  return (
    <PartnerProvider>
      <LoginForm />
    </PartnerProvider>
  );
}
