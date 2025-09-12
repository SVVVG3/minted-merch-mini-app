'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';

export function MiniAppNotificationPrompt({ onClose, orderNumber }) {
  const { isReady, user, getFid } = useFarcaster();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Use Farcaster Frame SDK directly (Alternative approach from Neynar docs)
  const handleAddMiniApp = async () => {
    if (!isReady || !window.sdk) {
      console.warn('Farcaster SDK not ready');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Attempting to add Mini App using Farcaster SDK...');
      
      // Use the Farcaster Frame SDK's addFrame method (as per Neynar docs alternative)
      const addResult = await window.sdk.actions.addFrame();
      console.log('Add Mini App result:', addResult);
      
      setResult({ 
        added: addResult.added || false, 
        notificationDetails: addResult.notificationDetails || null 
      });
      
      // If successfully added with notifications, send welcome notification
      if (addResult.added && addResult.notificationDetails) {
        const userFid = getFid();
        if (userFid) {
          try {
            console.log('Sending welcome notification to FID:', userFid);
            const response = await fetch('/api/send-welcome-notification', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ userFid }),
            });
            
            const welcomeResult = await response.json();
            console.log('Welcome notification result:', welcomeResult);
          } catch (error) {
            console.error('Error sending welcome notification:', error);
          }
        }
        
        // Close after a brief delay to show success
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    } catch (error) {
      console.error('Error adding Mini App:', error);
      setResult({ added: false, reason: 'error', error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if we're in a Farcaster environment
  if (!isReady) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl drop-shadow-2xl max-w-md w-full p-6">
        <div className="text-center">
          {/* Success Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            🎉 Order {orderNumber} Confirmed!
          </h3>

          {/* Main Message */}
          <p className="text-sm text-gray-600 mb-6">
            Want to stay updated on your order? Add our Mini App to get notifications when your order ships!
          </p>

          {/* Result Display */}
          {result && (
            <div className="mb-4 p-3 rounded-lg">
              {result.added ? (
                <div className="bg-green-50 text-green-800">
                  <div className="flex items-center justify-center mb-2">
                    <svg className="h-5 w-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span className="font-medium">Mini App Added!</span>
                  </div>
                  {result.notificationDetails ? (
                    <p className="text-sm">✅ Notifications enabled - you'll get updates on your order!</p>
                  ) : (
                    <p className="text-sm">📱 Mini App added successfully!</p>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 text-yellow-800">
                  <p className="text-sm">
                    {result.reason === 'rejected_by_user' 
                      ? "No worries! You can always add the Mini App later from your Farcaster client."
                      : result.reason === 'invalid_domain_manifest'
                      ? "There was a technical issue. Please try again later."
                      : result.error || "Unable to add Mini App right now."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!result && (
              <button
                onClick={handleAddMiniApp}
                disabled={isLoading || !isReady}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </span>
                ) : (
                  '📱 Add Mini App & Enable Notifications'
                )}
              </button>
            )}
            
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              {result?.added ? 'Continue Shopping' : 'Maybe Later'}
            </button>
          </div>

          {/* Help Text */}
          {!result && (
            <p className="text-xs text-gray-500 mt-4">
              You'll get notifications when your order ships with tracking info 📦
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 