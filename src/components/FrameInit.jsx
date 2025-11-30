'use client';

import { useEffect } from 'react';
import { useMiniApp } from '@neynar/react';

export function FrameInit() {
  const { isSDKLoaded, context, sdk } = useMiniApp();

  useEffect(() => {
    if (!isSDKLoaded || !context) return;

    // Store context globally for easy access (maintains backward compatibility)
    window.farcasterContext = context;
    
    if (context.user) {
      // Store user info globally
      window.userFid = context.user.fid;
      window.farcasterUser = context.user;
      
      // Store FID in localStorage for persistence across sessions
      if (context.user.fid) {
        localStorage.setItem('farcaster_fid', context.user.fid.toString());
      }
      
      // Setup real-time notification event listeners using Neynar's SDK
      setupNotificationEventListeners(sdk, context.user.fid);
    }
    
    // Call ready to hide splash screen (Neynar SDK handles this)
    if (sdk?.actions?.ready) {
      sdk.actions.ready().catch(() => {
        // Silent fail - splash screen may already be hidden
      });
    }
  }, [isSDKLoaded, context, sdk]);

  return null;
}

// Setup real-time notification event listeners using Neynar's SDK instance
function setupNotificationEventListeners(sdk, userFid) {
  if (!sdk?.on) return;
  
  // Listen for notifications being enabled
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
  
  // Listen for notifications being disabled  
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
  
  // Listen for Mini App being removed (notifications definitely disabled)
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