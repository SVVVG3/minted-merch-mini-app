'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useTokenSwap } from '@/lib/useTokenSwap';

/**
 * Rendered ONLY when the user selects "Other Token" in the payment tab.
 * Keeping useTokenSwap (and therefore @spandex/core) inside this component
 * means the spanDEX library is never loaded until it's actually needed.
 */
export function SwapPaymentSection({
  usdAmount,
  isProcessing,
  onSwapStart,
  onSwapSuccess,
  onSwapError,
}) {
  const { address } = useAccount();

  // --- Wallet token list (fetched from Neynar via server-side API route) ---
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tokensError, setTokensError] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (!address) return;
    setTokensLoading(true);
    setTokensError(null);
    autoSelectedRef.current = false;

    fetch(`/api/wallet/token-balances?address=${address}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load wallet tokens');
        return r.json();
      })
      .then((data) => {
        setTokens(data.tokens ?? []);
        // Auto-select the first (highest USD value) token
        if (data.tokens?.length > 0 && !autoSelectedRef.current) {
          autoSelectedRef.current = true;
          setSelectedToken(data.tokens[0]);
        }
      })
      .catch((err) => setTokensError(err.message))
      .finally(() => setTokensLoading(false));
  }, [address]);

  // Reset quote when token changes
  const handleSelectToken = (token) => {
    if (selectedToken?.address !== token.address) {
      setSelectedToken(token);
    }
  };

  // --- spanDEX quote + execution ---
  const {
    quote,
    isQuoteLoading,
    quoteError,
    fetchQuote,
    isExecuting,
    executeSwap,
    estimatedInputAmount,
    requiresApproval,
  } = useTokenSwap({ usdAmount, selectedToken, enabled: !tokensLoading && !!selectedToken });

  const handlePay = async () => {
    onSwapStart();
    try {
      const txHash = await executeSwap();
      await onSwapSuccess(txHash);
    } catch (err) {
      const raw = err?.message || '';
      let message;
      if (
        raw.includes('User rejected') ||
        raw.includes('user rejected') ||
        raw.includes('rejected')
      ) {
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

  // ---- Render ----

  if (tokensLoading) {
    return (
      <div className="py-4 text-center text-sm text-gray-400">Loading your wallet tokens…</div>
    );
  }

  if (tokensError) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        Could not load wallet tokens. Please try again.
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        No tokens with sufficient balance found in your wallet on Base. Add funds and try again.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Token selector — all tokens from wallet, sorted by USD value */}
      <div className="flex flex-wrap gap-2">
        {tokens.map((token) => {
          const isSelected = selectedToken?.address === token.address;
          const usdLabel =
            token.balanceUsd >= 1
              ? `$${token.balanceUsd.toFixed(2)}`
              : `$${token.balanceUsd.toFixed(4)}`;

          return (
            <button
              key={token.address}
              onClick={() => handleSelectToken(token)}
              title={`${token.name}: ${token.formatted} ${token.symbol} (${usdLabel})`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                isSelected
                  ? 'bg-[#3eb489] text-white border-[#3eb489]'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-[#3eb489] hover:text-[#3eb489]'
              }`}
            >
              {token.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={token.imageUrl}
                  alt={token.symbol}
                  className="w-4 h-4 rounded-full"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <span>{token.symbol}</span>
              <span className={`text-[10px] ${isSelected ? 'text-green-100' : 'text-gray-400'}`}>
                {usdLabel}
              </span>
            </button>
          );
        })}
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
            Could not get a quote for {selectedToken?.symbol}. Your balance may be insufficient, or
            no route exists for this token. Try another.
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
              {estimatedInputAmount} {selectedToken?.symbol}
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
        disabled={isProcessing || isExecuting || !quote || isQuoteLoading || !selectedToken}
        className="w-full bg-[#3eb489] hover:bg-[#359970] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
      >
        {isProcessing || isExecuting
          ? 'Swapping…'
          : isQuoteLoading
            ? 'Getting quote…'
            : selectedToken
              ? `Swap ${selectedToken.symbol} → $${usdAmount.toFixed(2)} USDC`
              : 'Select a token'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        {selectedToken
          ? `Your ${selectedToken.symbol} is swapped to USDC and sent directly to the merchant. Max 0.5% slippage.`
          : 'Select a token from your wallet to pay with.'}
      </p>
    </div>
  );
}
