import { createConfig, lifi, relay, velora } from '@spandex/core';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// Providers that support `recipientAccount` (send swap output directly to merchant wallet)
// and `targetOut` mode (guarantee exact USDC output amount, adjusting input for slippage).
// No API keys required for these providers.
const providers = [
  lifi(),    // Li.Fi DEX aggregator
  relay(),   // Relay Protocol
  velora(),  // Velora DEX
];

const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});

export const spandexConfig = createConfig({
  providers,
  clients: [baseClient],
});

// Native ETH address used by DeFi protocols on EVM chains
export const NATIVE_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Supported input tokens for swap-based payments on Base
export const SWAP_TOKENS = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: NATIVE_ETH_ADDRESS,
    decimals: 18,
    isNative: true,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped ETH',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    isNative: false,
  },
  {
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    decimals: 18,
    isNative: false,
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    decimals: 6,
    isNative: false,
  },
];
