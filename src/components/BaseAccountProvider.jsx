'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

const BaseAccountContext = createContext({
  isBaseApp: false,
  baseAccount: null,
  baseProfile: null,
  isLoading: true,
  error: null
})

export function useBaseAccount() {
  const context = useContext(BaseAccountContext)
  if (!context) {
    throw new Error('useBaseAccount must be used within BaseAccountProvider')
  }
  return context
}

export function BaseAccountProvider({ children }) {
  const { address, isConnected, connector } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  
  const [baseProfile, setBaseProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Check if we're using the Base Account connector
  const isBaseApp = connector?.id === 'baseAccount'
  const baseAccountConnector = connectors.find(c => c.id === 'baseAccount')

  useEffect(() => {
    async function initBaseProfile() {
      if (isBaseApp && isConnected && connector) {
        setIsLoading(true)
        setError(null)
        try {
          console.log('🚀 Base Account connected, getting profile...')
          
          // Get profile from Base Account connector
          if (connector.getProfile) {
            const profile = await connector.getProfile()
            setBaseProfile(profile)
            console.log('👤 Base Account profile loaded:', {
              hasEmail: !!profile?.email,
              hasShippingAddress: !!profile?.shippingAddress,
              hasPhone: !!profile?.phone
            })
          }
        } catch (err) {
          console.error('❌ Failed to get Base Account profile:', err)
          setError(err.message)
          setBaseProfile(null)
        }
        setIsLoading(false)
      } else {
        setBaseProfile(null)
        setError(null)
      }
    }

    initBaseProfile()
  }, [isBaseApp, isConnected, connector])

  const connectBaseAccount = async () => {
    if (baseAccountConnector) {
      try {
        await connect({ connector: baseAccountConnector })
      } catch (error) {
        console.error('Failed to connect Base Account:', error)
        setError(error.message)
      }
    }
  }

  const value = {
    isBaseApp,
    baseAccount: isBaseApp ? connector : null,
    baseProfile,
    isLoading,
    error,
    connectBaseAccount,
    disconnect
  }

  return (
    <BaseAccountContext.Provider value={value}>
      {children}
    </BaseAccountContext.Provider>
  )
}
