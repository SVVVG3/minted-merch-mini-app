'use client';

import { WagmiProvider } from '@/components/WagmiProvider';
import { BaseAccountProvider } from '@/components/BaseAccountProvider';
import { AuthKitProvider } from '@/components/AuthKitProvider';
import { WalletConnectProvider } from '@/components/WalletConnectProvider';
import { CartProvider } from '@/lib/CartContext';
import { MiniAppProvider } from '@neynar/react';

export function Providers({ children }) {
  return (
    <MiniAppProvider>
      <AuthKitProvider>
        <WagmiProvider>
          <BaseAccountProvider>
            <WalletConnectProvider>
              <CartProvider>
                {children}
              </CartProvider>
            </WalletConnectProvider>
          </BaseAccountProvider>
        </WagmiProvider>
      </AuthKitProvider>
    </MiniAppProvider>
  );
}

