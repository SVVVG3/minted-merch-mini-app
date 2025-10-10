'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useConnect, useAccount, useDisconnect } from 'wagmi'

const BaseAccountContext = createContext({
  isBaseApp: false,
  baseAccountConnector: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  preGeneratedNonce: null,
  signInWithBase: null,
  signOut: null
})

export function useBaseAccount() {
  const context = useContext(BaseAccountContext)
  if (!context) {
    throw new Error('useBaseAccount must be used within BaseAccountProvider')
  }
  return context
}

export function BaseAccountProvider({ children }) {
  const [isBaseApp, setIsBaseApp] = useState(false)
  const [baseAccountConnector, setBaseAccountConnector] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [preGeneratedNonce, setPreGeneratedNonce] = useState(null)

  // Only use Wagmi hooks on client side
  const wagmiHooks = typeof window !== 'undefined' ? {
    isConnected: false,
    address: null,
    connector: null,
    connectAsync: null,
    connectors: [],
    disconnect: null
  } : {
    isConnected: false,
    address: null,
    connector: null,
    connectAsync: null,
    connectors: [],
    disconnect: null
  }

  // Use Wagmi hooks only on client side
  if (typeof window !== 'undefined') {
    try {
      const { isConnected, address, connector } = useAccount()
      const { connectAsync, connectors } = useConnect()
      const { disconnect } = useDisconnect()
      
      wagmiHooks.isConnected = isConnected
      wagmiHooks.address = address
      wagmiHooks.connector = connector
      wagmiHooks.connectAsync = connectAsync
      wagmiHooks.connectors = connectors
      wagmiHooks.disconnect = disconnect
    } catch (error) {
      console.log('Wagmi hooks not available during SSR:', error.message)
    }
  }

  // Pre-generate nonce on component mount to avoid popup blockers
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Generate a fresh nonce on page load to avoid popup blockers
    const nonce = window.crypto.randomUUID().replace(/-/g, '')
    setPreGeneratedNonce(nonce)
    console.log('🔑 Pre-generated nonce for Base Account:', nonce)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Check if we're actually in Base app environment
    const userAgent = window.navigator?.userAgent?.toLowerCase() || ''
    const isFarcaster = userAgent.includes('warpcast') || userAgent.includes('farcaster')
    
    // Only enable Base Account in Base app, not Farcaster
    if (isFarcaster) {
      setIsBaseApp(false)
      setBaseAccountConnector(null)
      console.log('🔗 In Farcaster environment, Base Account disabled')
      return
    }
    
    // Debug: Log all available connectors
    console.log('🔍 Available Wagmi connectors:', wagmiHooks.connectors.map(c => ({ id: c.id, name: c.name })))
    
    // Find the Base Account connector
    const baseConnector = wagmiHooks.connectors.find(connector => connector.id === 'baseAccount')
    
    if (baseConnector) {
      setIsBaseApp(true)
      setBaseAccountConnector(baseConnector)
      console.log('🚀 Base Account connector found:', baseConnector.id)
    } else {
      setIsBaseApp(false)
      setBaseAccountConnector(null)
      console.log('🔗 Base Account connector not available')
    }
  }, [wagmiHooks.connectors])

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Check if user is authenticated with Base Account
    if (wagmiHooks.isConnected && wagmiHooks.connector?.id === 'baseAccount') {
      setIsAuthenticated(true)
      console.log('✅ Base Account authenticated via Wagmi:', wagmiHooks.address)
    } else {
      // Also check if Base Account is auto-authenticated in Base app
      // This can happen when Base app automatically connects users
      if (isBaseApp && baseAccountConnector && wagmiHooks.isConnected) {
        console.log('🔍 Checking for auto-authentication in Base app...')
        setIsAuthenticated(true)
        console.log('✅ Base Account auto-authenticated in Base app:', wagmiHooks.address)
      } else {
        setIsAuthenticated(false)
        console.log('❌ Base Account not authenticated')
      }
    }
  }, [wagmiHooks.isConnected, wagmiHooks.connector, wagmiHooks.address, isBaseApp, baseAccountConnector])

  const signInWithBase = async () => {
    if (!baseAccountConnector || !wagmiHooks.connectAsync) {
      throw new Error('Base Account connector not found')
    }

    if (!preGeneratedNonce) {
      throw new Error('Nonce not ready. Please wait a moment and try again.')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔄 Starting Base Account sign-in...')
      console.log('🔑 Using pre-generated nonce:', preGeneratedNonce)
      
      // 1. Connect and get the provider
      console.log('🔗 Connecting to Base Account...')
      await wagmiHooks.connectAsync({ connector: baseAccountConnector })
      const provider = baseAccountConnector.provider

      console.log('✅ Connected to Base Account, starting authentication...')

      // 2. Authenticate with wallet_connect using pre-generated nonce
      const authResult = await provider.request({
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

      const { accounts } = authResult
      const { address, capabilities } = accounts[0]
      const { message, signature } = capabilities.signInWithEthereum

      console.log('✅ Base Account authentication successful:', {
        address,
        message,
        signature: signature.substring(0, 10) + '...'
      })

      // 3. TODO: Verify signature on backend
      // await fetch('/auth/verify', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ address, message, signature })
      // })

    } catch (err) {
      console.error('❌ Base Account sign-in failed:', err)
      
      // Handle specific error cases
      if (err.message?.includes('popup') || err.message?.includes('window')) {
        setError('Popup blocked. Please allow popups for this site and try again.')
      } else if (err.message?.includes('User rejected')) {
        setError('Sign-in cancelled by user.')
      } else {
        setError(err.message || 'Sign in failed')
      }
      
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = () => {
    if (wagmiHooks.disconnect) {
      wagmiHooks.disconnect()
    }
    setIsAuthenticated(false)
    console.log('👋 Base Account signed out')
  }

  const value = {
    isBaseApp,
    baseAccountConnector,
    isAuthenticated,
    isLoading,
    error,
    preGeneratedNonce,
    signInWithBase,
    signOut
  }

  return (
    <BaseAccountContext.Provider value={value}>
      {children}
    </BaseAccountContext.Provider>
  )
}
