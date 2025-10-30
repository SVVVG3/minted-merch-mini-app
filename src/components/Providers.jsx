'use client';

import { WagmiProvider } from '@/components/WagmiProvider';
import { BaseAccountProvider } from '@/components/BaseAccountProvider';
import { AuthKitProvider } from '@/components/AuthKitProvider';
import { WalletConnectProvider } from '@/components/WalletConnectProvider';
import { WagmiWalletConnectBridge } from '@/components/WagmiWalletConnectBridge';
import { CartProvider } from '@/lib/CartContext';

export function Providers({ children }) {
  return (
    <AuthKitProvider>
      <WagmiProvider>
        {/* Bridge component to auto-connect Farcaster wallet to wagmi */}
        <WagmiWalletConnectBridge />
        <BaseAccountProvider>
          <WalletConnectProvider>
            <CartProvider>
              {children}
            </CartProvider>
          </WalletConnectProvider>
        </BaseAccountProvider>
      </WagmiProvider>
    </AuthKitProvider>
  );
}

