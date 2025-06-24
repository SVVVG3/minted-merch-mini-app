'use client';

import { WagmiProvider as WagmiProviderCore, createConfig } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/lib/wagmi'

// Create a client
const queryClient = new QueryClient()

export function WagmiProvider({ children }) {
  return (
    <WagmiProviderCore config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProviderCore>
  )
} 