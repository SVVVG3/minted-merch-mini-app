'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useConnect, useAccount, useDisconnect } from 'wagmi'

const BaseAccountContext = createContext({
  isBaseApp: false,
  baseAccountConnector: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    
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
      console.log('✅ Base Account authenticated:', wagmiHooks.address)
    } else {
      setIsAuthenticated(false)
    }
  }, [wagmiHooks.isConnected, wagmiHooks.connector, wagmiHooks.address])

  const signInWithBase = async () => {
    if (!baseAccountConnector || !wagmiHooks.connectAsync) {
      throw new Error('Base Account connector not found')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔄 Starting Base Account sign-in...')
      
      // 1. Generate a fresh nonce
      const nonce = window.crypto.randomUUID().replace(/-/g, '')
      
      // 2. Connect and get the provider
      await wagmiHooks.connectAsync({ connector: baseAccountConnector })
      const provider = baseAccountConnector.provider

      // 3. Authenticate with wallet_connect
      const authResult = await provider.request({
        method: 'wallet_connect',
        params: [{
          version: '1',
          capabilities: {
            signInWithEthereum: { 
              nonce, 
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

      // 4. TODO: Verify signature on backend
      // await fetch('/auth/verify', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ address, message, signature })
      // })

    } catch (err) {
      console.error('❌ Base Account sign-in failed:', err)
      setError(err.message || 'Sign in failed')
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
    signInWithBase,
    signOut
  }

  return (
    <BaseAccountContext.Provider value={value}>
      {children}
    </BaseAccountContext.Provider>
  )
}
