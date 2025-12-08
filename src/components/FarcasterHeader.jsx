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

  // Handle staking link click with haptics
  const handleStakingClick = async (e) => {
    e.preventDefault();
    try {
      const capabilities = await sdk.getCapabilities();
      if (capabilities.includes('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
      }
    } catch (error) {
      console.log('Haptics not available:', error);
    }
    window.location.href = '/stake';
  };

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
      // Get SDK context to check platform type
      const context = await sdk.context;
      const platformType = context?.client?.platformType;
      
      console.log('📱 $mintedmerch link - Platform type:', platformType);
      
      if (platformType === 'mobile' && sdk?.actions?.openUrl) {
        // Mobile Farcaster app - use openUrl (stays in app)
        console.log('📱 Using openUrl for mobile');
        await sdk.actions.openUrl('https://coin.mintedmerch.shop/');
      } else if (sdk?.actions?.openMiniApp) {
        // Desktop/web Farcaster - use openMiniApp
        console.log('💻 Using openMiniApp for desktop/web');
        await sdk.actions.openMiniApp({
          url: 'https://coin.mintedmerch.shop/'
        });
      }
    } catch (error) {
      console.error('Failed to open coin mini app:', error);
    }
  };

  return (
    <div className="bg-[#3eb489] text-white px-4 py-2 text-xs">
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="space-y-0.5">
            <div>
              Shop using 1200+ coins across 20+ chains!{' '}
              <button onClick={handleStakingClick} className="underline font-bold hover:text-yellow-200 transition-colors">Staking is LIVE</button>
            </div>
            <div>
              Stake 50M+ {' '}
              <button 
                onClick={handleCoinClick}
                className="underline hover:text-green-200 transition-colors font-medium"
              >
                $mintedmerch
              </button>
              {' '}to become a Merch Mogul 🤌
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}