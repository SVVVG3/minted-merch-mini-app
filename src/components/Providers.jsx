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
        <BaseAccountProvider>
          <WalletConnectProvider>
            <DaimoPayProvider>
              <CartProvider>
                {children}
              </CartProvider>
            </DaimoPayProvider>
          </WalletConnectProvider>
        </BaseAccountProvider>
      </WagmiProvider>
    </AuthKitProvider>
  );
}

