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

  // Handle coin mini app click
  const handleCoinClick = async () => {
    // Add haptic feedback for coin link selection
    try {
      const capabilities = await sdk.getCapabilities();
      if (capabilities.includes('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
      }
    } catch (error) {
      // Haptics not available, continue without feedback
      console.log('Haptics not available:', error);
    }
    
    try {
      await sdk.actions.openMiniApp({
        url: 'https://coin.mintedmerch.shop/'
      });
      console.log('Coin mini app opened successfully - current app will close');
    } catch (error) {
      console.error('Failed to open coin mini app:', error);
    }
  };

  return (
    <div className="bg-[#3eb489] text-white px-4 py-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="text-center">
          <div className="space-y-0.5">
            <div>
              Hold 1M+ {' '}
              <button 
                onClick={handleCoinClick}
                className="underline hover:text-green-200 transition-colors font-medium"
              >
                $mintedmerch
              </button>
              {' '}to qualify for random raffles!
            </div>
            <div>
              Hold 50M+ to become a Merch Mogul 🤌
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}