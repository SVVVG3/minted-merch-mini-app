'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PartnerProvider, usePartner } from '@/lib/PartnerContext';
import { useFarcaster } from '@/lib/useFarcaster';
import { SignInWithFarcaster } from '@/components/SignInWithFarcaster';

function LoginForm() {
  const [error, setError] = useState('');
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isRedirecting = useRef(false); // Prevent multiple redirects
  const { loginWithFarcaster, isAuthenticated, loading: partnerLoading } = usePartner();
  const { user, isInFarcaster, sessionToken, isLoading: farcasterLoading } = useFarcaster();
  const router = useRouter();

  // Redirect if already authenticated as partner
  useEffect(() => {
    if (!partnerLoading && isAuthenticated && !isRedirecting.current) {
      isRedirecting.current = true;
      router.push('/partner');
    }
  }, [isAuthenticated, partnerLoading, router]);

  // Auto-login in Farcaster mini-app environment when we have a session token
  useEffect(() => {
    const attemptAutoLogin = async () => {
      if (autoLoginAttempted || partnerLoading || farcasterLoading || isRedirecting.current) return;
      if (!isInFarcaster || !user?.fid || !sessionToken) return;
      
      setAutoLoginAttempted(true);
      console.log('🤝 Auto-logging in partner via Farcaster...');
      setIsProcessing(true);
      setError('');

      const result = await loginWithFarcaster(sessionToken);
      
      if (result.success) {
        console.log('✅ Partner auto-login successful');
        isRedirecting.current = true;
        router.push('/partner');
      } else {
        console.log('⚠️ Partner auto-login failed:', result.error);
        setError(result.error || 'No partner account linked to this Farcaster account');
        setIsProcessing(false);
      }
    };

    attemptAutoLogin();
  }, [isInFarcaster, user?.fid, sessionToken, partnerLoading, farcasterLoading, autoLoginAttempted, loginWithFarcaster, router]);

  // Watch for session token changes (from SignInWithFarcaster completing sign-in)
  // Note: SignInWithFarcaster reloads the page, so we check immediately on mount
  useEffect(() => {
    const checkForNewSession = async () => {
      if (partnerLoading || isProcessing || isAuthenticated || isRedirecting.current) return;
      
      // Check if there's a session token in localStorage (set by SignInWithFarcaster)
      const storedToken = localStorage.getItem('fc_session_token');
      if (!storedToken) return;
      
      // Only attempt if we haven't tried with this token yet
      const lastAttemptedToken = sessionStorage.getItem('partner_login_attempted_token');
      if (lastAttemptedToken === storedToken) return;
      
      console.log('🔑 Found session token, attempting partner login...');
      setIsProcessing(true);
      setError('');
      sessionStorage.setItem('partner_login_attempted_token', storedToken);
      
      const result = await loginWithFarcaster(storedToken);
      
      if (result.success) {
        console.log('✅ Partner login successful');
        isRedirecting.current = true;
        // Use replace to prevent back button issues
        router.replace('/partner');
      } else {
        console.log('⚠️ Partner login failed:', result.error);
        setError(result.error || 'No partner account linked to this Farcaster account');
        setIsProcessing(false);
      }
    };

    // Check immediately on mount (after page reload from SignInWithFarcaster)
    checkForNewSession();
    
    // Also listen for storage events
    const handleStorageChange = () => {
      if (!isRedirecting.current) {
        checkForNewSession();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [partnerLoading, isProcessing, isAuthenticated, loginWithFarcaster, router]);

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

  // Show loading while auto-login is in progress in mini-app or processing sign-in
  if ((isInFarcaster && isProcessing) || isProcessing) {
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

          {/* Use the same SignInWithFarcaster component as the main site */}
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
