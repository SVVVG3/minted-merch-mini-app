'use client';

import { useState, useEffect } from 'react';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { useWalletConnectContext } from '@/components/WalletConnectProvider';

export default function WalletTestPage() {
  const { 
    isInitialized, 
    isConnected, 
    userAddress, 
    connectionMethod, 
    canConnect, 
    needsConnection 
  } = useWalletConnectContext();

  const [deviceInfo, setDeviceInfo] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState([]);

  // Detect device info on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator?.userAgent || '';
      const isDgen1 = userAgent.toLowerCase().includes('android') && 
                     (window.ethereum?.isDgen === true || 
                      window.ethereum?.isEthereumPhone === true ||
                      /dgen1/i.test(userAgent) ||
                      /ethereumphone/i.test(userAgent));
      
      setDeviceInfo({
        userAgent,
        hasEthereum: !!window.ethereum,
        ethereumIsDgen: window.ethereum?.isDgen,
        ethereumIsEthereumPhone: window.ethereum?.isEthereumPhone,
        isDgen1Detected: isDgen1,
        isAndroid: /android/i.test(userAgent),
        isIOS: /iphone|ipad|ipod/i.test(userAgent),
        isWarpcast: userAgent.toLowerCase().includes('warpcast'),
        isFarcaster: userAgent.toLowerCase().includes('farcaster'),
        windowLocation: window.location.href,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      });
    }
  }, []);

  const attemptManualConnection = async () => {
    const log = (message, data = null) => {
      const entry = { timestamp: new Date().toISOString(), message, data };
      console.log(message, data);
      setConnectionAttempts(prev => [...prev, entry]);
    };

    log('🔗 Manual connection attempt started');
    
    try {
      if (!window.ethereum) {
        log('❌ No window.ethereum found');
        return;
      }

      log('✅ window.ethereum found', {
        isDgen: window.ethereum.isDgen,
        isEthereumPhone: window.ethereum.isEthereumPhone,
      });

      log('📤 Requesting accounts via eth_requestAccounts...');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      log('📥 Accounts received', accounts);
      
      if (accounts && accounts.length > 0) {
        if (accounts[0] === 'decline') {
          log('❌ Connection declined by user');
        } else {
          log('✅ Connection successful!', { address: accounts[0] });
        }
      } else {
        log('❌ No accounts returned');
      }
    } catch (error) {
      log('❌ Connection error', { message: error.message, code: error.code });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🔍 Wallet Connection Debug Page
        </h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Connection Status */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Initialized:</span>
                <span className={isInitialized ? 'text-green-600' : 'text-red-600'}>
                  {isInitialized ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Connected:</span>
                <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                  {isConnected ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Method:</span>
                <span className="text-gray-900">
                  {connectionMethod || 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Address:</span>
                <span className="text-gray-900 font-mono text-sm">
                  {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Can Connect:</span>
                <span className={canConnect ? 'text-green-600' : 'text-red-600'}>
                  {canConnect ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Needs Connection:</span>
                <span className={needsConnection ? 'text-yellow-600' : 'text-green-600'}>
                  {needsConnection ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Device Info */}
          <div className="bg-white p-6 rounded-lg shadow-sm border md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Device Information</h2>
            {deviceInfo && (
              <div className="space-y-2 text-sm font-mono">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-gray-600">dGEN1 Detected:</div>
                  <div className={deviceInfo.isDgen1Detected ? 'text-green-600 font-bold' : 'text-red-600'}>
                    {deviceInfo.isDgen1Detected ? 'YES ✅' : 'NO ❌'}
                  </div>
                  
                  <div className="text-gray-600">Has window.ethereum:</div>
                  <div className={deviceInfo.hasEthereum ? 'text-green-600' : 'text-red-600'}>
                    {deviceInfo.hasEthereum ? 'YES' : 'NO'}
                  </div>
                  
                  <div className="text-gray-600">ethereum.isDgen:</div>
                  <div>{String(deviceInfo.ethereumIsDgen)}</div>
                  
                  <div className="text-gray-600">ethereum.isEthereumPhone:</div>
                  <div>{String(deviceInfo.ethereumIsEthereumPhone)}</div>
                  
                  <div className="text-gray-600">Android:</div>
                  <div>{deviceInfo.isAndroid ? 'YES' : 'NO'}</div>
                  
                  <div className="text-gray-600">iOS:</div>
                  <div>{deviceInfo.isIOS ? 'YES' : 'NO'}</div>
                  
                  <div className="text-gray-600">Warpcast:</div>
                  <div>{deviceInfo.isWarpcast ? 'YES' : 'NO'}</div>
                  
                  <div className="text-gray-600">Farcaster:</div>
                  <div>{deviceInfo.isFarcaster ? 'YES' : 'NO'}</div>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="text-gray-600 mb-2">User Agent:</div>
                  <div className="text-xs break-all bg-gray-50 p-2 rounded">
                    {deviceInfo.userAgent}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Manual Connection Button */}
          <div className="bg-white p-6 rounded-lg shadow-sm border md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Manual Connection Test</h2>
            <button
              onClick={attemptManualConnection}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              🔗 Test eth_requestAccounts
            </button>
            
            {connectionAttempts.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Connection Log:</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {connectionAttempts.map((attempt, index) => (
                    <div key={index} className="text-sm bg-gray-50 p-3 rounded border">
                      <div className="font-semibold text-gray-900">{attempt.message}</div>
                      {attempt.data && (
                        <pre className="mt-1 text-xs text-gray-600 overflow-x-auto">
                          {JSON.stringify(attempt.data, null, 2)}
                        </pre>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(attempt.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Wallet Connect Button */}
          <div className="bg-white p-6 rounded-lg shadow-sm border md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Standard Wallet Connection</h2>
            <div className="space-y-4">
              <WalletConnectButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
