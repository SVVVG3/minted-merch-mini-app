'use client';

import { DaimoPayProvider as DaimoPay } from '@daimo/pay';

/**
 * Daimo Pay Provider Wrapper
 * Wraps the app with Daimo Pay context for cross-chain payment functionality
 * 
 * Features:
 * - Accept payments from ANY token on ANY chain
 * - Users can pay from Arbitrum, Base, Blast, BSC, Ethereum, Linea, Optimism, Polygon, Worldchain
 * - Receive USDC on Base (guaranteed amounts, no slippage)
 */
export function DaimoPayProvider({ children }) {
  return (
    <DaimoPay>
      {children}
    </DaimoPay>
  );
}

