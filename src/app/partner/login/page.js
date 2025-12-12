'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PartnerProvider, usePartner } from '@/lib/PartnerContext';
import { useFarcaster } from '@/lib/useFarcaster';
import { SignInButton } from "@farcaster/auth-kit";

function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const { loginWithFarcaster, isAuthenticated, loading: partnerLoading } = usePartner();
  const { user, isInFarcaster, sessionToken, isLoading: farcasterLoading } = useFarcaster();
  const router = useRouter();

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

  // Handle manual Farcaster sign-in success (desktop)
  const handleFarcasterSuccess = useCallback(async (res) => {
    console.log('🔐 Farcaster sign-in successful, creating session...');
    setIsLoading(true);
    setError('');

    try {
      // First, create a session token using the AuthKit data
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authKitData: {
            message: res.message,
            signature: res.signature,
            nonce: res.nonce,
            domain: window.location.host,
            fid: res.fid,
            username: res.username
          }
        })
      });

      const sessionResult = await sessionResponse.json();

      if (sessionResult.success && sessionResult.token) {
        // Now use this token to login as partner
        const partnerResult = await loginWithFarcaster(sessionResult.token);
        
        if (partnerResult.success) {
          console.log('✅ Partner Farcaster login successful');
          // Store the session token for other app features
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
  }, [loginWithFarcaster, router]);

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
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-400 cursor-not-allowed"
              >
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Signing in...
              </button>
            ) : (
              <div className="w-full flex justify-center">
                <SignInButton
                  onSuccess={handleFarcasterSuccess}
                  onError={(error) => {
                    console.error('Farcaster sign-in error:', error);
                    setError('Farcaster sign-in failed. Please try again.');
                  }}
                />
              </div>
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
