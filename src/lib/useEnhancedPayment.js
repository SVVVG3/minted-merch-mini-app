'use client'

import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { USDC_CONTRACT } from './usdc'
import { formatUSDCAmount, usdToUSDC } from './usdc'
import { executeBaseAccountPayment, checkBaseAccountBalance, getBaseAccountShippingData } from './baseAccount'
import { useBaseAccount } from '@/components/BaseAccountProvider'

/**
 * Enhanced payment hook that uses Base Account SDK when available,
 * falls back to existing Wagmi flow for Farcaster app users
 */
export function useEnhancedPayment() {
  const { isBaseApp, baseAccount, baseProfile } = useBaseAccount()
  const { address, isConnected } = useAccount()
  const [error, setError] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(null)

  // Wagmi hooks for fallback
  const { 
    data: balance, 
    isLoading: isLoadingBalance, 
    refetch: refetchBalance 
  } = useReadContract({
    address: USDC_CONTRACT.address,
    abi: USDC_CONTRACT.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    enabled: !!address && isConnected && !isBaseApp, // Only use Wagmi balance if not in Base app
  })

  const { 
    writeContract, 
    data: hash, 
    isPending: isWagmiPending,
    error: writeError 
  } = useWriteContract()

  const { 
    isLoading: isWagmiConfirming, 
    isSuccess: isWagmiConfirmed 
  } = useWaitForTransactionReceipt({
    hash,
  })

  // Format balance for display
  const formattedBalance = balance ? formatUSDCAmount(balance) : '0'
  const balanceNumber = parseFloat(formattedBalance)

  // Check if user has sufficient balance
  const hasSufficientBalance = async (requiredUSDC) => {
    if (isBaseApp && baseAccount) {
      // Use Base Account balance check
      const balanceCheck = await checkBaseAccountBalance(requiredUSDC)
      return balanceCheck.hasBalance
    } else {
      // Use Wagmi balance check
      if (!balance) return false
      return balanceNumber >= requiredUSDC
    }
  }

  // Execute payment - automatically chooses best method
  const executePayment = async (usdAmount, cartData) => {
    try {
      setError(null)

      // Basic validation
      if (!isConnected && !isBaseApp) {
        throw new Error('Wallet not connected')
      }

      if (!usdAmount || usdAmount <= 0) {
        throw new Error('Invalid payment amount')
      }

      // Convert USD to USDC amount (1:1 for MVP)
      const usdcAmount = usdToUSDC(usdAmount)

      // Check balance
      const hasBalance = await hasSufficientBalance(usdAmount)
      if (!hasBalance) {
        const currentBalance = isBaseApp ? 
          (await checkBaseAccountBalance(usdAmount)).formattedBalance : 
          balanceNumber.toFixed(2)
        throw new Error(`Insufficient USDC balance. You need ${usdAmount} USDC but only have ${currentBalance} USDC`)
      }

      let result

      if (isBaseApp && baseAccount) {
        // Use Base Account SDK for enhanced experience
        console.log('🚀 Using Base Account SDK for payment')
        setPaymentMethod('base-account')
        
        result = await executeBaseAccountPayment(usdcAmount, PAYMENT_CONFIG.merchantWallet, {
          // Add any additional options for Base Account payment
          metadata: {
            cartData,
            timestamp: new Date().toISOString()
          }
        })
      } else {
        // Use existing Wagmi flow for Farcaster app users
        console.log('🔗 Using Wagmi for payment (Farcaster app)')
        setPaymentMethod('wagmi')
        
        if (!address) {
          throw new Error('No wallet address found')
        }

        console.log('Executing Wagmi USDC payment:', {
          from: address,
          to: PAYMENT_CONFIG.merchantWallet,
          amount: usdAmount,
          usdcAmount: usdcAmount.toString(),
          cartData
        })

        // Execute the transfer using Wagmi
        writeContract({
          address: USDC_CONTRACT.address,
          abi: USDC_CONTRACT.abi,
          functionName: 'transfer',
          args: [PAYMENT_CONFIG.merchantWallet, usdcAmount],
        })

        // Return a promise that resolves when the transaction is confirmed
        return new Promise((resolve, reject) => {
          const checkConfirmation = () => {
            if (isWagmiConfirmed) {
              resolve({
                success: true,
                transactionHash: hash,
                paymentMethod: 'wagmi'
              })
            } else if (writeError) {
              reject(writeError)
            } else {
              // Continue waiting
              setTimeout(checkConfirmation, 1000)
            }
          }
          checkConfirmation()
        })
      }

      return result

    } catch (err) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed')
      throw err
    }
  }

  // Get auto-filled shipping data from Base Account
  const getAutoFilledShippingData = async () => {
    if (isBaseApp && baseAccount) {
      return await getBaseAccountShippingData()
    }
    return null
  }

  // Reset payment state
  const resetPayment = () => {
    setError(null)
    setPaymentMethod(null)
  }

  // Determine payment status based on transaction state
  let paymentStatus = 'idle'
  if (isWagmiPending || (paymentMethod === 'base-account' && baseAccount)) {
    paymentStatus = 'pending'
  } else if (isWagmiConfirming) {
    paymentStatus = 'confirming'
  } else if (isWagmiConfirmed || (paymentMethod === 'base-account' && baseAccount)) {
    paymentStatus = 'success'
  } else if (writeError || error) {
    paymentStatus = 'error'
  }

  return {
    // Payment method info
    isBaseApp,
    paymentMethod,
    baseAccount,
    baseProfile,
    
    // Balance info
    balance: isBaseApp ? 'Base Account' : formattedBalance,
    balanceNumber: isBaseApp ? null : balanceNumber,
    isLoadingBalance: isBaseApp ? false : isLoadingBalance,
    refetchBalance,
    
    // Payment functions
    executePayment,
    hasSufficientBalance,
    getAutoFilledShippingData,
    resetPayment,
    
    // Status
    paymentStatus,
    error,
    
    // Wagmi-specific (for fallback)
    isPending: isWagmiPending,
    isConfirming: isWagmiConfirming,
    isConfirmed: isWagmiConfirmed,
    transactionHash: hash
  }
}
