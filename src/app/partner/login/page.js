'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PartnerProvider, usePartner } from '@/lib/PartnerContext';
import { useFarcaster } from '@/lib/useFarcaster';
import { useSignIn } from '@farcaster/auth-kit';
import { QRCodeSVG } from 'qrcode.react';

function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const { loginWithFarcaster, isAuthenticated, loading: partnerLoading } = usePartner();
  const { user, isInFarcaster, sessionToken, isLoading: farcasterLoading } = useFarcaster();
  const router = useRouter();

  // Farcaster AuthKit sign-in hook
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
      console.log('✅ Farcaster AuthKit sign-in successful:', { fid, username });
    },
  });

  // Redirect if already authenticated as partner
  useEffect(() => {
    if (!partnerLoading && isAuthenticated) {
      router.push('/partner');
    }
  }, [isAuthenticated, partnerLoading, router]);

  // Auto-login in Farcaster mini-app environment when we have a session token
  useEffect(() => {
    const attemptAutoLogin = async () => {
      if (autoLoginAttempted || partnerLoading || farcasterLoading) return;
      if (!isInFarcaster || !user?.fid || !sessionToken) return;
      
      setAutoLoginAttempted(true);
      console.log('🤝 Auto-logging in partner via Farcaster...');
      setIsLoading(true);
      setError('');

      const result = await loginWithFarcaster(sessionToken);
      
      if (result.success) {
        console.log('✅ Partner auto-login successful');
        router.push('/partner');
      } else {
        console.log('⚠️ Partner auto-login failed:', result.error);
        setError(result.error || 'No partner account linked to this Farcaster account');
      }
      
      setIsLoading(false);
    };

    attemptAutoLogin();
  }, [isInFarcaster, user?.fid, sessionToken, partnerLoading, farcasterLoading, autoLoginAttempted, loginWithFarcaster, router]);

  // Handle AuthKit sign-in success
  useEffect(() => {
    const handleSignInSuccess = async () => {
      if (!isSuccess || !validSignature || !data) return;
      
      console.log('🔐 Farcaster sign-in successful, creating session...');
      setShowQRModal(false);
      setIsLoading(true);
      setError('');

      try {
        // Use production domain for consistency
        const PRODUCTION_DOMAIN = 'app.mintedmerch.shop';
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const authDomain = isDevelopment ? window.location.host : PRODUCTION_DOMAIN;

        // First, create a session token using the AuthKit data
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

        if (sessionResult.success && sessionResult.token) {
          // Now use this token to login as partner
          const partnerResult = await loginWithFarcaster(sessionResult.token);
          
          if (partnerResult.success) {
            console.log('✅ Partner Farcaster login successful');
            localStorage.setItem('fc_session_token', sessionResult.token);
            router.push('/partner');
          } else {
            setError(partnerResult.error || 'No partner account linked to this Farcaster account');
          }
        } else {
          setError(sessionResult.error || 'Failed to create Farcaster session');
        }
      } catch (err) {
        console.error('Farcaster login error:', err);
        setError('Failed to sign in with Farcaster');
      }
      
      setIsLoading(false);
    };

    handleSignInSuccess();
  }, [isSuccess, validSignature, data, loginWithFarcaster, router]);

  // Handle sign-in errors
  useEffect(() => {
    if (isError && signInError) {
      console.error('❌ Farcaster AuthKit error:', signInError);
      setError('Farcaster sign-in failed. Please try again.');
      setShowQRModal(false);
    }
  }, [isError, signInError]);

  // Initiate sign-in
  const handleSignIn = useCallback(async () => {
    console.log('🔐 Initiating Farcaster sign-in...');
    setError('');
    
    try {
      await signIn();
      await new Promise(resolve => setTimeout(resolve, 500));
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
  }, [signOut]);

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

  // Show loading while auto-login is in progress in mini-app
  if (isInFarcaster && isLoading) {
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

          {/* Farcaster Sign In Button */}
          <div className="flex justify-center">
            {isLoading ? (
              <button
                disabled
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-400 cursor-not-allowed"
              >
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Signing in...
              </button>
            ) : (
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
            )}
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
      {showQRModal && url && channelToken && (
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
                Scan this QR code with your phone's camera or Farcaster app
              </p>
            </div>
            
            {/* QR Code */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-8 flex justify-center mb-4">
              <QRCodeSVG
                value={url}
                size={280}
                level="M"
                includeMargin={true}
              />
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
