'use client';

import { useEffect, useState } from 'react';
import { MERCHANT_WALLET_ADDRESS, USDC_CONTRACT_ADDRESS } from '@/lib/wagmi';

/**
 * Daimo Pay Button Component
 * 
 * Allows users to pay from ANY token on ANY chain:
 * - Arbitrum, Base, Blast, BSC, Ethereum, Linea, Optimism, Polygon, Worldchain
 * - Automatically converts to USDC on Base (no slippage)
 * - One-click payment experience
 * 
 * @param {Object} props
 * @param {number} props.amount - Amount in USD (e.g., 10.50)
 * @param {string} props.orderId - Unique order identifier
 * @param {Function} props.onPaymentStarted - Called when payment is initiated
 * @param {Function} props.onPaymentCompleted - Called when payment is confirmed
 * @param {Object} props.metadata - Additional metadata to include with payment
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {string} props.className - Additional CSS classes
 */
export function DaimoPayButton({
  amount,
  orderId,
  onPaymentStarted,
  onPaymentCompleted,
  metadata = {},
  disabled = false,
  className = ''
}) {
  const [DaimoButton, setDaimoButton] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Dynamically import Daimo Pay button only on client-side
    import('@daimo/pay').then((module) => {
      setDaimoButton(() => module.DaimoPayButton);
    }).catch((error) => {
      console.error('Failed to load Daimo Pay button:', error);
    });
  }, []);

  // Use demo appId for now (works on mainnet and testnets)
  const appId = process.env.NEXT_PUBLIC_DAIMO_APP_ID || 'pay-demo';

  // During SSR or before button loads, show loading state
  if (!isClient || !DaimoButton) {
    return (
      <button
        disabled
        className={className || "w-full bg-gray-400 text-white font-medium py-3 px-4 rounded-lg cursor-not-allowed"}
      >
        Loading payment options...
      </button>
    );
  }

  return (
    <DaimoButton
      appId={appId}
      toAddress={MERCHANT_WALLET_ADDRESS}
      toChain={8453} // Base mainnet
      toUnits={amount.toFixed(2)} // Format as "10.50"
      toToken={USDC_CONTRACT_ADDRESS}
      intent="Purchase Merch"
      externalId={orderId}
      metadata={metadata}
      onPaymentStarted={(event) => {
        console.log('💰 Daimo payment started:', event);
        if (onPaymentStarted) {
          onPaymentStarted(event);
        }
      }}
      onPaymentCompleted={(event) => {
        console.log('✅ Daimo payment completed:', event);
        if (onPaymentCompleted) {
          onPaymentCompleted(event);
        }
      }}
      disabled={disabled}
      className={className}
    />
  );
}

