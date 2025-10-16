'use client';

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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          WalletConnect Test Page
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

          {/* Wallet Connect Button */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Wallet Connection</h2>
            <div className="space-y-4">
              <WalletConnectButton />
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white p-6 rounded-lg shadow-sm border md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Testing Instructions</h2>
            <div className="space-y-3 text-gray-700">
              <p>
                <strong>Desktop/Mobile Web:</strong> You should see a "Connect Wallet" button that opens WalletConnect.
              </p>
              <p>
                <strong>Farcaster Mini App:</strong> WalletConnect should be disabled and you should see existing wallet connection.
              </p>
              <p>
                <strong>Browser with Wallet Extension:</strong> Should connect to existing wallet or show WalletConnect as fallback.
              </p>
              <p>
                <strong>Environment Variables:</strong> Make sure <code className="bg-gray-100 px-2 py-1 rounded">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> is set for WalletConnect to work.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
