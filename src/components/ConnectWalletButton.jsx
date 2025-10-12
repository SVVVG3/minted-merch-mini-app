'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useState } from 'react';

/**
 * Connect Wallet button for header
 * Shows for non-mini-app users who need to connect a wallet for checkout and check-ins
 */
export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [showModal, setShowModal] = useState(false);

  const handleConnect = () => {
    setShowModal(true);
  };

  const handleConnectorClick = (connector) => {
    connect({ connector });
    setShowModal(false);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  if (isConnected && address) {
    return (
      <button
        onClick={handleDisconnect}
        className="flex items-center justify-center h-12 px-3 bg-green-600 hover:bg-green-700 text-white font-medium text-xs rounded-lg transition-colors"
        title={`Connected: ${address.slice(0, 6)}...${address.slice(-4)}`}
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="hidden sm:inline">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleConnect}
        className="flex items-center justify-center h-12 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors"
        title="Connect Wallet"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <span className="hidden sm:inline">Wallet</span>
      </button>

      {/* Wallet Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => setShowModal(false)}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Connect Wallet
              </h3>
              <p className="text-sm text-gray-600">
                Choose a wallet to connect for checkout and daily check-ins
              </p>
            </div>
            
            {/* Wallet Options */}
            <div className="space-y-3">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => handleConnectorClick(connector)}
                  disabled={!connector.ready}
                  className="w-full flex items-center justify-between px-4 py-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-medium text-gray-900">{connector.name}</span>
                  {!connector.ready && <span className="text-xs text-gray-500">(Not installed)</span>}
                </button>
              ))}
            </div>

            <div className="mt-4 text-center text-xs text-gray-500">
              By connecting a wallet, you agree to our Terms of Service
            </div>
          </div>
        </div>
      )}
    </>
  );
}

