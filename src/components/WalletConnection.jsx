'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { isDesktopBrowser, isMobileFarcasterClient } from '@/lib/environmentDetection'

export function WalletConnection() {
  const { isConnected, address } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-green-800">Wallet Connected</h3>
            <p className="text-xs text-green-600 font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <button
            onClick={() => disconnect()}
            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  // Get environment-specific instructions
  const getWalletInstructions = () => {
    if (isDesktopBrowser()) {
      return {
        title: 'Connect External Wallet',
        description: 'Desktop browsers require MetaMask, Coinbase Wallet, or similar extension',
        note: 'For best experience, try opening this app on mobile through Farcaster'
      };
    } else if (isMobileFarcasterClient()) {
      return {
        title: 'Connect Your Wallet',
        description: 'Connect your wallet to pay with USDC on Base',
        note: null
      };
    } else {
      return {
        title: 'Connect Your Wallet',
        description: 'Connect your wallet to pay with USDC on Base',
        note: null
      };
    }
  };

  const instructions = getWalletInstructions();

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="text-center">
        <h3 className="text-sm font-medium text-blue-800 mb-2">{instructions.title}</h3>
        <p className="text-xs text-blue-600 mb-3">
          {instructions.description}
        </p>
        {instructions.note && (
          <p className="text-xs text-amber-600 mb-3 italic">
            💡 {instructions.note}
          </p>
        )}
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            disabled={isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mr-2 mb-2"
          >
            {isPending ? 'Connecting...' : `Connect ${connector.name || 'Wallet'}`}
          </button>
        ))}
      </div>
    </div>
  )
} 