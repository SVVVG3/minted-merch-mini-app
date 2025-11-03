'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
      // Multi-level guard to prevent duplicate requests
      if (!isInFarcaster || !user?.fid) return;
      
      // Check if we already have a valid session token
      const existingToken = localStorage.getItem('fc_session_token');
      if (existingToken && sessionToken) {
        console.log('✅ Session token already exists, skipping Quick Auth');
        return;
      }
      
      // Check if we've already attempted (component-level)
      if (hasAttemptedMiniAppAuth.current) {
        console.log('⏭️ Already attempted Quick Auth in this session');
        return;
      }
      
      // Check if another instance is currently attempting (global lock)
      const attemptLock = localStorage.getItem('quick_auth_attempting');
      const lockTimestamp = attemptLock ? parseInt(attemptLock) : 0;
      const now = Date.now();
      
      // If lock is less than 5 seconds old, another instance is working on it
      if (attemptLock && (now - lockTimestamp) < 5000) {
        console.log('⏭️ Another instance is currently attempting Quick Auth');
        return;
      }
      
      // Set locks to prevent duplicate attempts
      hasAttemptedMiniAppAuth.current = true;
      localStorage.setItem('quick_auth_attempting', now.toString());
      
      try {
        console.log('🔐 Getting Quick Auth session for Mini App...');
        
        // DEBUG: Log SDK capabilities
        console.log('🔍 SDK Debug Info:', {
          sdkExists: !!sdk,
          sdkKeys: sdk ? Object.keys(sdk) : 'N/A',
          actionsExists: !!sdk?.actions,
          actionsKeys: sdk?.actions ? Object.keys(sdk.actions) : 'N/A',
          quickAuthExists: !!sdk?.quickAuth,
          quickAuthKeys: sdk?.quickAuth ? Object.keys(sdk.quickAuth) : 'N/A',
        });
        
        // SECURITY FIX: Use Quick Auth from Farcaster SDK
        // This returns a cryptographically signed JWT from Farcaster
        // Try multiple possible API paths
        let quickAuthToken = null;
        
        // Method 1: Try sdk.quickAuth.getToken()
        if (sdk?.quickAuth?.getToken) {
          try {
            console.log('🔐 Attempting Method 1: sdk.quickAuth.getToken()...');
            const result = await sdk.quickAuth.getToken();
            quickAuthToken = result?.token || result;
            console.log('✅ Quick Auth Method 1 succeeded');
          } catch (error) {
            console.warn('⚠️ Quick Auth Method 1 failed:', error.message);
          }
        }
        
        // Method 2: Try sdk.actions.signIn()
        if (!quickAuthToken && sdk?.actions?.signIn) {
          try {
            console.log('🔐 Attempting Method 2: sdk.actions.signIn()...');
            const result = await sdk.actions.signIn();
            quickAuthToken = result?.token || result;
            console.log('✅ Quick Auth Method 2 succeeded');
          } catch (error) {
            console.warn('⚠️ Quick Auth Method 2 failed:', error.message);
          }
        }
        
        // Method 3: Try sdk.actions.getAuthToken()
        if (!quickAuthToken && sdk?.actions?.getAuthToken) {
          try {
            console.log('🔐 Attempting Method 3: sdk.actions.getAuthToken()...');
            const result = await sdk.actions.getAuthToken();
            quickAuthToken = result?.token || result;
            console.log('✅ Quick Auth Method 3 succeeded');
          } catch (error) {
            console.warn('⚠️ Quick Auth Method 3 failed:', error.message);
          }
        }
        
        // If we got a token, send it to backend
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
          } else {
            console.error('❌ Failed to get session token:', result.error);
          }
        } else {
          console.error('❌ No Quick Auth method available in SDK');
          console.error('❌ Available SDK structure:', {
            sdkMethods: sdk ? Object.keys(sdk) : 'undefined',
            actionsMethods: sdk?.actions ? Object.keys(sdk.actions) : 'undefined'
          });
          console.error('❌ Cannot authenticate without Quick Auth - Mini App SDK may need update');
          // Note: Legacy insecure fallback has been REMOVED for security
          // Users must have a compatible SDK version with Quick Auth support
        }
      } catch (error) {
        console.error('❌ Error getting Mini App session:', error);
      } finally {
        // Clean up the global lock regardless of success/failure
        localStorage.removeItem('quick_auth_attempting');
        console.log('🧹 Cleaned up Quick Auth lock');
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

  // Memoize callback functions to prevent unnecessary re-renders
  const getFid = useCallback(() => user?.fid, [user?.fid]);
  const getUsername = useCallback(() => user?.username, [user?.username]);
  const getDisplayName = useCallback(() => user?.displayName, [user?.displayName]);
  const getPfpUrl = useCallback(() => user?.pfpUrl, [user?.pfpUrl]);
  const getSessionToken = useCallback(() => sessionToken, [sessionToken]);
  const hasNotifications = useCallback(
    () => !!(context?.client?.notificationDetails || context?.notificationDetails),
    [context?.client?.notificationDetails, context?.notificationDetails]
  );
  const getNotificationDetails = useCallback(
    () => context?.client?.notificationDetails || context?.notificationDetails,
    [context?.client?.notificationDetails, context?.notificationDetails]
  );

  return {
    context,
    user,
    isLoading,
    isInFarcaster,
    isReady,
    isAuthKit: user?.isAuthKit || false,
    sessionToken,
    // Memoized helper functions
    getFid,
    getUsername,
    getDisplayName,
    getPfpUrl,
    getSessionToken,
    hasNotifications,
    getNotificationDetails,
  };
} 