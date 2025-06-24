import { parseUnits, formatUnits } from 'viem'
import { USDC_CONTRACT_ADDRESS, MERCHANT_WALLET_ADDRESS, USDC_DECIMALS } from './wagmi'

// USDC Contract ABI (ERC-20 standard functions we need)
export const USDC_ABI = [
  // Read functions
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Write functions
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event',
  },
]

// Helper functions for USDC amount conversion
export const formatUSDCAmount = (amount) => {
  return formatUnits(amount, USDC_DECIMALS)
}

export const parseUSDCAmount = (amount) => {
  return parseUnits(amount.toString(), USDC_DECIMALS)
}

// Convert USD to USDC (1:1 for MVP)
export const usdToUSDC = (usdAmount) => {
  return parseUSDCAmount(usdAmount)
}

// Format USDC amount for display
export const formatUSDCForDisplay = (amount) => {
  const formatted = formatUSDCAmount(amount)
  return `${parseFloat(formatted).toFixed(2)} USDC`
}

// Contract configuration object
export const USDC_CONTRACT = {
  address: USDC_CONTRACT_ADDRESS,
  abi: USDC_ABI,
}

// Payment configuration
export const PAYMENT_CONFIG = {
  merchantWallet: MERCHANT_WALLET_ADDRESS,
  usdcContract: USDC_CONTRACT_ADDRESS,
  decimals: USDC_DECIMALS,
} 