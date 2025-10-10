'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createBaseAccountSDK, pay, getPaymentStatus } from '@base-org/account'

const BaseAccountContext = createContext({
  isBaseApp: false,
  baseAccountSDK: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  preGeneratedNonce: null,
  baseAccountProfile: null,
  debugInfo: '',
  userAddress: null,
  signInWithBase: null,
  signOut: null,
  fetchBaseAccountProfile: null,
  payWithBase: null
})

export function useBaseAccount() {
  const context = useContext(BaseAccountContext)
  if (!context) {
    console.warn('useBaseAccount used outside of BaseAccountProvider, returning default values')
    return {
      isBaseApp: false,
      baseAccountSDK: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      preGeneratedNonce: null,
      baseAccountProfile: null,
      debugInfo: '',
      userAddress: null,
      signInWithBase: null,
      signOut: null,
      fetchBaseAccountProfile: null,
      payWithBase: null
    }
  }
  return context
}

export function BaseAccountProvider({ children }) {
  const [isBaseApp, setIsBaseApp] = useState(false)
  const [baseAccountSDK, setBaseAccountSDK] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [preGeneratedNonce, setPreGeneratedNonce] = useState(null)
  const [baseAccountProfile, setBaseAccountProfile] = useState(null)
  const [debugInfo, setDebugInfo] = useState('')
  const [userAddress, setUserAddress] = useState(null)

  // Pre-generate nonce on component mount to avoid popup blockers
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Generate a fresh nonce on page load to avoid popup blockers
    const nonce = window.crypto.randomUUID().replace(/-/g, '')
    setPreGeneratedNonce(nonce)
    console.log('🔑 Pre-generated nonce for Base Account:', nonce)
  }, [])

  // Initialize Base Account SDK
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const initializeBaseAccount = async () => {
      try {
        // Check if we're in Farcaster (disable Base Account)
        const userAgent = window.navigator?.userAgent?.toLowerCase() || ''
        const isFarcaster = userAgent.includes('warpcast') || userAgent.includes('farcaster')
        
        if (isFarcaster) {
          setIsBaseApp(false)
          setBaseAccountSDK(null)
          setDebugInfo(prev => prev + '\n🔗 In Farcaster environment, Base Account disabled')
          return
        }
        
        // Check if we're in the Base app (users are already authenticated)
        const isBaseApp = userAgent.includes('base') || window.location.hostname.includes('base')
        if (isBaseApp) {
          console.log('📱 Running in Base app - users are already authenticated')
          setDebugInfo(prev => prev + '\n📱 Base app detected - users already authenticated')
          // Don't return here - we still want to initialize the SDK for Base Pay
        }
        
        // Check for Ethereum provider availability
        const hasEthereum = typeof window.ethereum !== 'undefined'
        const isInIframe = window !== window.top
        
        // In iframe environments (like Farcaster), Base Account may not work due to cross-origin restrictions
        if (isInIframe) {
          console.log('📱 Running in iframe environment - Base Account may be restricted')
          setIsBaseApp(false)
          setBaseAccountSDK(null)
          setDebugInfo(prev => prev + `\n📱 Iframe environment detected - Base Account disabled due to cross-origin restrictions`)
          return
        }
        
        if (!hasEthereum) {
          console.log('⚠️ No Ethereum provider detected')
          setIsBaseApp(false)
          setBaseAccountSDK(null)
          setDebugInfo(prev => prev + `\n🔒 No Ethereum provider available`)
          return
        }
        
        // Initialize Base Account SDK with proper configuration
        const sdk = createBaseAccountSDK({
          appName: 'Minted Merch',
          appLogoUrl: 'https://app.mintedmerch.shop/logo.png',
          appChainIds: ['0x2105'], // Base mainnet chain ID
        })
        
        setIsBaseApp(true)
        setBaseAccountSDK(sdk)
        setDebugInfo(prev => prev + '\n🚀 Base Account SDK initialized')
        
        console.log('✅ Base Account SDK initialized:', sdk)
      } catch (error) {
        console.log('Base Account SDK initialization failed:', error.message)
        setIsBaseApp(false)
        setBaseAccountSDK(null)
        setDebugInfo(prev => prev + '\n❌ Base Account SDK failed: ' + error.message)
      }
    }
    
    initializeBaseAccount()
  }, [])

  const signInWithBase = async () => {
    if (!baseAccountSDK) {
      throw new Error('Base Account SDK not found')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔄 Starting Base Account sign-in...')
      
      // Check if we're in a restricted environment (iframe, CSP, etc.)
      if (typeof window !== 'undefined' && !window.ethereum) {
        console.log('⚠️ No window.ethereum detected - may be in restricted environment')
        throw new Error('Base Account requires access to Ethereum provider. Please ensure you have a wallet extension installed.')
      }
      
      // Use the proper Base Account wallet_connect method with signInWithEthereum
      // This will open a popup to keys.coinbase.com
      
      // 1. Switch to Base Chain first
      await baseAccountSDK.getProvider().request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: '0x2105' }], // Base Mainnet
      })
      
      // 2. Connect and authenticate with signInWithEthereum
      const { accounts } = await baseAccountSDK.getProvider().request({
        method: 'wallet_connect',
        params: [{
          version: '1',
          capabilities: {
            signInWithEthereum: { 
              nonce: preGeneratedNonce, 
              chainId: '0x2105' // Base Mainnet - 8453
            }
          }
        }]
      })
      
      const { address } = accounts[0]
      const { message, signature } = accounts[0].capabilities.signInWithEthereum
      
      console.log('✅ Base Account authentication successful:', {
        address,
        message: message.substring(0, 50) + '...',
        signature: signature.substring(0, 10) + '...'
      })
      
      // Set authentication state
      setUserAddress(address)
      
      // TODO: Verify signature on backend
      // await fetch('/auth/verify', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ address, message, signature })
      // })
      
      console.log('✅ Base Account sign-in successful')
      
      // Set authentication state
      setIsAuthenticated(true)

    } catch (err) {
      console.error('❌ Base Account sign-in failed:', err)
      
      // Handle specific error cases
      if (err.message?.includes('cross-origin') || err.message?.includes('Blocked a frame')) {
        setError('Base Account popup was blocked. Please allow popups for this site and try again.')
      } else if (err.message?.includes('popup') || err.message?.includes('window')) {
        setError('Popup blocked. Please allow popups for this site and try again.')
      } else if (err.message?.includes('User rejected') || err.code === 4001) {
        setError('Sign-in cancelled by user.')
      } else if (err.message?.includes('method_not_supported')) {
        setError('Base Account is not supported in this wallet. Please use a compatible wallet.')
      } else if (err.message?.includes('Ethereum provider')) {
        setError('Base Account requires access to Ethereum provider. Please ensure you have a wallet extension installed.')
      } else {
        setError(err.message || 'Base Account sign-in failed')
      }
      
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = () => {
    setIsAuthenticated(false)
    setBaseAccountProfile(null)
    setUserAddress(null)
    console.log('👋 Base Account signed out')
  }

  // Base Pay function using the official SDK with payerInfo
  const payWithBase = async (amount, recipient) => {
    if (!baseAccountSDK) {
      throw new Error('Base Account SDK not found')
    }

    try {
      console.log('💳 Executing Base Pay:', { amount, recipient })
      
      // Use the official pay function from the SDK - no payerInfo needed since users already have info in Base Account
      const payment = await pay({
        amount: amount.toString(), // USD amount - SDK quotes equivalent USDC
        to: recipient,
        testnet: false // Set to true for testnet
      })
      
      console.log('✅ Base Pay initiated:', payment.id)
      
      // Get payment status
      const { status } = await getPaymentStatus({ 
        id: payment.id,
        testnet: false 
      })
      
      console.log('✅ Base Pay status:', status)
      
      return {
        success: true,
        paymentId: payment.id,
        status: status,
        transactionHash: payment.id // The payment ID can be used as transaction reference
      }
    } catch (error) {
      console.error('❌ Base Pay failed:', error)
      throw error
    }
  }

  // Fetch Base Account profile data using payerInfo
  const fetchBaseAccountProfile = async () => {
    if (!isAuthenticated || !baseAccountSDK) {
      setDebugInfo(prev => prev + '\n❌ Cannot fetch profile: not authenticated or no SDK')
      return null
    }

    try {
      setDebugInfo(prev => prev + '\n🔍 Fetching Base Account profile...')
      
      // Use a dummy payment to collect user info
      const payment = await baseAccountSDK.pay({
        amount: '0.01', // Minimal amount
        to: userAddress, // Pay to self
        payerInfo: {
          requests: [
            { type: 'email' },
            { type: 'phoneNumber', optional: true },
            { type: 'physicalAddress', optional: true }
          ]
        },
        testnet: false
      })
      
      if (payment.payerInfoResponses) {
        setDebugInfo(prev => prev + '\n✅ Base Account profile fetched!')
        setBaseAccountProfile(payment.payerInfoResponses)
        return payment.payerInfoResponses
      } else {
        setDebugInfo(prev => prev + '\n❌ No profile data returned')
        return null
      }
    } catch (error) {
      setDebugInfo(prev => prev + '\n❌ Failed to fetch Base Account profile: ' + error.message)
      return null
    }
  }

  const value = {
    isBaseApp,
    baseAccountSDK,
    isAuthenticated,
    isLoading,
    error,
    preGeneratedNonce,
    baseAccountProfile,
    debugInfo,
    userAddress,
    signInWithBase,
    signOut,
    fetchBaseAccountProfile,
    payWithBase
  }

  return (
    <BaseAccountContext.Provider value={value}>
      {children}
    </BaseAccountContext.Provider>
  )
}
