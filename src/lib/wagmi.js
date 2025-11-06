import { http, createConfig } from 'wagmi'
import { base, mainnet, arbitrum, optimism, polygon, bsc, celo, linea, scroll, worldchain } from 'wagmi/chains'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'
import { injected } from 'wagmi/connectors'

// Wagmi configuration for Farcaster Mini App + Daimo Pay
// Includes all chains that Daimo Pay supports

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

// All chains that Daimo Pay requires (Arbitrum, Base, BNB Smart Chain, Celo, Linea, Ethereum, Polygon, OP Mainnet, Scroll, World Chain)
const chains = [base, mainnet, arbitrum, optimism, polygon, bsc, celo, linea, scroll, worldchain]

// Create transports for all chains
const transports = chains.reduce((acc, chain) => {
  acc[chain.id] = http()
  return acc
}, {})

export const config = createConfig({
  chains,
  transports,
  connectors,
  ssr: true // Enable SSR support for proper wallet balance reading
})

// USDC contract address on Base
export const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

// Merchant wallet address for receiving payments
export const MERCHANT_WALLET_ADDRESS = '0xEDb90eF78C78681eE504b9E00950d84443a3E86B'

// USDC has 6 decimals
export const USDC_DECIMALS = 6 