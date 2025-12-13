'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PartnerProvider, usePartner } from '@/lib/PartnerContext';
import { useFarcaster } from '@/lib/useFarcaster';
import { SignInWithFarcaster } from '@/components/SignInWithFarcaster';

function LoginForm() {
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const hasAttemptedLogin = useRef(false);
  
  const { loginWithFarcaster, isAuthenticated, loading: partnerLoading } = usePartner();
  const { user, isInFarcaster, sessionToken, isLoading: farcasterLoading } = useFarcaster();
  const router = useRouter();

  // Redirect if already authenticated as partner
  useEffect(() => {
    if (!partnerLoading && isAuthenticated) {
      console.log('✅ Already authenticated as partner, redirecting...');
      router.replace('/partner');
    }
  }, [isAuthenticated, partnerLoading, router]);

  // After page loads (possibly from SignInWithFarcaster reload), check for token and login as partner
  useEffect(() => {
    const attemptPartnerLogin = async () => {
      // Don't run if still loading, already processing, already authenticated, or already tried
      if (partnerLoading || isProcessing || isAuthenticated || hasAttemptedLogin.current) return;
      
      // Check for Farcaster session token (set by SignInWithFarcaster after sign-in)
      const token = localStorage.getItem('fc_session_token');
      if (!token) {
        console.log('ℹ️ No Farcaster session token found');
        return;
      }
      
      // Mark that we've attempted login to prevent loops
      hasAttemptedLogin.current = true;
      
      console.log('🔑 Found Farcaster session token, attempting partner login...');
      setIsProcessing(true);
      setError('');
      
      try {
        const result = await loginWithFarcaster(token);
        
        if (result.success) {
          console.log('✅ Partner login successful!');
          router.replace('/partner');
        } else {
          console.log('⚠️ Partner login failed:', result.error);
          setError(result.error || 'No partner account linked to this Farcaster account. Contact admin for access.');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('❌ Partner login error:', err);
        setError('Login failed. Please try again.');
        setIsProcessing(false);
      }
    };

    attemptPartnerLogin();
  }, [partnerLoading, isProcessing, isAuthenticated, loginWithFarcaster, router]);

  // Also handle mini-app auto-login (when we have sessionToken from useFarcaster)
  useEffect(() => {
    const attemptMiniAppLogin = async () => {
      if (partnerLoading || isProcessing || isAuthenticated || hasAttemptedLogin.current) return;
      if (!isInFarcaster || !sessionToken) return;
      
      hasAttemptedLogin.current = true;
      console.log('🤝 Mini-app: Attempting partner login with session token...');
      setIsProcessing(true);
      setError('');
      
      try {
        const result = await loginWithFarcaster(sessionToken);
        
        if (result.success) {
          console.log('✅ Partner login successful!');
          router.replace('/partner');
        } else {
          console.log('⚠️ Partner login failed:', result.error);
          setError(result.error || 'No partner account linked to this Farcaster account.');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('❌ Partner login error:', err);
        setError('Login failed. Please try again.');
        setIsProcessing(false);
      }
    };

    attemptMiniAppLogin();
  }, [isInFarcaster, sessionToken, partnerLoading, isProcessing, isAuthenticated, loginWithFarcaster, router]);

  // Loading state
  if (partnerLoading || farcasterLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3eb489] mx-auto mb-4"></div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  // Processing partner login after Farcaster sign-in
  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3eb489] mx-auto mb-4"></div>
          <div className="text-gray-600">Verifying partner access...</div>
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

          {/* Use the EXACT same SignInWithFarcaster component as homepage */}
          <div className="flex justify-center">
            <SignInWithFarcaster />
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
