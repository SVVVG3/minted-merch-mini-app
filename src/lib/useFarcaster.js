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
        const farcasterContext = await sdk.context;
        
        setContext(farcasterContext);
        setIsInFarcaster(!!farcasterContext);
        
        if (farcasterContext && farcasterContext.user) {
          setUser(farcasterContext.user);
          setIsReady(true);
        } else if (farcasterContext) {
          // We're in Farcaster but no user data - try alternate locations
          if (farcasterContext.client?.user) {
            setUser(farcasterContext.client.user);
          } else if (window.farcasterUser) {
            setUser(window.farcasterUser);
          }
          setIsReady(true);
        } else {
          // Not in Farcaster mini app environment
          setIsReady(true);
        }
      } catch (error) {
        console.error('Error loading Farcaster context:', error.message);
        setIsInFarcaster(false);
        setIsReady(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadContext();
  }, []);

  // If user signed in via AuthKit (non-mini-app), use that profile
  useEffect(() => {
    if (!isInFarcaster && isAuthKitAuthenticated && authKitProfile) {
      setUser({
        fid: authKitProfile.fid,
        username: authKitProfile.username,
        displayName: authKitProfile.displayName,
        pfpUrl: authKitProfile.pfpUrl,
        bio: authKitProfile.bio,
        isAuthKit: true,
      });
    } else if (!isInFarcaster && !isAuthKitAuthenticated) {
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
        try {
          const parts = existingToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const expiresAt = payload.exp * 1000;
            const now = Date.now();
            
            if (expiresAt > now) {
              return; // Token valid, skip Quick Auth
            } else {
              localStorage.removeItem('fc_session_token');
            }
          }
        } catch (error) {
          localStorage.removeItem('fc_session_token');
        }
      }
      
      // Check if we've already attempted (component-level)
      if (hasAttemptedMiniAppAuth.current) return;
      
      // Check if another instance is currently attempting (global lock)
      const attemptLock = localStorage.getItem('quick_auth_attempting');
      const lockTimestamp = attemptLock ? parseInt(attemptLock) : 0;
      const now = Date.now();
      
      // If lock is less than 5 seconds old, another instance is working on it
      if (attemptLock && (now - lockTimestamp) < 5000) return;
      
      // Set locks to prevent duplicate attempts
      hasAttemptedMiniAppAuth.current = true;
      localStorage.setItem('quick_auth_attempting', now.toString());
      
      try {
        // Try multiple Quick Auth methods from Farcaster SDK
        let quickAuthToken = null;
        
        // Method 1: Try sdk.quickAuth.getToken()
        if (sdk?.quickAuth?.getToken) {
          try {
            const result = await sdk.quickAuth.getToken();
            quickAuthToken = result?.token || result;
          } catch (error) { /* Method not available */ }
        }
        
        // Method 2: Try sdk.actions.signIn()
        if (!quickAuthToken && sdk?.actions?.signIn) {
          try {
            const result = await sdk.actions.signIn();
            quickAuthToken = result?.token || result;
          } catch (error) { /* Method not available */ }
        }
        
        // Method 3: Try sdk.actions.getAuthToken()
        if (!quickAuthToken && sdk?.actions?.getAuthToken) {
          try {
            const result = await sdk.actions.getAuthToken();
            quickAuthToken = result?.token || result;
          } catch (error) { /* Method not available */ }
        }
        
        // If we got a token, send it to backend
        if (quickAuthToken) {
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farcasterToken: quickAuthToken })
          });
          
          const result = await response.json();
          
          if (result.success && result.token) {
            setSessionToken(result.token);
            localStorage.setItem('fc_session_token', result.token);
            return;
          } else {
            console.error('Failed to get session token:', result.error);
          }
        }
      } catch (error) {
        console.error('Error getting Mini App session:', error.message);
      } finally {
        localStorage.removeItem('quick_auth_attempting');
      }
    }
    
    getMiniAppSession();
  }, [isInFarcaster, user?.fid, sessionToken]);
  
  // Get session token for Desktop/AuthKit with signature verification
  useEffect(() => {
    async function getAuthKitSession() {
      if (isInFarcaster || !isAuthKitAuthenticated || !authKitProfile?.fid || sessionToken) return;
      if (!authKitData || !validSignature) return;
      
      try {
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
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
          setSessionToken(result.token);
          localStorage.setItem('fc_session_token', result.token);
        } else {
          console.error('Failed to get AuthKit session token:', result.error);
        }
      } catch (error) {
        console.error('Error getting AuthKit session:', error.message);
      }
    }
    
    getAuthKitSession();
  }, [isInFarcaster, isAuthKitAuthenticated, authKitProfile?.fid, authKitData, validSignature, sessionToken]);
  
  // Load session token from localStorage on mount (for desktop/AuthKit)
  useEffect(() => {
    // Don't load stored token for Mini App - always fetch fresh
    if (isInFarcaster) return;
    
    const storedToken = localStorage.getItem('fc_session_token');
    if (storedToken && !sessionToken) {
      try {
        const parts = storedToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const expiresAt = payload.exp * 1000;
          
          if (expiresAt > Date.now()) {
            setSessionToken(storedToken);
          } else {
            localStorage.removeItem('fc_session_token');
          }
        } else {
          localStorage.removeItem('fc_session_token');
        }
      } catch (error) {
        localStorage.removeItem('fc_session_token');
      }
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