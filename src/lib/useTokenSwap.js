'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletClient, usePublicClient, useAccount } from 'wagmi';
import { getQuote, buildCalls } from '@spandex/core';
import { base } from 'viem/chains';
import { spandexConfig, SWAP_TOKENS } from './spandex';
import { USDC_CONTRACT_ADDRESS, MERCHANT_WALLET_ADDRESS } from './wagmi';

const QUOTE_REFRESH_INTERVAL_MS = 30_000;

export { SWAP_TOKENS };

export function useTokenSwap({ usdAmount, enabled = true }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [selectedToken, setSelectedToken] = useState(SWAP_TOKENS[0]); // ETH by default
  const [quote, setQuote] = useState(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState(null);

  // Track the current fetch so we can discard stale results
  const fetchIdRef = useRef(0);

  const fetchQuote = useCallback(async () => {
    if (!usdAmount || usdAmount <= 0 || !address || !enabled) return;

    const currentId = ++fetchIdRef.current;
    setIsQuoteLoading(true);
    setQuoteError(null);

    try {
      const outputAmount = BigInt(Math.round(usdAmount * 1e6));

      const result = await getQuote({
        config: spandexConfig,
        swap: {
          chainId: base.id,
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

      if (fetchIdRef.current !== currentId) return; // Stale response

      setQuote(result);
    } catch (err) {
      if (fetchIdRef.current !== currentId) return;
      console.error('❌ spanDEX quote error:', err);
      setQuoteError(err instanceof Error ? err : new Error('Failed to get swap quote'));
      setQuote(null);
    } finally {
      if (fetchIdRef.current === currentId) {
        setIsQuoteLoading(false);
      }
    }
  }, [usdAmount, address, enabled, selectedToken.address]);

  // Fetch quote on mount and when dependencies change
  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // Auto-refresh quote every 30 seconds
  useEffect(() => {
    if (!enabled || !usdAmount || !address) return;
    const timer = setInterval(fetchQuote, QUOTE_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchQuote, enabled, usdAmount, address]);

  // Reset quote when token changes
  const handleSetSelectedToken = useCallback((token) => {
    setSelectedToken(token);
    setQuote(null);
    setQuoteError(null);
  }, []);

  const executeSwap = async () => {
    if (!quote) throw new Error('No quote available. Please wait for a quote to load.');
    if (!walletClient) throw new Error('Wallet not connected');
    if (!address) throw new Error('No wallet address found');
    if (!publicClient) throw new Error('No public client available');

    if (walletClient.chain?.id !== base.id) {
      throw new Error('Please switch your wallet to the Base network');
    }

    setIsExecuting(true);
    setExecuteError(null);

    try {
      const outputAmount = BigInt(Math.round(usdAmount * 1e6));
      const swapParams = {
        chainId: base.id,
        inputToken: selectedToken.address,
        outputToken: USDC_CONTRACT_ADDRESS,
        mode: 'targetOut',
        outputAmount,
        slippageBps: 50,
        swapperAccount: address,
        recipientAccount: MERCHANT_WALLET_ADDRESS,
      };

      const calls = await buildCalls({
        quote,
        swap: swapParams,
        config: spandexConfig,
        publicClient,
      });

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

  // Estimate the input amount for display (in human-readable units)
  const estimatedInputAmount = quote?.inputAmount != null
    ? (Number(quote.inputAmount) / 10 ** selectedToken.decimals).toFixed(
        selectedToken.decimals === 6 ? 2 : 6
      )
    : null;

  // Number of wallet prompts required
  const requiresApproval = quote?.approval != null;
  const walletPromptCount = requiresApproval ? 2 : 1;

  return {
    selectedToken,
    setSelectedToken: handleSetSelectedToken,
    quote,
    isQuoteLoading,
    quoteError,
    fetchQuote,
    isExecuting,
    executeError,
    executeSwap,
    estimatedInputAmount,
    requiresApproval,
    walletPromptCount,
  };
}
