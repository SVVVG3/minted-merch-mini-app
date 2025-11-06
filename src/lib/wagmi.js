import { http, createConfig } from 'wagmi'
import { 
  base, 
  mainnet, 
  arbitrum, 
  optimism, 
  polygon, 
  bsc, 
  celo, 
  linea, 
  scroll, 
  worldchain 
} from 'wagmi/chains'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'
import { injected } from 'wagmi/connectors'

// Wagmi configuration for Farcaster Mini App
// Base Account is handled via SDK directly, not through Wagmi

// All chains required by Daimo Pay for cross-chain payments
const chains = [
  base,        // Base (primary - where we receive USDC)
  mainnet,     // Ethereum Mainnet
  arbitrum,    // Arbitrum One
  optimism,    // OP Mainnet
  polygon,     // Polygon
  bsc,         // BNB Smart Chain
  celo,        // Celo
  linea,       // Linea Mainnet
  scroll,      // Scroll
  worldchain   // World Chain
]

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
  chains,
  transports: {
    // Configure HTTP transport for each chain
    [base.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [celo.id]: http(),
    [linea.id]: http(),
    [scroll.id]: http(),
    [worldchain.id]: http(),
  },
  connectors
})

// USDC contract address on Base
export const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

// Merchant wallet address for receiving payments
export const MERCHANT_WALLET_ADDRESS = '0xEDb90eF78C78681eE504b9E00950d84443a3E86B'

// USDC has 6 decimals
export const USDC_DECIMALS = 6 