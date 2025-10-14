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

  const vibrateAvailable = typeof navigator !== 'undefined' && navigator.vibrate;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-2">Haptics Test</h1>
        <p className="text-sm text-gray-600 mb-6">
          Test haptic feedback on your device. Watch for toast messages showing which API is used.
        </p>

        {/* Warning Banner if Vibrate API not available */}
        {!vibrateAvailable && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-red-900 mb-2">⚠️ Vibrate API Not Detected</h3>
            <p className="text-sm text-red-800 mb-2">
              Your browser doesn't support the Web Vibration API. Haptics won't work until this is enabled.
            </p>
            <p className="text-xs text-red-700">
              See troubleshooting section below for solutions.
            </p>
          </div>
        )}

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
            <p className="break-all">User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
            <p className={typeof navigator !== 'undefined' && navigator.vibrate ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
              Vibrate API: {typeof navigator !== 'undefined' && navigator.vibrate ? '✅ Available' : '❌ Not Available'}
            </p>
            <p>Platform: {typeof navigator !== 'undefined' ? navigator.platform : 'N/A'}</p>
            <p>Navigator.vibrate type: {typeof navigator !== 'undefined' ? typeof navigator.vibrate : 'N/A'}</p>
            <p>Is Secure Context: {typeof window !== 'undefined' && window.isSecureContext ? '✅ Yes (HTTPS)' : '❌ No'}</p>
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
          <h3 className="font-semibold text-yellow-900 mb-2">Troubleshooting - Vibrate API Not Available</h3>
          <div className="text-sm text-yellow-800 space-y-3">
            <p className="font-semibold">If Vibrate API shows "Not Available":</p>
            
            <div>
              <p className="font-medium mb-1">1. Enable vibration in Firefox:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Type <code className="bg-yellow-100 px-1 rounded">about:config</code> in address bar</li>
                <li>Search for: <code className="bg-yellow-100 px-1 rounded">dom.vibrator.enabled</code></li>
                <li>Make sure it's set to <strong>true</strong></li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium mb-1">2. Check system settings:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Go to ethOS Settings → Sound & Vibration</li>
                <li>Ensure vibration is enabled</li>
                <li>Disable "Do Not Disturb" mode if active</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium mb-1">3. Try a different browser:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Chrome/Brave typically have better vibration support</li>
                <li>Check if dGEN1 has other browsers available</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium">4. Site must use HTTPS (secure context)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

