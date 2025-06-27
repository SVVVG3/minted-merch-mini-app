'use client';

import { useState, useEffect } from 'react';
import { sdk } from './frame';

export function useFarcaster() {
  const [context, setContext] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadContext() {
      try {
        console.log('Loading Farcaster context...');
        const farcasterContext = await sdk.context;
        
        console.log('Farcaster context loaded:', farcasterContext);
        setContext(farcasterContext);
        setIsInFarcaster(!!farcasterContext);
        
        if (farcasterContext && farcasterContext.user) {
          console.log('Farcaster user data:', farcasterContext.user);
          setUser(farcasterContext.user);
          setIsReady(true);
        } else if (farcasterContext) {
          // We're in Farcaster but no user data yet
          console.log('In Farcaster but no user data available');
          setIsReady(true);
        } else {
          // Not in Farcaster environment
          console.log('Not in Farcaster environment');
          setIsReady(true);
        }
      } catch (error) {
        console.log('Error loading Farcaster context:', error);
        setIsInFarcaster(false);
        setIsReady(true); // Still mark as ready even if there's an error
      } finally {
        setIsLoading(false);
      }
    }

    loadContext();
  }, []);

  return {
    context,
    user,
    isLoading,
    isInFarcaster,
    isReady,
    // Helper functions
    getFid: () => user?.fid,
    getUsername: () => user?.username,
    getDisplayName: () => user?.displayName,
    getPfpUrl: () => user?.pfpUrl,
    // Notification helpers
    hasNotifications: () => !!(context?.client?.notificationDetails || context?.notificationDetails),
    getNotificationDetails: () => context?.client?.notificationDetails || context?.notificationDetails,
  };
} 