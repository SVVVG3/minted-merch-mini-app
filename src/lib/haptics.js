/**
 * Haptics utility for cross-platform haptic feedback
 * - Uses Farcaster SDK haptics in mini app environment
 * - Falls back to Web Vibration API in mobile browsers
 */

import { sdk } from '@farcaster/miniapp-sdk';

/**
 * Haptic intensity patterns for Web Vibration API
 * Maps Farcaster haptic types to vibration patterns (in milliseconds)
 * Note: Increased durations for better mobile browser feedback
 */
const VIBRATION_PATTERNS = {
  light: 20,
  medium: 50,
  heavy: 80,
  success: [30, 50, 30],
  warning: [30, 100, 30, 100, 30],
  error: [80, 50, 80],
  selectionChanged: 15,
};

/**
 * Trigger haptic feedback with automatic fallback
 * @param {string} type - Haptic type: 'light', 'medium', 'heavy', 'success', 'warning', 'error', 'selectionChanged'
 * @param {boolean} isInMiniApp - Whether user is in Farcaster mini app
 * @returns {Promise<boolean>} - Whether haptic was triggered successfully
 */
export async function triggerHaptic(type = 'medium', isInMiniApp = false) {
  // Try Farcaster SDK haptics first if in mini app
  if (isInMiniApp) {
    try {
      const capabilities = await sdk.getCapabilities();
      
      // Map common types to Farcaster SDK methods
      if (type === 'selectionChanged' && capabilities.includes('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
        return true;
      }
      
      if (['light', 'medium', 'heavy'].includes(type) && capabilities.includes('haptics.impactOccurred')) {
        await sdk.haptics.impactOccurred(type);
        return true;
      }
      
      if (['success', 'warning', 'error'].includes(type) && capabilities.includes('haptics.notificationOccurred')) {
        await sdk.haptics.notificationOccurred(type);
        return true;
      }
    } catch (error) {
      console.log('Farcaster haptics not available, trying browser API:', error);
    }
  }
  
  // Fall back to Web Vibration API (works in mobile browsers)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      const pattern = VIBRATION_PATTERNS[type] || VIBRATION_PATTERNS.medium;
      console.log('🔔 Triggering browser vibration:', type, pattern);
      const result = navigator.vibrate(pattern);
      console.log('🔔 Vibration result:', result);
      return true;
    } catch (error) {
      console.log('❌ Web Vibration API error:', error);
    }
  } else {
    console.log('❌ Web Vibration API not available. Navigator.vibrate:', typeof navigator !== 'undefined' ? navigator.vibrate : 'navigator undefined');
  }
  
  return false;
}

/**
 * Check if haptics are available in current environment
 * @returns {Promise<boolean>}
 */
export async function isHapticsAvailable() {
  // Check browser Vibration API
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    return true;
  }
  
  // Check Farcaster SDK
  try {
    const capabilities = await sdk.getCapabilities();
    return capabilities.some(cap => cap.startsWith('haptics.'));
  } catch {
    return false;
  }
}

/**
 * Convenience functions for common haptic patterns
 */
export const haptics = {
  light: (isInMiniApp) => triggerHaptic('light', isInMiniApp),
  medium: (isInMiniApp) => triggerHaptic('medium', isInMiniApp),
  heavy: (isInMiniApp) => triggerHaptic('heavy', isInMiniApp),
  success: (isInMiniApp) => triggerHaptic('success', isInMiniApp),
  warning: (isInMiniApp) => triggerHaptic('warning', isInMiniApp),
  error: (isInMiniApp) => triggerHaptic('error', isInMiniApp),
  selection: (isInMiniApp) => triggerHaptic('selectionChanged', isInMiniApp),
};

