'use client';

import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/miniapp-sdk';

export function FarcasterHeader() {
  const { user, isLoading, isInFarcaster } = useFarcaster();

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  // Don't render if not in Farcaster context
  if (!isInFarcaster || !user) {
    return null;
  }

  // Handle swap token click
  const handleSwapClick = async () => {
    try {
      const result = await sdk.actions.swapToken({
        buyToken: 'eip155:8453/erc20:0x774EAeFE73Df7959496Ac92a77279A8D7d690b07', // $mintedmerch token on Base
        sellToken: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
      });
      
      if (result.success) {
        console.log('Swap completed:', result.swap);
      } else {
        console.log('Swap failed or cancelled:', result.reason);
      }
    } catch (error) {
      console.error('Error opening swap:', error);
    }
  };

  return (
    <div className="bg-[#3eb489] text-white px-4 py-2 text-sm">
      <div className="flex items-center justify-center">
        <div className="flex items-center space-x-2">
          {user.pfpUrl && (
            <img 
              src={user.pfpUrl} 
              alt={user.displayName || user.username}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span>
            Hey, {user.displayName || user.username} - {' '}
            <button 
              onClick={handleSwapClick}
              className="underline hover:text-green-200 transition-colors font-medium"
            >
              $mintedmerch
            </button>
            {' '}is LIVE
          </span>
        </div>
      </div>
    </div>
  );
} 