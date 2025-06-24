'use client';

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConnections } from 'wagmi'
import { USDC_CONTRACT, PAYMENT_CONFIG, formatUSDCAmount, parseUSDCAmount, usdToUSDC } from './usdc'

export function useUSDCPayment() {
  const { address, isConnected, connector } = useAccount()
  const connections = useConnections()
  const [paymentStatus, setPaymentStatus] = useState('idle') // idle, checking, pending, success, error
  const [error, setError] = useState(null)
  const [transactionHash, setTransactionHash] = useState(null)

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
    isPending: isWritePending,
    error: writeError 
  } = useWriteContract()

  // Wait for transaction confirmation
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    error: confirmError
  } = useWaitForTransactionReceipt({
    hash: hash, // Use the hash from writeContract, not our state
    enabled: !!hash,
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

  // Execute USDC payment
  const executePayment = async (usdAmount, cartData) => {
    try {
      setError(null)
      setPaymentStatus('checking')

      // Validate inputs
      if (!isConnected) {
        throw new Error('Wallet not connected')
      }

      if (!address) {
        throw new Error('No wallet address found')
      }

      if (!connector) {
        throw new Error('Connector not available')
      }

      // Wait for connections to be ready (fix for getChainId error)
      if (connections.length === 0) {
        throw new Error('No connections available')
      }

      if (!usdAmount || usdAmount <= 0) {
        throw new Error('Invalid payment amount')
      }

      // Check balance
      if (!hasSufficientBalance(usdAmount)) {
        throw new Error(`Insufficient USDC balance. You need ${usdAmount} USDC but only have ${balanceNumber.toFixed(2)} USDC`)
      }

      setPaymentStatus('pending')

      // Convert USD to USDC amount (1:1 for MVP)
      const usdcAmount = usdToUSDC(usdAmount)

      console.log('Executing USDC payment:', {
        from: address,
        to: PAYMENT_CONFIG.merchantWallet,
        amount: usdAmount,
        usdcAmount: usdcAmount.toString(),
        cartData
      })

      // Execute the transfer
      writeContract({
        ...USDC_CONTRACT,
        functionName: 'transfer',
        args: [PAYMENT_CONFIG.merchantWallet, usdcAmount],
      })

      // Note: hash will be available from the writeContract hook
      // and we'll set it when the transaction is submitted
    } catch (err) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed')
      setPaymentStatus('error')
      throw err
    }
  }

  // Reset payment state
  const resetPayment = () => {
    setPaymentStatus('idle')
    setError(null)
    setTransactionHash(null)
  }

  // Update transaction hash when available
  if (hash && !transactionHash) {
    setTransactionHash(hash)
  }

  // Update status based on transaction state
  if (hash && isConfirmed && paymentStatus !== 'success') {
    setPaymentStatus('success')
  }

  if ((writeError || confirmError) && paymentStatus !== 'error') {
    const errorMessage = writeError?.message || confirmError?.message || 'Transaction failed'
    setError(errorMessage)
    setPaymentStatus('error')
  }

  return {
    // Balance info
    balance: formattedBalance,
    balanceNumber,
    isLoadingBalance,
    refetchBalance,
    
    // Payment state
    paymentStatus,
    error,
    transactionHash: hash || transactionHash, // Use the most current hash
    
    // Payment functions
    executePayment,
    resetPayment,
    hasSufficientBalance,
    
    // Transaction state
    isPending: isWritePending,
    isConfirming,
    isConfirmed,
    
    // Wallet state
    isConnected,
    address,
  }
} 