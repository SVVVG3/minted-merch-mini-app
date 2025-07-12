import { sdk } from '@farcaster/miniapp-sdk'

export async function initializeFrame() {
  try {
    // Get the Mini App context
    const context = await sdk.context

    // Store context globally for easy access
    window.farcasterContext = context;
    
    if (context && context.user) {
      console.log('Farcaster Mini App context detected:', {
        fid: context.user.fid,
        username: context.user.username,
        displayName: context.user.displayName,
        pfpUrl: context.user.pfpUrl
      });
      
      // Store user info globally
      window.userFid = context.user.fid;
      window.farcasterUser = context.user;
      
      // Store FID in localStorage for persistence across sessions
      if (context.user.fid) {
        localStorage.setItem('farcaster_fid', context.user.fid.toString());
        console.log('📦 FID stored in localStorage for persistence:', context.user.fid);
      }
      
      // Setup real-time notification event listeners
      setupNotificationEventListeners(context.user.fid);
      
      // Call ready to hide splash screen
      await sdk.actions.ready();
    } else {
      console.log('Not running in Farcaster Mini App context');
      // Still call ready in case we're in a frame without user context
      await sdk.actions.ready();
    }
  } catch (error) {
    console.log('Error initializing Farcaster context:', error);
    // Fallback: call ready anyway to prevent splash screen from staying
    try {
      await sdk.actions.ready();
    } catch (readyError) {
      console.log('Error calling ready:', readyError);
    }
  }
}

// Setup real-time notification event listeners
function setupNotificationEventListeners(userFid) {
  console.log('🔔 Setting up real-time notification event listeners for FID:', userFid);
  
  // Listen for notifications being enabled
  sdk.on('notificationsEnabled', async () => {
    console.log('🔔 User ENABLED notifications - updating database...');
    
    try {
      const response = await fetch('/api/update-notification-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: userFid,
          enabled: true,
          source: 'farcaster_event'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Notification status updated to ENABLED:', result.message);
      } else {
        console.error('❌ Failed to update notification status:', result.error);
      }
    } catch (error) {
      console.error('❌ Error updating notification status:', error);
    }
  });
  
  // Listen for notifications being disabled  
  sdk.on('notificationsDisabled', async () => {
    console.log('🔕 User DISABLED notifications - updating database...');
    
    try {
      const response = await fetch('/api/update-notification-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: userFid,
          enabled: false,
          source: 'farcaster_event'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Notification status updated to DISABLED:', result.message);
      } else {
        console.error('❌ Failed to update notification status:', result.error);
      }
    } catch (error) {
      console.error('❌ Error updating notification status:', error);
    }
  });
  
  // Listen for Mini App being added (user might enable notifications when adding)
  sdk.on('miniappAdded', async () => {
    console.log('🎉 Mini App added by user');
    // Note: This doesn't necessarily mean notifications are enabled
    // We'll still rely on the specific notification events
  });
  
  // Listen for Mini App being removed (notifications definitely disabled)
  sdk.on('miniappRemoved', async () => {
    console.log('❌ Mini App removed by user - disabling notifications...');
    
    try {
      const response = await fetch('/api/update-notification-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: userFid,
          enabled: false,
          source: 'miniapp_removed'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Notification status updated to DISABLED due to app removal:', result.message);
      } else {
        console.error('❌ Failed to update notification status:', result.error);
      }
    } catch (error) {
      console.error('❌ Error updating notification status:', error);
    }
  });
  
  console.log('🎯 Real-time notification event listeners setup complete');
}

// Cleanup function to remove event listeners
export function cleanupNotificationEventListeners() {
  console.log('🧹 Cleaning up notification event listeners...');
  
  sdk.removeListener('notificationsEnabled');
  sdk.removeListener('notificationsDisabled');
  sdk.removeListener('miniappAdded');
  sdk.removeListener('miniappRemoved');
  
  console.log('✅ Event listeners cleaned up');
}

// Export the SDK for use in other components
export { sdk };