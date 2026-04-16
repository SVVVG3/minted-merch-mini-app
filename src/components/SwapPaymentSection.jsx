'use client';

import { useAccount, useBalance } from 'wagmi';
import { useTokenSwap, SWAP_TOKENS } from '@/lib/useTokenSwap';

const BASE_CHAIN_ID = 8453;

// Fetch balance for a single token (native ETH or ERC-20)
function useTokenBalance(address, token) {
  return useBalance({
    address,
    chainId: BASE_CHAIN_ID,
    ...(token.isNative ? {} : { token: token.address }),
  });
}

// Inner component — rendered only once balances are available
function SwapTokenSelector({ tokens, selectedToken, onSelect }) {
  const { address } = useAccount();

  const b0 = useTokenBalance(address, tokens[0]);
  const b1 = useTokenBalance(address, tokens[1]);
  const b2 = useTokenBalance(address, tokens[2]);
  const b3 = useTokenBalance(address, tokens[3]);

  const balances = [b0, b1, b2, b3];

  // Pair tokens with their balance data, then sort: non-zero first, then by raw value desc
  const tokensWithBalance = tokens.map((token, i) => {
    const bal = balances[i]?.data;
    const rawValue = bal ? Number(bal.value) : 0;
    const formatted = bal ? parseFloat(bal.formatted) : 0;
    return { token, rawValue, formatted, symbol: bal?.symbol ?? token.symbol };
  });

  const sorted = [...tokensWithBalance].sort((a, b) => b.rawValue - a.rawValue);
  const hasAnyBalance = sorted.some((t) => t.rawValue > 0);

  return (
    <div className="flex gap-1.5 flex-wrap">
      {sorted.map(({ token, formatted, rawValue }) => {
        const isSelected = selectedToken.symbol === token.symbol;
        const hasBalance = rawValue > 0;
        const balanceLabel = hasBalance
          ? formatted < 0.000001
            ? '<0.000001'
            : formatted.toFixed(token.decimals === 6 ? 2 : 6).replace(/\.?0+$/, '')
          : '0';

        return (
          <button
            key={token.symbol}
            onClick={() => hasBalance && onSelect(token)}
            disabled={!hasBalance}
            title={hasBalance ? `Balance: ${balanceLabel} ${token.symbol}` : `No ${token.symbol} in wallet`}
            className={`flex flex-col items-center px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              isSelected
                ? 'bg-[#3eb489] text-white border-[#3eb489]'
                : hasBalance
                  ? 'bg-white text-gray-700 border-gray-300 hover:border-[#3eb489] hover:text-[#3eb489]'
                  : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
            }`}
          >
            <span>{token.symbol}</span>
            <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-green-100' : hasBalance ? 'text-gray-400' : 'text-gray-300'}`}>
              {balanceLabel}
            </span>
          </button>
        );
      })}
      {!hasAnyBalance && (
        <p className="text-xs text-amber-700 w-full">
          No supported tokens found in your wallet. Add ETH, WETH, cbETH, or USDT on Base to use this option.
        </p>
      )}
    </div>
  );
}

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
        message = 'Swap quote unavailable. Please refresh and try again.';
      } else {
        message = 'Swap payment failed. Please try again.';
      }
      onSwapError(message);
    }
  };

  return (
    <div className="space-y-2">
      {/* Token selector — shows real wallet balances, dims zero-balance tokens */}
      <SwapTokenSelector
        tokens={SWAP_TOKENS}
        selectedToken={selectedToken}
        onSelect={setSelectedToken}
      />

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
