'use client';

import { DaimoPayButton as DaimoButton } from '@daimo/pay';
import { MERCHANT_WALLET_ADDRESS, USDC_CONTRACT_ADDRESS } from '@/lib/wagmi';
import { getAddress } from 'viem';

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
  // Use demo appId for now (works on mainnet and testnets)
  const appId = process.env.NEXT_PUBLIC_DAIMO_APP_ID || 'pay-demo';

  return (
    <DaimoButton
      appId={appId}
      toAddress={getAddress(MERCHANT_WALLET_ADDRESS)}
      toChain={8453} // Base mainnet
      toUnits={amount.toFixed(2)} // Format as "10.50"
      toToken={getAddress(USDC_CONTRACT_ADDRESS)}
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

