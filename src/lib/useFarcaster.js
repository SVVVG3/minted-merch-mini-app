'use client';

import { useState, useEffect } from 'react';
import { sdk } from './frame';
import { useProfile } from '@farcaster/auth-kit';

export function useFarcaster() {
  const [context, setContext] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  
  // AuthKit profile for non-mini-app environments
  const { isAuthenticated: isAuthKitAuthenticated, profile: authKitProfile} = useProfile();

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

  // PHASE 2: Get session token for Mini App (Quick Auth)
  useEffect(() => {
    async function getMiniAppSession() {
      if (!isInFarcaster || !user?.fid || sessionToken) return;
      
      try {
        console.log('🔐 Getting Quick Auth session for Mini App...');
        
        // Try to use Quick Auth to get Farcaster's JWT
        // Note: Quick Auth may not be available in all Mini App contexts
        // For now, we'll create a session with just the FID (temporary)
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
          console.log('✅ Session token obtained for Mini App user');
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
  
  // PHASE 2: Get session token for Desktop/AuthKit
  useEffect(() => {
    async function getAuthKitSession() {
      if (isInFarcaster || !isAuthKitAuthenticated || !authKitProfile?.fid || sessionToken) return;
      
      try {
        console.log('🔐 Getting session for AuthKit user...');
        
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: authKitProfile.fid,
            username: authKitProfile.username,
            authKitSession: true
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
  }, [isInFarcaster, isAuthKitAuthenticated, authKitProfile?.fid, sessionToken]);
  
  // PHASE 2: Load session token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('fc_session_token');
    if (storedToken && !sessionToken) {
      console.log('📦 Loaded session token from localStorage');
      setSessionToken(storedToken);
    }
  }, []);

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