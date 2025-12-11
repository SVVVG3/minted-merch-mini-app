'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile, useSignIn } from '@farcaster/auth-kit';

// Safely import useMiniApp - it may not be available during SSR/prerendering
let useMiniAppHook = null;
if (typeof window !== 'undefined') {
  try {
    const neynarReact = require('@neynar/react');
    useMiniAppHook = neynarReact.useMiniApp;
  } catch (e) {
    // Neynar not available
  }
}

// Safe wrapper for useMiniApp that handles SSR and missing provider
function useSafeMiniApp() {
  const [miniAppState, setMiniAppState] = useState({
    isSDKLoaded: false,
    context: null,
    sdk: null
  });

  useEffect(() => {
    // Only try to use the hook on client-side
    if (typeof window === 'undefined') return;
    
    try {
      // Dynamic import to avoid SSR issues
      import('@neynar/react').then(({ useMiniApp }) => {
        // We can't call hooks conditionally, so we use a workaround
        // The actual hook is called in the MiniAppBridge component
      }).catch(() => {
        // Neynar not available
      });
    } catch (e) {
      // Error loading Neynar
    }
  }, []);

  return miniAppState;
}

export function useFarcaster() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [miniAppData, setMiniAppData] = useState({ isSDKLoaded: false, context: null, sdk: null });
  const hasAttemptedMiniAppAuth = useRef(false); // Track if we've tried to get Mini App token
  
  // Check for Neynar context from window (set by FrameInit via MiniAppProvider)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Poll for context set by FrameInit
    const checkContext = () => {
      if (window.farcasterContext) {
        setMiniAppData({
          isSDKLoaded: true,
          context: window.farcasterContext,
          sdk: window.neynarSdk || null
        });
      }
    };
    
    // Check immediately
    checkContext();
    
    // Also check after a short delay (in case FrameInit loads later)
    const timeout = setTimeout(checkContext, 500);
    const timeout2 = setTimeout(checkContext, 1500);
    
    return () => {
      clearTimeout(timeout);
      clearTimeout(timeout2);
    };
  }, []);
  
  // Derive state from context
  const context = miniAppData.context;
  const sdk = miniAppData.sdk;
  const isSDKLoaded = miniAppData.isSDKLoaded;
  const isInFarcaster = isSDKLoaded && !!context;
  
  // AuthKit profile and sign-in data for non-mini-app environments
  const { isAuthenticated: isAuthKitAuthenticated, profile: authKitProfile} = useProfile();
  const { data: authKitData, validSignature } = useSignIn(); // Get signature data

  useEffect(() => {
    // Use context from window (set by FrameInit)
    if (typeof window === 'undefined') {
      setIsLoading(false);
      setIsReady(true);
      return;
    }
    
    if (!isSDKLoaded) {
      // Still loading, but set a timeout to prevent indefinite loading
      const timeout = setTimeout(() => {
        setIsLoading(false);
        setIsReady(true);
      }, 2000);
      return () => clearTimeout(timeout);
    }
    
    setIsLoading(false);
    
    if (context && context.user) {
      setUser(context.user);
      setIsReady(true);
    } else if (context) {
      // We're in Farcaster but no user data - try alternate locations
      if (context.client?.user) {
        setUser(context.client.user);
      } else if (window.farcasterUser) {
        setUser(window.farcasterUser);
      }
      setIsReady(true);
    } else {
      // Not in Farcaster mini app environment
      setIsReady(true);
    }
  }, [isSDKLoaded, context]);

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
      // Only clear user if we DON'T have a valid session token
      // (user might be restored from token after page reload)
      const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('fc_session_token') : null;
      if (!storedToken) {
        setUser(null);
      }
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
  }, [isInFarcaster, user?.fid, sessionToken, sdk]);
  
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
  
  // Track if we've already fetched the profile to prevent duplicate requests
  const hasFetchedProfile = useRef(false);
  
  // Load session token from localStorage on mount (for desktop/AuthKit)
  // AND restore user from token if AuthKit doesn't have profile yet
  useEffect(() => {
    // Don't load stored token for Mini App - always fetch fresh
    if (isInFarcaster) return;
    
    const storedToken = localStorage.getItem('fc_session_token');
    if (storedToken) {
      try {
        const parts = storedToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const expiresAt = payload.exp * 1000;
          
          if (expiresAt > Date.now()) {
            // Token is valid
            if (!sessionToken) {
              setSessionToken(storedToken);
            }
            
            // IMPORTANT: If AuthKit doesn't have the user yet but we have a valid token,
            // restore user from the token payload AND fetch full profile from database
            // Use ref to prevent duplicate fetches
            if (!user && payload.fid && !hasFetchedProfile.current) {
              hasFetchedProfile.current = true;
              console.log('🔄 Restoring user from session token:', payload.fid);
              
              // Set basic user info immediately
              setUser({
                fid: parseInt(payload.fid),
                username: payload.username || null,
                displayName: payload.username || null,
                pfpUrl: null,
                isAuthKit: true,
                restoredFromToken: true
              });
              
              // Fetch full profile from database to get pfpUrl (only once)
              fetch(`/api/profile?fid=${payload.fid}`, {
                headers: {
                  'Authorization': `Bearer ${storedToken}`
                }
              })
                .then(res => res.json())
                .then(data => {
                  if (data.success && data.profile) {
                    console.log('✅ Fetched profile from database:', data.profile.username);
                    setUser(prev => ({
                      ...prev,
                      username: data.profile.username || prev?.username,
                      displayName: data.profile.display_name || prev?.displayName,
                      pfpUrl: data.profile.pfp_url || null,
                      bio: data.profile.bio || null
                    }));
                  }
                  // If no profile found, that's okay - user might not be registered yet
                })
                .catch(err => {
                  console.error('Error fetching profile:', err);
                });
            }
          } else {
            localStorage.removeItem('fc_session_token');
            setSessionToken(null);
          }
        } else {
          localStorage.removeItem('fc_session_token');
        }
      } catch (error) {
        localStorage.removeItem('fc_session_token');
      }
    }
  }, [isInFarcaster, sessionToken, user?.fid]); // Only depend on user.fid, not entire user object

  // Track if we've registered this session (ref resets on page reload = fresh data each app open)
  const hasRegisteredThisSession = useRef(false);
  
  // CENTRALIZED USER REGISTRATION
  // Automatically register/update user profile when authenticated
  // This ensures ALL users get a profile regardless of which page they land on
  useEffect(() => {
    async function registerUser() {
      // Guards: need FID, session token, and haven't registered this session yet
      if (!user?.fid || !sessionToken || hasRegisteredThisSession.current) return;
      
      // Mark as attempted immediately to prevent duplicate calls
      hasRegisteredThisSession.current = true;
      
      try {
        console.log('🔄 Auto-registering user profile for FID:', user.fid);
        
        const response = await fetch('/api/register-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            fid: user.fid,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio || null,
            pfpUrl: user.pfpUrl
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log('✅ User profile registered/updated:', {
            fid: user.fid,
            username: user.username,
            walletCount: result.walletAddressCount || 0,
            hasNotifications: result.hasNotifications
          });
        } else {
          console.warn('⚠️ User registration response:', result.error);
        }
      } catch (error) {
        console.error('❌ Error auto-registering user:', error.message);
        // Don't block the app if registration fails
      }
    }
    
    registerUser();
  }, [user?.fid, user?.username, user?.displayName, user?.bio, user?.pfpUrl, sessionToken]);

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