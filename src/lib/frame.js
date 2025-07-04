import { sdk } from '@farcaster/frame-sdk'

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

// Export the SDK for use in other components
export { sdk };