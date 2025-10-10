'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createBaseAccountSDK } from '@base-org/account'

const BaseAccountContext = createContext({
  isBaseApp: false,
  baseAccountSDK: null,
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
  const [baseAccountSDK, setBaseAccountSDK] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function initBaseAccount() {
      try {
        setIsLoading(true)
        setError(null)

        // Check if we're in a Base app environment
        const userAgent = window.navigator?.userAgent?.toLowerCase() || ''
        const isFarcaster = userAgent.includes('warpcast') || userAgent.includes('farcaster')
        
        if (isFarcaster) {
          setIsBaseApp(false)
          setBaseAccountSDK(null)
          console.log('🔗 In Farcaster environment, Base Account not available')
          return
        }

        // Try to create Base Account SDK
        try {
          const sdk = await createBaseAccountSDK({
            appName: 'Minted Merch',
            appLogoUrl: 'https://app.mintedmerch.shop/logo.png',
          })
          
          setIsBaseApp(true)
          setBaseAccountSDK(sdk)
          console.log('🚀 Base Account SDK created successfully')
          
          // Check if user is already authenticated
          try {
            const profile = await sdk.getProfile()
            if (profile) {
              setIsAuthenticated(true)
              console.log('✅ Base Account profile found (already authenticated):', {
                hasEmail: !!profile?.email,
                hasShippingAddress: !!profile?.shippingAddress,
                hasPhone: !!profile?.phone
              })
            } else {
              setIsAuthenticated(false)
              console.log('👤 No profile found - user not authenticated yet')
            }
          } catch (profileError) {
            console.log('User not authenticated yet:', profileError.message)
            setIsAuthenticated(false)
          }
          
        } catch (sdkError) {
          console.log('Base Account SDK not available:', sdkError.message)
          setIsBaseApp(false)
          setBaseAccountSDK(null)
          setIsAuthenticated(false)
        }

      } catch (err) {
        console.error('❌ Base Account initialization failed:', err)
        setError(err.message)
        setIsBaseApp(false)
        setBaseAccountSDK(null)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    if (typeof window !== 'undefined') {
      initBaseAccount()
    }
  }, [])

  const signInWithBase = async () => {
    if (!baseAccountSDK) {
      throw new Error('Base Account SDK not available')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔄 Starting Base Account sign-in...')
      
      // 1. Generate a fresh nonce
      const nonce = window.crypto.randomUUID().replace(/-/g, '')
      
      // 2. Get the provider from the SDK
      const provider = baseAccountSDK.getProvider()

      // 3. Switch to Base Chain
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: '0x2105' }], // Base Mainnet
      })

      // 4. Authenticate with wallet_connect
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

      // 5. Get profile after authentication
      try {
        const profile = await baseAccountSDK.getProfile()
        if (profile) {
          setIsAuthenticated(true)
          console.log('✅ Base Account profile loaded:', {
            hasEmail: !!profile?.email,
            hasShippingAddress: !!profile?.shippingAddress,
            hasPhone: !!profile?.phone
          })
        } else {
          setIsAuthenticated(true) // Still authenticated even without profile
          console.log('✅ Base Account authenticated (no profile available)')
        }
      } catch (profileError) {
        setIsAuthenticated(true) // Still authenticated even if profile fails
        console.log('✅ Base Account authenticated (profile unavailable)')
      }

      // 6. TODO: Verify signature on backend
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
    setIsAuthenticated(false)
    console.log('👋 Base Account signed out')
  }

  const value = {
    isBaseApp,
    baseAccountSDK,
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
