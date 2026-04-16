'use client';

import { useTokenSwap, SWAP_TOKENS } from '@/lib/useTokenSwap';

/**
 * Rendered ONLY when the user selects "Other Token" in the payment tab.
 * Keeping useTokenSwap (and therefore @spandex/core) inside this component
 * means the spanDEX library is never loaded or initialized until it's
 * actually needed — it does not affect USDC-only checkouts at all.
 */
export function SwapPaymentSection({
  usdAmount,
  isProcessing,
  onSwapStart,
  onSwapSuccess,
  onSwapError,
}) {
  const {
    selectedToken,
    setSelectedToken,
    quote,
    isQuoteLoading,
    quoteError,
    fetchQuote,
    isExecuting,
    executeSwap,
    estimatedInputAmount,
    requiresApproval,
  } = useTokenSwap({ usdAmount, enabled: true });

  const handlePay = async () => {
    onSwapStart();
    try {
      const txHash = await executeSwap();
      await onSwapSuccess(txHash);
    } catch (err) {
      const raw = err?.message || '';
      let message;
      if (raw.includes('User rejected') || raw.includes('user rejected') || raw.includes('rejected')) {
        message = 'Payment cancelled. You rejected the transaction in your wallet.';
      } else if (raw.includes('switch your wallet')) {
        message = 'Please switch your wallet to the Base network and try again.';
      } else if (raw.includes('No quote available') || raw.includes('No swap quote')) {
        message = 'Swap quote unavailable. Please refresh the quote and try again.';
      } else {
        message = 'Swap payment failed. Please try again.';
      }
      onSwapError(message);
    }
  };

  return (
    <div className="space-y-2">
      {/* Token selector pills */}
      <div className="flex gap-1.5 flex-wrap">
        {SWAP_TOKENS.map((token) => (
          <button
            key={token.symbol}
            onClick={() => setSelectedToken(token)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              selectedToken.symbol === token.symbol
                ? 'bg-[#3eb489] text-white border-[#3eb489]'
                : 'bg-white text-gray-600 border-gray-300 hover:border-[#3eb489] hover:text-[#3eb489]'
            }`}
          >
            {token.symbol}
          </button>
        ))}
      </div>

      {/* Quote loading */}
      {isQuoteLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-blue-700 text-sm">Getting best swap rate…</div>
        </div>
      )}

      {/* Quote error */}
      {quoteError && !isQuoteLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-amber-800 text-xs">
            Could not get a quote for {selectedToken.symbol}. Try another token or try again.
          </div>
          <button onClick={fetchQuote} className="mt-1.5 text-xs text-amber-700 underline">
            Retry
          </button>
        </div>
      )}

      {/* Quote summary */}
      {quote && !isQuoteLoading && estimatedInputAmount && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">You pay (est.)</span>
            <span className="font-medium text-gray-900">
              {estimatedInputAmount} {selectedToken.symbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Merchant receives</span>
            <span className="font-medium text-gray-900">${usdAmount.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Route</span>
            <span className="capitalize">{quote.provider}</span>
          </div>
          {requiresApproval && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">
              Requires 2 wallet approvals: token approval + swap
            </p>
          )}
        </div>
      )}

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={isProcessing || isExecuting || !quote || isQuoteLoading}
        className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
      >
        {(isProcessing || isExecuting)
          ? 'Swapping…'
          : isQuoteLoading
            ? 'Getting quote…'
            : `Swap ${selectedToken.symbol} → $${usdAmount.toFixed(2)} USDC`}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Your {selectedToken.symbol} is swapped to USDC and sent directly to the merchant. Max 0.5%
        slippage.
      </p>
    </div>
  );
}
