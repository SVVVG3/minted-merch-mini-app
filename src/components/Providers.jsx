'use client';

import { WagmiProvider } from '@/components/WagmiProvider';
import { BaseAccountProvider } from '@/components/BaseAccountProvider';
import { AuthKitProvider } from '@/components/AuthKitProvider';
import { WalletConnectProvider } from '@/components/WalletConnectProvider';
import { DaimoPayProvider } from '@/components/DaimoPayProvider';
import { CartProvider } from '@/lib/CartContext';

export function Providers({ children }) {
  return (
    <AuthKitProvider>
      <WagmiProvider>
        <DaimoPayProvider>
          <BaseAccountProvider>
            <WalletConnectProvider>
              <CartProvider>
                {children}
              </CartProvider>
            </WalletConnectProvider>
          </BaseAccountProvider>
        </DaimoPayProvider>
      </WagmiProvider>
    </AuthKitProvider>
  );
}

