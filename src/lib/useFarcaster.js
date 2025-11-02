'use client';

import { useState, useEffect, useRef } from 'react';
import { sdk } from './frame';
import { useProfile, useSignIn } from '@farcaster/auth-kit';

export function useFarcaster() {
  const [context, setContext] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const hasAttemptedMiniAppAuth = useRef(false); // Track if we've tried to get Mini App token
  
  // AuthKit profile and sign-in data for non-mini-app environments
  const { isAuthenticated: isAuthKitAuthenticated, profile: authKitProfile} = useProfile();
  const { data: authKitData, validSignature } = useSignIn(); // Get signature data

  useEffect(() => {
    async function loadContext() {
      try {
        console.log('🔍 Loading Farcaster context...');
        console.log('🔍 SDK object:', sdk);
        const farcasterContext = await sdk.context;
        
        console.log('🔍 Farcaster context loaded:', JSON.stringify(farcasterContext, null, 2));
        console.log('🔍 Context type:', typeof farcasterContext);
        console.log('🔍 Context keys:', farcasterContext ? Object.keys(farcasterContext) : 'null');
        console.log('🔍 Context.user:', farcasterContext?.user);
        
        setContext(farcasterContext);
        setIsInFarcaster(!!farcasterContext);
        
        if (farcasterContext && farcasterContext.user) {
          console.log('✅ Farcaster user data (mini app):', farcasterContext.user);
          console.log('✅ FID:', farcasterContext.user.fid);
          setUser(farcasterContext.user);
          setIsReady(true);
        } else if (farcasterContext) {
          // We're in Farcaster but no user data yet - THIS SHOULDN'T HAPPEN
          console.error('⚠️ CRITICAL: In Farcaster but no user data available!');
          console.error('⚠️ Context exists but context.user is:', farcasterContext.user);
          console.error('⚠️ Full context:', farcasterContext);
          
          // Try to extract user from alternate locations
          if (farcasterContext.client?.user) {
            console.log('🔄 Found user in context.client.user:', farcasterContext.client.user);
            setUser(farcasterContext.client.user);
          } else if (window.farcasterUser) {
            console.log('🔄 Found user in window.farcasterUser:', window.farcasterUser);
            setUser(window.farcasterUser);
          }
          
          setIsReady(true);
        } else {
          // Not in Farcaster mini app environment
          console.log('ℹ️ Not in Farcaster mini app environment');
          setIsReady(true);
        }
      } catch (error) {
        console.error('❌ Error loading Farcaster context:', error);
        console.error('❌ Error details:', error.message, error.stack);
        setIsInFarcaster(false);
        setIsReady(true); // Still mark as ready even if there's an error
      } finally {
        setIsLoading(false);
      }
    }

    loadContext();
  }, []);

  // If user signed in via AuthKit (non-mini-app), use that profile
  useEffect(() => {
    if (!isInFarcaster && isAuthKitAuthenticated && authKitProfile) {
      console.log('✅ Using AuthKit profile:', authKitProfile);
      setUser({
        fid: authKitProfile.fid,
        username: authKitProfile.username,
        displayName: authKitProfile.displayName,
        pfpUrl: authKitProfile.pfpUrl,
        bio: authKitProfile.bio,
        isAuthKit: true, // Flag to indicate this is AuthKit authentication
      });
    } else if (!isInFarcaster && !isAuthKitAuthenticated) {
      // Clear user if AuthKit auth is lost
      console.log('ℹ️ AuthKit not authenticated, clearing user');
      setUser(null);
    }
  }, [isInFarcaster, isAuthKitAuthenticated, authKitProfile]);

  // PHASE 2 FIX: Get session token for Mini App using Quick Auth
  useEffect(() => {
    async function getMiniAppSession() {
      // Don't check sessionToken here - always try to refresh for Mini App
      if (!isInFarcaster || !user?.fid || hasAttemptedMiniAppAuth.current) return;
      
      hasAttemptedMiniAppAuth.current = true; // Mark that we've attempted
      
      try {
        console.log('🔐 Getting Quick Auth session for Mini App...');
        
        // SECURITY FIX: Use Quick Auth from Farcaster SDK
        // This returns a cryptographically signed JWT from Farcaster
        if (sdk?.actions?.quickAuth) {
          try {
            const { token: quickAuthToken } = await sdk.actions.quickAuth();
            
            if (quickAuthToken) {
              console.log('✅ Quick Auth token obtained from Farcaster SDK');
              
              // Send to backend for verification
              const response = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  farcasterToken: quickAuthToken
                })
              });
              
              const result = await response.json();
              
              if (result.success && result.token) {
                console.log('✅ Session token obtained for Mini App user');
                setSessionToken(result.token);
                localStorage.setItem('fc_session_token', result.token);
                return;
              }
            }
          } catch (quickAuthError) {
            console.warn('⚠️ Quick Auth not available, falling back to insecure method:', quickAuthError);
          }
        }
        
        // FALLBACK (INSECURE): If Quick Auth not available, use legacy method
        // This should only happen in development or if SDK version doesn't support Quick Auth
        console.warn('⚠️ Quick Auth not available - using INSECURE fallback (FID only)');
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: user.fid,
            username: user.username
          })
        });
        
        const result = await response.json();
        
        if (result.success && result.token) {
          console.log('⚠️ Session token obtained using legacy method (NOT SECURE)');
          setSessionToken(result.token);
          localStorage.setItem('fc_session_token', result.token);
        } else {
          console.error('❌ Failed to get session token:', result.error);
        }
      } catch (error) {
        console.error('❌ Error getting Mini App session:', error);
      }
    }
    
    getMiniAppSession();
  }, [isInFarcaster, user?.fid, sessionToken]);
  
  // PHASE 2 FIX: Get session token for Desktop/AuthKit with signature verification
  useEffect(() => {
    async function getAuthKitSession() {
      if (isInFarcaster || !isAuthKitAuthenticated || !authKitProfile?.fid || sessionToken) return;
      
      // CRITICAL: Need valid signature data from AuthKit
      if (!authKitData || !validSignature) {
        console.warn('⚠️ AuthKit authenticated but no signature data available yet');
        return;
      }
      
      try {
        console.log('🔐 Getting session for AuthKit user with signature verification...');
        
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // SECURITY FIX: Send cryptographic proof from AuthKit
            authKitData: {
              message: authKitData.message,
              signature: authKitData.signature,
              nonce: authKitData.nonce,
              domain: authKitData.domain,
              fid: authKitData.fid,
              username: authKitData.username
            }
          })
        });
        
        const result = await response.json();
        
        if (result.success && result.token) {
          console.log('✅ Session token obtained for AuthKit user');
          setSessionToken(result.token);
          localStorage.setItem('fc_session_token', result.token);
        } else {
          console.error('❌ Failed to get session token:', result.error);
        }
      } catch (error) {
        console.error('❌ Error getting AuthKit session:', error);
      }
    }
    
    getAuthKitSession();
  }, [isInFarcaster, isAuthKitAuthenticated, authKitProfile?.fid, authKitData, validSignature, sessionToken]);
  
  // PHASE 2: Load session token from localStorage on mount
  // NOTE: For Mini App, we'll always fetch a fresh token (see getMiniAppSession useEffect)
  // This is mainly for desktop/AuthKit where we want to persist tokens across page loads
  useEffect(() => {
    // Don't load stored token for Mini App - always fetch fresh
    if (isInFarcaster) {
      console.log('📦 Mini App detected - will fetch fresh session token');
      return;
    }
    
    const storedToken = localStorage.getItem('fc_session_token');
    if (storedToken && !sessionToken) {
      console.log('📦 Loaded session token from localStorage');
      setSessionToken(storedToken);
    }
  }, [isInFarcaster, sessionToken]);

  return {
    context,
    user,
    isLoading,
    isInFarcaster,
    isReady,
    isAuthKit: user?.isAuthKit || false,
    sessionToken, // PHASE 2: Expose session token
    // Helper functions
    getFid: () => user?.fid,
    getUsername: () => user?.username,
    getDisplayName: () => user?.displayName,
    getPfpUrl: () => user?.pfpUrl,
    getSessionToken: () => sessionToken, // PHASE 2: Helper to get token
    // Notification helpers (only available in mini app, not AuthKit)
    hasNotifications: () => !!(context?.client?.notificationDetails || context?.notificationDetails),
    getNotificationDetails: () => context?.client?.notificationDetails || context?.notificationDetails,
  };
} 