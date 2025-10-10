import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'
import { injected } from 'wagmi/connectors'

// Wagmi configuration for Farcaster Mini App
// Base Account will be handled separately via @base-org/account package
export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [
    // Farcaster Mini App connector for Farcaster app users
    miniAppConnector(),
    // Add injected connector as fallback for different Farcaster clients
    injected({
      target: 'farcaster',
    }),
    // Generic injected connector for broader compatibility
    injected()
  ]
})

// USDC contract address on Base
export const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

// Merchant wallet address for receiving payments
export const MERCHANT_WALLET_ADDRESS = '0xEDb90eF78C78681eE504b9E00950d84443a3E86B'

// USDC has 6 decimals
export const USDC_DECIMALS = 6 