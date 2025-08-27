import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { farcasterFrame as miniAppConnector } from '@farcaster/frame-wagmi-connector'
import { injected } from 'wagmi/connectors'

// Detect if we're in a mobile Farcaster client vs desktop browser
function isMobileFarcasterClient() {
  if (typeof window === 'undefined') return false;
  
  // Check for Farcaster mobile client indicators
  const userAgent = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const hasFarcasterContext = typeof window.farcasterContext !== 'undefined';
  
  return isMobile && hasFarcasterContext;
}

// Create connectors based on environment
function getConnectors() {
  const connectors = [];
  
  try {
    // Always try to add the Farcaster connector
    connectors.push(miniAppConnector());
  } catch (error) {
    console.warn('Farcaster connector not available:', error);
  }
  
  // Add injected connector as fallback for desktop browsers
  if (typeof window !== 'undefined') {
    connectors.push(injected());
  }
  
  return connectors;
}

// Wagmi configuration for Farcaster Mini App with fallback support
export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: getConnectors()
})

// USDC contract address on Base
export const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

// Merchant wallet address for receiving payments
export const MERCHANT_WALLET_ADDRESS = '0xEDb90eF78C78681eE504b9E00950d84443a3E86B'

// USDC has 6 decimals
export const USDC_DECIMALS = 6 