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
      if (!result) {
        throw new Error('No swap route found for this token. Try a different token.');
      }
      setQuote(result);
    } catch (err) {
      if (fetchIdRef.current !== currentId) return;
      console.error('❌ spanDEX quote error:', err);
      setQuoteError(err instanceof Error ? err : new Error('Failed to get swap quote'));
      setQuote(null);
    } finally {
      if (fetchIdRef.current === currentId) setIsQuoteLoading(false);
    }
  }, [usdAmount, address, enabled, selectedToken]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

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

  const estimatedInputAmount =
    quote?.inputAmount != null && selectedToken
      ? (Number(quote.inputAmount) / 10 ** selectedToken.decimals).toFixed(
          selectedToken.decimals <= 6 ? 4 : 6
        )
      : null;

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
