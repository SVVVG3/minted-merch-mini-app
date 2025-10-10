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
          console.log('🚀 Base Account SDK available via CDN:', Object.keys(window.base))
          
          // Check if user is already authenticated
          // Note: getProfile might not be available or might be named differently
          try {
            // Try different possible profile methods
            let profile = null
            if (window.base.getProfile) {
              profile = await window.base.getProfile()
            } else if (window.base.profile) {
              profile = await window.base.profile()
            } else if (window.base.getUserProfile) {
              profile = await window.base.getUserProfile()
            }
            
            if (profile) {
              setBaseProfile(profile)
              setIsAuthenticated(true)
              console.log('👤 Base Account profile loaded:', {
                hasEmail: !!profile?.email,
                hasShippingAddress: !!profile?.shippingAddress,
                hasPhone: !!profile?.phone
              })
            } else {
              console.log('👤 No profile found - user not authenticated yet')
              setBaseProfile(null)
              setIsAuthenticated(false)
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

    // Try to initialize immediately
    initBaseAccount()
    
    // Also set up a retry mechanism in case SDK loads after component
    const retryInterval = setInterval(() => {
      if (typeof window !== 'undefined' && window.base && window.base.pay && !baseAccount) {
        console.log('🔄 Retrying Base Account initialization...')
        initBaseAccount()
        clearInterval(retryInterval)
      }
    }, 1000)
    
    // Clear interval after 10 seconds
    setTimeout(() => clearInterval(retryInterval), 10000)
    
    return () => clearInterval(retryInterval)
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
      // Try different possible profile methods
      let profile = null
      if (window.base.getProfile) {
        profile = await window.base.getProfile()
      } else if (window.base.profile) {
        profile = await window.base.profile()
      } else if (window.base.getUserProfile) {
        profile = await window.base.getUserProfile()
      }
      
      if (profile) {
        setBaseProfile(profile)
        setIsAuthenticated(true)
        console.log('✅ Base Account authentication successful:', {
          address,
          hasEmail: !!profile?.email,
          hasShippingAddress: !!profile?.shippingAddress,
          hasPhone: !!profile?.phone
        })
      } else {
        // Even without profile, we can consider them authenticated if they have an address
        setIsAuthenticated(true)
        console.log('✅ Base Account authentication successful (no profile available):', {
          address
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
