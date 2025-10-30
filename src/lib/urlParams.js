/**
 * URL Parameter Detection Utility
 * Handles detection of notification clicks and discount code extraction
 */

import { useState, useEffect } from 'react';

/**
 * Extract URL parameters for notification detection
 * Supports both discount codes and general notification sources
 */
export function extractNotificationParams() {
  // Only run on client side
  if (typeof window === 'undefined') {
    return { hasNotificationParams: false };
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    
    // Check for discount code in URL parameter
    const discountParam = urlParams.get('discount');
    
    // Check for general notification source
    const fromParam = urlParams.get('from');
    
    // Check for referrer information
    const referrer = document.referrer;
    
    // Check for Farcaster-specific context
    const isFarcasterReferrer = referrer.includes('warpcast.com') || 
                               referrer.includes('farcaster.xyz') ||
                               referrer.includes('frame');
    
    const result = {
      hasNotificationParams: !!(discountParam || fromParam === 'notification'),
      discountCode: discountParam || null,
      notificationSource: fromParam || null,
      referrer: referrer || null,
      isFarcasterReferrer,
      timestamp: new Date().toISOString(),
      fullUrl: window.location.href,
      urlParams: Object.fromEntries(urlParams.entries()),
      hash: hash || null
    };

    console.log('🔍 URL Parameter Analysis:', result);
    return result;
    
  } catch (error) {
    console.error('Error extracting notification parameters:', error);
    return { 
      hasNotificationParams: false, 
      error: error.message 
    };
  }
}

/**
 * Store notification context in session storage for later use
 * This persists the context even if URL changes during app navigation
 */
export function storeNotificationContext(params) {
  if (typeof window === 'undefined' || !params.hasNotificationParams) {
    return false;
  }

  try {
    const context = {
      ...params,
      storedAt: new Date().toISOString(),
      sessionId: generateSessionId()
    };

    // Store in sessionStorage (persists until tab closes)
    sessionStorage.setItem('notification_context', JSON.stringify(context));
    
    // Also store a flag in localStorage for longer-term detection
    if (params.discountCode) {
      localStorage.setItem('pending_discount_code', params.discountCode);
      localStorage.setItem('pending_discount_timestamp', context.storedAt);
    }

    console.log('💾 Notification context stored:', context);
    return true;
    
  } catch (error) {
    console.error('Error storing notification context:', error);
    return false;
  }
}

/**
 * Retrieve stored notification context
 */
export function getStoredNotificationContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = sessionStorage.getItem('notification_context');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error retrieving notification context:', error);
    return null;
  }
}

/**
 * Check for pending discount code from localStorage
 * This handles cases where the discount should persist across sessions
 */
export function getPendingDiscountCode() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const discountCode = localStorage.getItem('pending_discount_code');
    const timestamp = localStorage.getItem('pending_discount_timestamp');
    
    if (!discountCode || !timestamp) {
      return null;
    }

    // Check if the pending discount is still fresh (within 24 hours)
    const storedTime = new Date(timestamp);
    const now = new Date();
    const hoursAgo = (now - storedTime) / (1000 * 60 * 60);
    
    if (hoursAgo > 24) {
      // Clean up old pending discount
      localStorage.removeItem('pending_discount_code');
      localStorage.removeItem('pending_discount_timestamp');
      return null;
    }

    return {
      discountCode,
      timestamp,
      hoursAgo: Math.round(hoursAgo * 10) / 10
    };
    
  } catch (error) {
    console.error('Error getting pending discount code:', error);
    return null;
  }
}

/**
 * Clear notification context after it's been processed
 */
export function clearNotificationContext() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem('notification_context');
    // Keep pending discount code in localStorage until it's used
    console.log('🧹 Notification context cleared from session');
  } catch (error) {
    console.error('Error clearing notification context:', error);
  }
}

/**
 * Clear pending discount code (call after discount is applied)
 */
export function clearPendingDiscountCode() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem('pending_discount_code');
    localStorage.removeItem('pending_discount_timestamp');
    console.log('🧹 Pending discount code cleared');
  } catch (error) {
    console.error('Error clearing pending discount code:', error);
  }
}

/**
 * Generate a simple session ID for tracking
 */
function generateSessionId() {
  return 'session_' + Math.random().toString(36).substring(2) + '_' + Date.now();
}

/**
 * React hook for URL parameter detection
 * Use this in components to detect notification arrivals
 */
export function useNotificationDetection() {
  if (typeof window === 'undefined') {
    return { 
      hasNotificationParams: false,
      isLoading: true
    };
  }

  const [detection, setDetection] = useState({
    hasNotificationParams: false,
    isLoading: true
  });

  useEffect(() => {
    // Extract parameters on component mount
    const params = extractNotificationParams();
    
    // Store context if notification parameters are found
    if (params.hasNotificationParams) {
      storeNotificationContext(params);
    }

    setDetection({
      ...params,
      isLoading: false
    });
  }, []);

  return detection;
} 