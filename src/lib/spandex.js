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

// Lazily-created spanDEX config — created on first use, not at module load time.
// This avoids webpack bundling @spandex/core as a static import, which triggers
// a circular-reference TDZ crash in both the ESM and CJS builds.
let _spandexConfig = null;

export async function getSpandexConfig() {
  if (_spandexConfig) return _spandexConfig;

  const [{ createConfig, lifi, relay, velora }, { createPublicClient, http }, { base }] =
    await Promise.all([
      import('@spandex/core'),
      import('viem'),
      import('viem/chains'),
    ]);

  // base.drpc.org is the free public RPC used in the spanDEX docs — it supports
  // eth_simulateV1 which is required for spanDEX's quote simulation step.
  const baseClient = createPublicClient({ chain: base, transport: http('https://base.drpc.org') });

  // Use providers that support both `recipientAccount` (output sent directly to
  // merchant wallet) and `targetOut` mode (exact USDC output guaranteed).
  _spandexConfig = createConfig({
    providers: [lifi(), relay(), velora()],
    clients: [baseClient],
  });

  return _spandexConfig;
}
