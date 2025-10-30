'use client';

import dynamic from 'next/dynamic';
import { WagmiProvider } from '@/components/WagmiProvider';
import { BaseAccountProvider } from '@/components/BaseAccountProvider';
import { AuthKitProvider } from '@/components/AuthKitProvider';
import { CartProvider } from '@/lib/CartContext';

// Dynamic import to prevent SSR issues with wagmi hooks
const WalletConnectProvider = dynamic(
  () => import('@/components/WalletConnectProvider').then(mod => mod.WalletConnectProvider),
  { ssr: false }
);

export function Providers({ children }) {
  return (
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
  );
}

