'use client';

import { useState, useEffect } from 'react';
import { sdk } from './frame';

export function useFarcaster() {
  const [context, setContext] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInFarcaster, setIsInFarcaster] = useState(false);

  useEffect(() => {
    async function loadContext() {
      try {
        const farcasterContext = await sdk.context;
        
        setContext(farcasterContext);
        setIsInFarcaster(!!farcasterContext);
        
        if (farcasterContext && farcasterContext.user) {
          setUser(farcasterContext.user);
        }
      } catch (error) {
        console.log('Error loading Farcaster context:', error);
        setIsInFarcaster(false);
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
    // Helper functions
    getFid: () => user?.fid,
    getUsername: () => user?.username,
    getDisplayName: () => user?.displayName,
    getPfpUrl: () => user?.pfpUrl,
  };
} 