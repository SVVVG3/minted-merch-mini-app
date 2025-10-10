'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const BaseAccountContext = createContext({
  isBaseApp: false,
  baseAccount: null,
  baseProfile: null,
  isAuthenticated: false,
  isLoading: true,
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
  const [baseAccount, setBaseAccount] = useState(null)
  const [baseProfile, setBaseProfile] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function initBaseAccount() {
      try {
        setIsLoading(true)
        setError(null)

        // Check if Base Account SDK is available via CDN
        if (typeof window !== 'undefined' && window.base && window.base.pay) {
          setIsBaseApp(true)
          setBaseAccount(window.base)
          console.log('🚀 Base Account SDK available via CDN')
          
          // Check if user is already authenticated
          try {
            if (window.base.getProfile) {
              const profile = await window.base.getProfile()
              if (profile) {
                setBaseProfile(profile)
                setIsAuthenticated(true)
                console.log('👤 Base Account profile loaded:', {
                  hasEmail: !!profile?.email,
                  hasShippingAddress: !!profile?.shippingAddress,
                  hasPhone: !!profile?.phone
                })
              }
            }
          } catch (profileError) {
            console.log('User not authenticated yet:', profileError.message)
            setBaseProfile(null)
            setIsAuthenticated(false)
          }
        } else {
          setIsBaseApp(false)
          setBaseAccount(null)
          setBaseProfile(null)
          setIsAuthenticated(false)
          console.log('🔗 Base Account SDK not available, using standard flow')
        }
      } catch (err) {
        console.error('❌ Base Account initialization failed:', err)
        setError(err.message)
        setIsBaseApp(false)
        setBaseAccount(null)
        setBaseProfile(null)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    initBaseAccount()
  }, [])

  const signInWithBase = async () => {
    if (!baseAccount) {
      throw new Error('Base Account SDK not available')
    }

    try {
      setIsLoading(true)
      setError(null)

      // Generate a fresh nonce
      const nonce = window.crypto.randomUUID().replace(/-/g, '')
      
      // Create Base Account SDK provider
      const provider = window.createBaseAccountSDK({
        appName: 'Minted Merch',
        appLogoUrl: 'https://app.mintedmerch.shop/logo.png',
      }).getProvider()

      // Switch to Base Chain
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: '0x2105' }], // Base Mainnet
      })

      // Connect and authenticate
      const { accounts } = await provider.request({
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

      const { address } = accounts[0]
      const { message, signature } = accounts[0].capabilities.signInWithEthereum

      // Get profile after authentication
      if (window.base.getProfile) {
        const profile = await window.base.getProfile()
        setBaseProfile(profile)
        setIsAuthenticated(true)
        console.log('✅ Base Account authentication successful:', {
          address,
          hasEmail: !!profile?.email,
          hasShippingAddress: !!profile?.shippingAddress,
          hasPhone: !!profile?.phone
        })
      }

    } catch (err) {
      console.error('❌ Base Account sign-in failed:', err)
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = () => {
    setBaseProfile(null)
    setIsAuthenticated(false)
    console.log('👋 Base Account signed out')
  }

  const value = {
    isBaseApp,
    baseAccount,
    baseProfile,
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
