'use client';

import { useWalletConnectContext } from './WalletConnectProvider';

export function CompactWalletStatus() {
  const { userAddress, disconnectWallet } = useWalletConnectContext();

  if (!userAddress) {
    return null;
  }

  const truncatedAddress = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;

  return (
    <div className="flex items-center space-x-1 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs">
      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
      <span className="text-green-700 font-medium">{truncatedAddress}</span>
      <button
        onClick={disconnectWallet}
        className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
      >
        ×
      </button>
    </div>
  );
}
