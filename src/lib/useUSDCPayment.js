'use client';

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { USDC_CONTRACT, PAYMENT_CONFIG, formatUSDCAmount, parseUSDCAmount, usdToUSDC } from './usdc'

export function useUSDCPayment() {
  const { address, isConnected } = useAccount()
  const [error, setError] = useState(null)

  // Read user's USDC balance
  const { 
    data: balance, 
    isLoading: isLoadingBalance, 
    refetch: refetchBalance 
  } = useReadContract({
    ...USDC_CONTRACT,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    enabled: !!address && isConnected,
  })

  // Write contract hook for USDC transfer
  const { 
    writeContract, 
    data: hash, 
    isPending,
    error: writeError 
  } = useWriteContract()

  // Wait for transaction confirmation
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({
    hash,
  })

  // Format balance for display
  const formattedBalance = balance ? formatUSDCAmount(balance) : '0'
  const balanceNumber = parseFloat(formattedBalance)

  // Check if user has sufficient balance
  const hasSufficientBalance = (usdAmount) => {
    if (!balance) return false
    const requiredUSDC = parseFloat(usdAmount)
    return balanceNumber >= requiredUSDC
  }

  // Execute USDC payment - simplified following Wagmi docs
  const executePayment = async (usdAmount, cartData) => {
    try {
      setError(null)

      // Basic validation
      if (!isConnected) {
        throw new Error('Wallet not connected')
      }

      if (!address) {
        throw new Error('No wallet address found')
      }

      if (!usdAmount || usdAmount <= 0) {
        throw new Error('Invalid payment amount')
      }

      // Check balance
      if (!hasSufficientBalance(usdAmount)) {
        throw new Error(`Insufficient USDC balance. You need ${usdAmount} USDC but only have ${balanceNumber.toFixed(2)} USDC`)
      }

      // Convert USD to USDC amount (1:1 for MVP)
      const usdcAmount = usdToUSDC(usdAmount)

      console.log('Executing USDC payment:', {
        from: address,
        to: PAYMENT_CONFIG.merchantWallet,
        amount: usdAmount,
        usdcAmount: usdcAmount.toString(),
        cartData
      })

      // Execute the transfer - simple Wagmi pattern
      writeContract({
        ...USDC_CONTRACT,
        functionName: 'transfer',
        args: [PAYMENT_CONFIG.merchantWallet, usdcAmount],
      })

    } catch (err) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed')
      throw err
    }
  }

  // Reset payment state
  const resetPayment = () => {
    setError(null)
  }

  // Determine payment status based on transaction state
  let paymentStatus = 'idle'
  if (isPending) paymentStatus = 'pending'
  else if (isConfirming) paymentStatus = 'confirming'
  else if (isConfirmed) paymentStatus = 'success'
  else if (writeError || error) paymentStatus = 'error'

  return {
    // Balance info
    balance: formattedBalance,
    balanceNumber,
    isLoadingBalance,
    refetchBalance,
    
    // Payment state
    paymentStatus,
    error: writeError?.message || error,
    transactionHash: hash,
    
    // Payment functions
    executePayment,
    resetPayment,
    hasSufficientBalance,
    
    // Transaction state
    isPending,
    isConfirming,
    isConfirmed,
    
    // Wallet state
    isConnected,
    address,
  }
} 