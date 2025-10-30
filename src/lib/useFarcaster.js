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
  
  // AuthKit profile for non-mini-app environments
  const { isAuthenticated: isAuthKitAuthenticated, profile: authKitProfile } = useProfile();

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

  return {
    context,
    user,
    isLoading,
    isInFarcaster,
    isReady,
    isAuthKit: user?.isAuthKit || false,
    // Helper functions
    getFid: () => user?.fid,
    getUsername: () => user?.username,
    getDisplayName: () => user?.displayName,
    getPfpUrl: () => user?.pfpUrl,
    // Notification helpers (only available in mini app, not AuthKit)
    hasNotifications: () => !!(context?.client?.notificationDetails || context?.notificationDetails),
    getNotificationDetails: () => context?.client?.notificationDetails || context?.notificationDetails,
  };
} 