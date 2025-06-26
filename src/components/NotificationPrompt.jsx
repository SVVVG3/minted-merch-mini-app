'use client';

import { useState } from 'react';

export function NotificationPrompt({ userFid, onNotificationEnabled, onDismiss }) {
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState(null);

  const handleEnableNotifications = async () => {
    setIsEnabling(true);
    setError(null);

    try {
      console.log('Enabling notifications for user FID:', userFid);
      
      // In a real implementation, this would trigger the Farcaster Mini App notification permission flow
      // For now, we'll simulate it by creating a notification token
      const notificationToken = {
        token: `enabled_token_${userFid}_${Date.now()}`,
        url: 'https://api.farcaster.xyz/v1/frame-notifications'
      };

      // Call our registration endpoint to store the notification token
      const response = await fetch('/api/register-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userFid,
          userData: {
            username: `user_${userFid}`,
            displayName: null,
            bio: null,
            pfpUrl: null
          },
          notificationToken
        }),
      });

      const result = await response.json();
      console.log('Notification enablement result:', result);

      if (result.success) {
        console.log('✅ Notifications enabled successfully!');
        onNotificationEnabled(result);
      } else {
        throw new Error(result.error || 'Failed to enable notifications');
      }

    } catch (error) {
      console.error('Error enabling notifications:', error);
      setError(error.message);
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM11 3h8v8l-8-8zM3 12l9-9v6h6v6H9l-6 6V12z" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900 mb-1">
            Get notified about your orders! 📦
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Enable notifications to receive updates about order confirmations, shipping, and exclusive offers.
          </p>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleEnableNotifications}
              disabled={isEnabling}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors flex items-center space-x-2"
            >
              {isEnabling ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Enabling...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                  </svg>
                  <span>Enable Notifications</span>
                </>
              )}
            </button>
            
            <button
              onClick={onDismiss}
              disabled={isEnabling}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium px-3 py-2 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
        
        <button
          onClick={onDismiss}
          disabled={isEnabling}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
} 