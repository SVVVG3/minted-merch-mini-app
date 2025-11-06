import { createConfig } from 'wagmi'
import { getDefaultConfig } from '@daimo/pay'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'
import { injected } from 'wagmi/connectors'

// Wagmi configuration for Farcaster Mini App + Daimo Pay
// Uses Daimo's getDefaultConfig to automatically configure all supported chains

// Get Daimo's default config (includes all chains and transports)
const daimoConfig = getDefaultConfig({
  appName: 'Minted Merch',
})

// Add Farcaster connectors to Daimo's config
const connectors = [
  // Farcaster Mini App connector for Farcaster app users
  miniAppConnector(),
  // Add injected connector as fallback for different Farcaster clients
  injected({
    target: 'farcaster',
  }),
  // Generic injected connector for broader compatibility
  injected()
]

export const config = createConfig({
  ...daimoConfig,
  connectors: [
    ...connectors,
    ...(daimoConfig.connectors || [])
  ]
})

// USDC contract address on Base
export const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

// Merchant wallet address for receiving payments
export const MERCHANT_WALLET_ADDRESS = '0xEDb90eF78C78681eE504b9E00950d84443a3E86B'

// USDC has 6 decimals
export const USDC_DECIMALS = 6 