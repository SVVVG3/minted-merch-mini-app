'use client';

import { DaimoPayButton as DaimoButton, useDaimoPayUI } from '@daimo/pay';
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
 */
export function DaimoPayButton({
  amount,
  orderId,
  onPaymentStarted,
  onPaymentCompleted,
  metadata = {},
  disabled = false,
}) {
  // Use demo appId for prototyping (as recommended by Daimo docs)
  const appId = process.env.NEXT_PUBLIC_DAIMO_APP_ID || 'pay-demo';
  
  // Get resetPayment to update amount before showing modal
  const { resetPayment } = useDaimoPayUI();

  // Handle button click: Update payment amount, then show modal
  const handleClick = (show) => {
    // CRITICAL: Update payment with current total before showing modal
    // This ensures taxes, shipping, and discounts are always reflected
    resetPayment({
      toUnits: amount.toFixed(2),
    });
    
    console.log('💰 Opening Daimo modal with total:', '$' + amount.toFixed(2));
    
    // Now show the modal with the updated amount
    show();
  };

  return (
    <DaimoButton.Custom
      appId={appId}
      toAddress={getAddress(MERCHANT_WALLET_ADDRESS)}
      toChain={8453} // Base mainnet
      toUnits={amount.toFixed(2)} // Initial amount (will be updated on click)
      toToken={getAddress(USDC_CONTRACT_ADDRESS)}
      intent="Purchase Merch"
      externalId={orderId}
      metadata={metadata}
      closeOnSuccess={true} // Close modal after successful payment
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
    >
      {({ show }) => (
        <button
          onClick={() => handleClick(show)}
          disabled={disabled}
          className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <span>Purchase Merch</span>
        </button>
      )}
    </DaimoButton.Custom>
  );
}

