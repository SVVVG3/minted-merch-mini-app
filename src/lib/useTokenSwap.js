'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletClient, usePublicClient, useAccount } from 'wagmi';
import { USDC_CONTRACT_ADDRESS, MERCHANT_WALLET_ADDRESS } from './wagmi';
import { getSpandexConfig } from './spandex';

// @spandex/core is imported dynamically inside async functions to avoid the
// circular-reference TDZ crash that occurs when webpack statically bundles it.

const QUOTE_REFRESH_INTERVAL_MS = 30_000;
const BASE_CHAIN_ID = 8453;

/**
 * Fetches a spanDEX quote and executes a swap for the given token.
 *
 * @param {object} params
 * @param {number} params.usdAmount  - Total USD to receive in USDC (e.g. 0.93)
 * @param {object|null} params.selectedToken - Token object with { address, decimals, symbol }
 * @param {boolean} [params.enabled] - Set false to pause quote fetching
 */
export function useTokenSwap({ usdAmount, selectedToken, enabled = true }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [quote, setQuote] = useState(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState(null);

  const fetchIdRef = useRef(0);

  const fetchQuote = useCallback(async () => {
    if (!usdAmount || usdAmount <= 0 || !address || !enabled || !selectedToken) return;

    const currentId = ++fetchIdRef.current;
    setIsQuoteLoading(true);
    setQuoteError(null);

    // drpc.org is a random-routing pool — some nodes support eth_simulateV1
    // (required by spanDEX) and some don't. Retry up to 2 extra times with a
    // short back-off so most failures self-resolve without user interaction.
    const MAX_ATTEMPTS = 3;
    let lastErr = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (fetchIdRef.current !== currentId) return; // Superseded by newer fetch

      // Brief back-off between retries (not before the first attempt)
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        if (fetchIdRef.current !== currentId) return;
      }

      try {
        // Dynamic import — only loads @spandex/core when actually needed
        const [{ getQuote }, config] = await Promise.all([
          import('@spandex/core'),
          getSpandexConfig(),
        ]);

        const outputAmount = BigInt(Math.round(usdAmount * 1e6));

        const result = await getQuote({
          config,
          swap: {
            chainId: BASE_CHAIN_ID,
            inputToken: selectedToken.address,
            outputToken: USDC_CONTRACT_ADDRESS,
            mode: 'targetOut',
            outputAmount,
            slippageBps: 50,
            swapperAccount: address,
            recipientAccount: MERCHANT_WALLET_ADDRESS,
          },
          strategy: 'bestPrice',
        });

        if (fetchIdRef.current !== currentId) return;
        if (!result) throw new Error('NO_ROUTE');
        setQuote(result);
        setIsQuoteLoading(false);
        return; // Success — exit retry loop
      } catch (err) {
        lastErr = err;
        const msg = err?.message ?? '';
        // Don't retry if the DEX explicitly has no route for this token
        if (msg === 'NO_ROUTE' || msg.includes('No quotes provided')) break;
        console.warn(`❌ spanDEX quote attempt ${attempt + 1} failed:`, msg);
      }
    }

    if (fetchIdRef.current !== currentId) return;
    console.error('❌ spanDEX quote failed after retries:', lastErr);
    const displayErr =
      lastErr?.message === 'NO_ROUTE'
        ? new Error('No swap route found for this token. Try a different token.')
        : (lastErr instanceof Error ? lastErr : new Error('Failed to get swap quote'));
    setQuoteError(displayErr);
    setQuote(null);
    setIsQuoteLoading(false);
  }, [usdAmount, address, enabled, selectedToken]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  useEffect(() => {
    if (!enabled || !usdAmount || !address || !selectedToken) return;
    const timer = setInterval(fetchQuote, QUOTE_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchQuote, enabled, usdAmount, address, selectedToken]);

  const executeSwap = async () => {
    if (!quote) throw new Error('No quote available. Please wait for a quote to load.');
    if (!walletClient) throw new Error('Wallet not connected');
    if (!address) throw new Error('No wallet address found');
    if (!publicClient) throw new Error('No public client available');
    if (!selectedToken) throw new Error('No token selected');
    if (walletClient.chain?.id !== BASE_CHAIN_ID) {
      throw new Error('Please switch your wallet to the Base network');
    }

    setIsExecuting(true);
    setExecuteError(null);

    try {
      const [{ buildCalls }, { base }, config] = await Promise.all([
        import('@spandex/core'),
        import('viem/chains'),
        getSpandexConfig(),
      ]);

      const outputAmount = BigInt(Math.round(usdAmount * 1e6));
      const swapParams = {
        chainId: BASE_CHAIN_ID,
        inputToken: selectedToken.address,
        outputToken: USDC_CONTRACT_ADDRESS,
        mode: 'targetOut',
        outputAmount,
        slippageBps: 50,
        swapperAccount: address,
        recipientAccount: MERCHANT_WALLET_ADDRESS,
      };

      const calls = await buildCalls({ quote, swap: swapParams, config, publicClient });

      let lastHash = null;
      for (const call of calls) {
        const hash = await walletClient.sendTransaction({
          chain: base,
          account: address,
          to: call.txn.to,
          data: call.txn.data,
          gas: call.txn.gas,
          ...(call.txn.value !== undefined ? { value: call.txn.value } : {}),
        });
        await publicClient.waitForTransactionReceipt({ hash });
        lastHash = hash;
      }

      if (!lastHash) throw new Error('No transactions were executed');
      return lastHash;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Swap execution failed');
      setExecuteError(error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  };

  const estimatedInputAmount = (() => {
    if (quote?.inputAmount == null || !selectedToken) return null;
    const raw = Number(quote.inputAmount) / 10 ** selectedToken.decimals;
    // For large numbers use commas + fewer decimals; for small use more precision
    if (raw >= 1_000) {
      return raw.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    if (raw >= 1) {
      return raw.toLocaleString('en-US', { maximumFractionDigits: 4 });
    }
    return raw.toFixed(6);
  })();

  const requiresApproval = quote?.approval != null;

  return {
    quote,
    isQuoteLoading,
    quoteError,
    fetchQuote,
    isExecuting,
    executeError,
    executeSwap,
    estimatedInputAmount,
    requiresApproval,
    walletPromptCount: requiresApproval ? 2 : 1,
  };
}
