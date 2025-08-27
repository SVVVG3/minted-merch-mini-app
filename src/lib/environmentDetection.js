// Environment detection utilities for Farcaster mini apps

/**
 * Detect if we're running in a mobile Farcaster client
 */
export function isMobileFarcasterClient() {
  if (typeof window === 'undefined') return false;
  
  // Check for Farcaster mobile client indicators
  const userAgent = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  // Check if we have Farcaster context (set by frame initialization)
  const hasFarcasterContext = typeof window.farcasterContext !== 'undefined';
  
  // Check if we're in an iframe (common for mini apps)
  const isInIframe = window !== window.parent;
  
  return isMobile && (hasFarcasterContext || isInIframe);
}

/**
 * Detect if we're running in a desktop browser
 */
export function isDesktopBrowser() {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  return !isMobile;
}

/**
 * Check if Farcaster SDK is available and functional
 */
export async function isFarcasterSDKAvailable() {
  try {
    const { sdk } = await import('@farcaster/miniapp-sdk');
    
    // Try to get context to verify SDK is working
    const context = await sdk.context;
    return !!context;
  } catch (error) {
    console.warn('Farcaster SDK not available:', error);
    return false;
  }
}

/**
 * Get the appropriate payment method based on environment
 */
export function getRecommendedPaymentMethod() {
  if (isMobileFarcasterClient()) {
    return 'farcaster_native'; // Use Farcaster's built-in wallet
  } else if (isDesktopBrowser()) {
    return 'external_wallet'; // Use MetaMask, Coinbase Wallet, etc.
  } else {
    return 'unknown';
  }
}

/**
 * Get user-friendly environment description
 */
export function getEnvironmentDescription() {
  const paymentMethod = getRecommendedPaymentMethod();
  
  switch (paymentMethod) {
    case 'farcaster_native':
      return 'Mobile Farcaster Client - Native wallet integration available';
    case 'external_wallet':
      return 'Desktop Browser - External wallet required (MetaMask, Coinbase Wallet, etc.)';
    default:
      return 'Unknown environment';
  }
}
