'use client';

import { useEffect, useState } from 'react';

/**
 * Daimo Pay Provider Wrapper
 * Wraps the app with Daimo Pay context for cross-chain payment functionality
 * 
 * Features:
 * - Accept payments from ANY token on ANY chain
 * - Users can pay from Arbitrum, Base, Blast, BSC, Ethereum, Linea, Optimism, Polygon, Worldchain
 * - Receive USDC on Base (guaranteed amounts, no slippage)
 * 
 * Note: Daimo Pay only works on the client-side, so we dynamically import it
 */
export function DaimoPayProvider({ children }) {
  const [DaimoPay, setDaimoPay] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Dynamically import Daimo Pay only on client-side
    import('@daimo/pay').then((module) => {
      setDaimoPay(() => module.DaimoPayProvider);
    }).catch((error) => {
      console.error('Failed to load Daimo Pay:', error);
    });
  }, []);

  // During SSR or before Daimo loads, just render children
  if (!isClient || !DaimoPay) {
    return <>{children}</>;
  }

  // Once loaded, wrap with DaimoPayProvider
  return <DaimoPay>{children}</DaimoPay>;
}

