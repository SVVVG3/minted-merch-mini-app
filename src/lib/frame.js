import { sdk } from '@farcaster/miniapp-sdk'

export async function initializeFrame() {
  try {
    const context = await sdk.context

    // Store context globally for easy access
    window.farcasterContext = context;
    
    if (context && context.user) {
      // Store user info globally
      window.userFid = context.user.fid;
      window.farcasterUser = context.user;
      
      // Store FID in localStorage for persistence across sessions
      if (context.user.fid) {
        localStorage.setItem('farcaster_fid', context.user.fid.toString());
      }
      
      // Setup real-time notification event listeners
      setupNotificationEventListeners(context.user.fid);
      
      // Call ready to hide splash screen (disableNativeGestures prevents pull-to-minimize conflicts)
      await sdk.actions.ready({ disableNativeGestures: true });
    } else {
      // Still call ready in case we're in a frame without user context
      await sdk.actions.ready({ disableNativeGestures: true });
    }
  } catch (error) {
    // Fallback: call ready anyway to prevent splash screen from staying
    try {
      await sdk.actions.ready({ disableNativeGestures: true });
    } catch (readyError) {
      // Silent fail
    }
  }
}

// Setup real-time notification event listeners
function setupNotificationEventListeners(userFid) {
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
  
  // Listen for Mini App being added
  sdk.on('miniappAdded', async () => {
    // Note: This doesn't necessarily mean notifications are enabled
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

// Cleanup function to remove event listeners
export function cleanupNotificationEventListeners() {
  sdk.removeListener('notificationsEnabled');
  sdk.removeListener('notificationsDisabled');
  sdk.removeListener('miniappAdded');
  sdk.removeListener('miniappRemoved');
}

// Export the SDK for use in other components
export { sdk };