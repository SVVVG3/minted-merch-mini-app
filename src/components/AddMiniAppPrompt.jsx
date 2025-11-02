'use client';

import { useState } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { haptics } from '@/lib/haptics';

/**
 * Prompt to encourage users to add the mini app and enable notifications
 * Shows after completing daily spin
 */
export function AddMiniAppPrompt({ isOpen, onClose }) {
  const { isReady, user, getFid } = useFarcaster();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Check if we're in a Mini App context
  const isInMiniApp = user && !user.isAuthKit;

  const handleAddMiniApp = async () => {
    if (!isReady || !window.sdk) {
      console.warn('Farcaster SDK not ready');
      return;
    }

    setIsLoading(true);
    
    // Add haptic feedback
    await haptics.light(isInMiniApp);

    try {
      console.log('🎯 Attempting to add Mini App using sdk.actions.addMiniApp()...');
      
      // Use the official addMiniApp() method from Farcaster SDK
      await window.sdk.actions.addMiniApp();
      
      console.log('✅ Add Mini App prompt shown to user');
      
      setResult({ 
        success: true,
        message: 'Mini App added successfully! You\'ll now receive daily check-in reminders.' 
      });
      
      // Success haptic
      await haptics.success(isInMiniApp);
      
      // Send welcome notification
      const userFid = getFid();
      if (userFid) {
        try {
          console.log('📨 Sending welcome notification to FID:', userFid);
          const response = await fetch('/api/send-welcome-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userFid }),
          });
          
          const welcomeResult = await response.json();
          console.log('✅ Welcome notification sent:', welcomeResult);
        } catch (error) {
          console.error('❌ Error sending welcome notification:', error);
        }
      }
      
      // Close after showing success message briefly
      setTimeout(() => {
        onClose();
      }, 2500);
      
    } catch (error) {
      console.error('❌ Error adding Mini App:', error);
      
      // Handle specific error types from Farcaster SDK
      if (error.message?.includes('RejectedByUser')) {
        setResult({ 
          success: false,
          message: 'No worries! You can add the Mini App anytime to get daily reminders.' 
        });
      } else if (error.message?.includes('InvalidDomainManifestJson')) {
        setResult({ 
          success: false,
          message: 'Technical issue detected. Please try again later.' 
        });
      } else {
        setResult({ 
          success: false,
          message: 'Unable to add Mini App right now. Please try again later.' 
        });
      }
      
      // Error haptic
      await haptics.error(isInMiniApp);
      
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaybeLater = async () => {
    await haptics.light(isInMiniApp);
    onClose();
  };

  // Don't show if not in mini app context
  if (!isInMiniApp || !isReady || !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={result ? onClose : undefined}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 mb-4">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            🎉 Nice Spin!
          </h3>

          {/* Message */}
          {!result ? (
            <>
              <p className="text-base text-gray-700 mb-2 font-medium">
                Never miss your daily spin!
              </p>
              <p className="text-sm text-gray-600 mb-6">
                Add our Mini App to get daily reminders at 8 AM PST to keep your streak alive 🔥
              </p>
            </>
          ) : (
            <div className={`mb-4 p-4 rounded-lg ${result.success ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <div className="flex items-center justify-center mb-2">
                {result.success ? (
                  <svg className="h-6 w-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                )}
              </div>
              <p className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-yellow-800'}`}>
                {result.message}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {!result && (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAddMiniApp}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </span>
                ) : (
                  '🔔 Add Mini App & Get Daily Reminders'
                )}
              </button>
              
              <button
                onClick={handleMaybeLater}
                className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          )}

          {result && (
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
            >
              Continue
            </button>
          )}

          {/* Help Text */}
          {!result && (
            <p className="text-xs text-gray-500 mt-4">
              💡 You can always add the Mini App later from your profile
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

