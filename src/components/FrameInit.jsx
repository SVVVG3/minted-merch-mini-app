'use client';

import { useEffect, useState } from 'react';

// This component uses Neynar's useMiniApp hook when available
// It's wrapped by MiniAppProvider in Providers.jsx
export function FrameInit() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || initialized) return;

    // Dynamic import to avoid SSR issues with useMiniApp hook
    import('@neynar/react').then(({ useMiniApp }) => {
      // We can't use hooks here, but MiniAppBridge component handles this
    }).catch(() => {
      // Fallback to direct SDK if Neynar not available
      initializeWithDirectSDK();
    });
  }, [initialized]);

  return <MiniAppBridge onInitialized={() => setInitialized(true)} />;
}

// Separate component that can safely use the hook (only renders client-side within provider)
function MiniAppBridge({ onInitialized }) {
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || hasInitialized) return;

    // Try to use Neynar's hook
    let cleanup = () => {};
    
    import('@neynar/react').then(async (neynarReact) => {
      // Since we can't call hooks inside useEffect, we'll use the SDK directly
      // but through Neynar's provider context
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        const context = await sdk.context;
        
        if (context) {
          // Store context globally for easy access
          window.farcasterContext = context;
          window.neynarSdk = sdk; // Store SDK for useFarcaster
          
          // Detect if we're in the Base app (client FID is not Warpcast's 9152)
          const isBaseApp = context.client?.clientFid && context.client?.clientFid !== 9152;
          
          // DEBUG: Log what SDK context contains
          console.log('📱 Farcaster SDK context received:', {
            hasFid: !!context.user?.fid,
            fid: context.user?.fid,
            username: context.user?.username,
            displayName: context.user?.displayName,
            pfpUrl: context.user?.pfpUrl || 'NOT PROVIDED',
            userKeys: context.user ? Object.keys(context.user) : [],
            // Client info for debugging Base vs Farcaster
            clientFid: context.client?.clientFid,
            platformType: context.client?.platformType,
            isBaseApp
          });
          
          // Store client info for easy access
          window.farcasterClientFid = context.client?.clientFid;
          window.isBaseApp = isBaseApp;
          
          if (context.user) {
            window.userFid = context.user.fid;
            window.farcasterUser = context.user;
            
            if (context.user.fid) {
              localStorage.setItem('farcaster_fid', context.user.fid.toString());
            }
            
            // Setup notification listeners
            setupNotificationEventListeners(sdk, context.user.fid);
          }
          
          // Call ready to hide splash screen
          // disableNativeGestures: true prevents pull-to-minimize in Farcaster/Warpcast
          // BUT it breaks scrolling in the Base app, so we only enable it for non-Base clients
          await sdk.actions.ready({ disableNativeGestures: !isBaseApp });
        } else {
          // Not in Farcaster - still call ready
          try {
            await sdk.actions.ready({ disableNativeGestures: false });
          } catch (e) {
            // Silent fail
          }
        }
        
        setHasInitialized(true);
        onInitialized?.();
      } catch (error) {
        // Fallback if SDK fails
        initializeWithDirectSDK();
        setHasInitialized(true);
        onInitialized?.();
      }
    }).catch(() => {
      // Neynar not available, use direct SDK
      initializeWithDirectSDK();
      setHasInitialized(true);
      onInitialized?.();
    });

    return cleanup;
  }, [hasInitialized, onInitialized]);

  return null;
}

// Fallback initialization using direct SDK
async function initializeWithDirectSDK() {
  if (typeof window === 'undefined') return;
  
  try {
    const { sdk } = await import('@farcaster/miniapp-sdk');
    
    const context = await sdk.context;
    
    if (context) {
      window.farcasterContext = context;
      window.neynarSdk = sdk;
      
      // Detect if we're in the Base app (client FID is not Warpcast's 9152)
      const isBaseApp = context.client?.clientFid && context.client?.clientFid !== 9152;
      
      // DEBUG: Log what SDK context contains
      console.log('📱 Farcaster SDK context (direct):', {
        hasFid: !!context.user?.fid,
        fid: context.user?.fid,
        username: context.user?.username,
        displayName: context.user?.displayName,
        pfpUrl: context.user?.pfpUrl || 'NOT PROVIDED',
        userKeys: context.user ? Object.keys(context.user) : [],
        isBaseApp
      });
      
      // Store client info for easy access
      window.farcasterClientFid = context.client?.clientFid;
      window.isBaseApp = isBaseApp;
      
      if (context.user) {
        window.userFid = context.user.fid;
        window.farcasterUser = context.user;
        
        if (context.user.fid) {
          localStorage.setItem('farcaster_fid', context.user.fid.toString());
        }
        
        setupNotificationEventListeners(sdk, context.user.fid);
      }
      
      // disableNativeGestures: true prevents pull-to-minimize in Farcaster/Warpcast
      // BUT it breaks scrolling in the Base app, so we only enable it for non-Base clients
      await sdk.actions.ready({ disableNativeGestures: !isBaseApp });
    } else {
      try {
        await sdk.actions.ready({ disableNativeGestures: false });
      } catch (e) {
        // Silent fail
      }
    }
  } catch (error) {
    // Silent fail
  }
}

// Setup real-time notification event listeners
function setupNotificationEventListeners(sdk, userFid) {
  if (!sdk?.on) return;
  
  sdk.on('notificationsEnabled', async () => {
    try {
      await fetch('/api/update-notification-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid, enabled: true, source: 'farcaster_event' })
      });
    } catch (error) {
      console.error('Error updating notification status:', error.message);
    }
  });
  
  sdk.on('notificationsDisabled', async () => {
    try {
      await fetch('/api/update-notification-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid, enabled: false, source: 'farcaster_event' })
      });
    } catch (error) {
      console.error('Error updating notification status:', error.message);
    }
  });
  
  sdk.on('miniappRemoved', async () => {
    try {
      await fetch('/api/update-notification-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid, enabled: false, source: 'miniapp_removed' })
      });
    } catch (error) {
      console.error('Error updating notification status:', error.message);
    }
  });
}