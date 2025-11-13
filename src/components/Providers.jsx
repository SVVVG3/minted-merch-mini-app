'use client';

import { WagmiProvider } from '@/components/WagmiProvider';
import { BaseAccountProvider } from '@/components/BaseAccountProvider';
import { AuthKitProvider } from '@/components/AuthKitProvider';
import { WalletConnectProvider } from '@/components/WalletConnectProvider';
import { DaimoPayProvider } from '@/components/DaimoPayProvider';
import { ThirdwebProvider } from '@/components/ThirdwebProvider';
import { CartProvider } from '@/lib/CartContext';

export function Providers({ children }) {
  return (
    <AuthKitProvider>
      <WagmiProvider>
        <BaseAccountProvider>
          <WalletConnectProvider>
            <DaimoPayProvider>
              <ThirdwebProvider>
                <CartProvider>
                  {children}
                </CartProvider>
              </ThirdwebProvider>
            </DaimoPayProvider>
          </WalletConnectProvider>
        </BaseAccountProvider>
      </WagmiProvider>
    </AuthKitProvider>
  );
}

