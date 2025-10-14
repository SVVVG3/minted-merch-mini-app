'use client';

import { useState } from 'react';
import { triggerHaptic } from '@/lib/haptics';

/**
 * Haptics Test Page for Mobile Debugging
 * Visit this page on your dGEN1 device to test haptic feedback
 * Visual feedback shows which API is being used
 */
export default function TestHapticsPage() {
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [lastResult, setLastResult] = useState(null);

  const testHaptic = async (type) => {
    const result = await triggerHaptic(type, isInMiniApp, showDebug);
    setLastResult({ type, result, timestamp: new Date().toLocaleTimeString() });
  };

  const hapticTypes = [
    { type: 'light', label: 'Light', color: 'bg-blue-500' },
    { type: 'medium', label: 'Medium', color: 'bg-blue-600' },
    { type: 'heavy', label: 'Heavy', color: 'bg-blue-700' },
    { type: 'success', label: 'Success', color: 'bg-green-500' },
    { type: 'warning', label: 'Warning', color: 'bg-yellow-500' },
    { type: 'error', label: 'Error', color: 'bg-red-500' },
    { type: 'selectionChanged', label: 'Selection', color: 'bg-purple-500' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-2">Haptics Test</h1>
        <p className="text-sm text-gray-600 mb-6">
          Test haptic feedback on your device. Watch for toast messages showing which API is used.
        </p>

        {/* Settings */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow">
          <h2 className="font-semibold mb-3">Settings</h2>
          
          <label className="flex items-center justify-between mb-3">
            <span className="text-sm">Show Debug Toasts</span>
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(e) => setShowDebug(e.target.checked)}
              className="w-5 h-5"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm">Mini App Mode</span>
            <input
              type="checkbox"
              checked={isInMiniApp}
              onChange={(e) => setIsInMiniApp(e.target.checked)}
              className="w-5 h-5"
            />
          </label>
        </div>

        {/* Device Info */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow">
          <h2 className="font-semibold mb-2">Device Info</h2>
          <div className="text-xs space-y-1">
            <p>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) + '...' : 'N/A'}</p>
            <p>Vibrate API: {typeof navigator !== 'undefined' && navigator.vibrate ? '✅ Available' : '❌ Not Available'}</p>
            <p>Platform: {typeof navigator !== 'undefined' ? navigator.platform : 'N/A'}</p>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow">
          <h2 className="font-semibold mb-3">Test Haptics</h2>
          <div className="grid grid-cols-2 gap-3">
            {hapticTypes.map(({ type, label, color }) => (
              <button
                key={type}
                onClick={() => testHaptic(type)}
                className={`${color} text-white font-semibold py-3 px-4 rounded-lg active:scale-95 transition-transform`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Last Result */}
        {lastResult && (
          <div className="bg-white rounded-lg p-4 shadow">
            <h2 className="font-semibold mb-2">Last Test Result</h2>
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Type:</span> {lastResult.type}</p>
              <p><span className="font-medium">Result:</span> {lastResult.result ? '✅ Success' : '❌ Failed'}</p>
              <p><span className="font-medium">Time:</span> {lastResult.timestamp}</p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">How to Use</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Tap any button above to test haptic feedback</li>
            <li>Watch for colored toast messages in top-right corner</li>
            <li>Green toast = haptic worked successfully</li>
            <li>Red toast = haptic failed or not available</li>
            <li>Check which API is being used (Capacitor, Farcaster, or Web Vibrate)</li>
          </ol>
        </div>

        {/* Troubleshooting */}
        <div className="mt-6 bg-yellow-50 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">Troubleshooting</h3>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            <li>Ensure device vibration is enabled in system settings</li>
            <li>Haptics require a user gesture (button tap) to work</li>
            <li>Firefox on Android should support Web Vibration API</li>
            <li>If no toast appears, JavaScript may be blocked</li>
            <li>Try different haptic types - some may work better than others</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

