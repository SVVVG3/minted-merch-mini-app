'use client';

import { useState, useEffect } from 'react'
import { WagmiProvider as WagmiProviderCore } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/lib/wagmi'

// Create a client
const queryClient = new QueryClient()

export function WagmiProvider({ children }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Small delay to ensure Farcaster SDK is initialized first
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Don't render Wagmi until we're ready
  if (!isReady) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  return (
    <WagmiProviderCore config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProviderCore>
  )
} 