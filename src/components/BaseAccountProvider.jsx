'use client'

import { createContext, useContext, useEffect, useState } from 'react'

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
  const [isBaseApp, setIsBaseApp] = useState(false)
  const [baseAccount, setBaseAccount] = useState(null)
  const [baseProfile, setBaseProfile] = useState(null)
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
          
          // Try to get profile if available
          try {
            if (window.base.getProfile) {
              const profile = await window.base.getProfile()
              setBaseProfile(profile)
              console.log('👤 Base Account profile loaded:', {
                hasEmail: !!profile?.email,
                hasShippingAddress: !!profile?.shippingAddress,
                hasPhone: !!profile?.phone
              })
            }
          } catch (profileError) {
            console.log('Profile not available:', profileError.message)
            setBaseProfile(null)
          }
        } else {
          setIsBaseApp(false)
          setBaseAccount(null)
          setBaseProfile(null)
          console.log('🔗 Base Account SDK not available, using standard flow')
        }
      } catch (err) {
        console.error('❌ Base Account initialization failed:', err)
        setError(err.message)
        setIsBaseApp(false)
        setBaseAccount(null)
        setBaseProfile(null)
      } finally {
        setIsLoading(false)
      }
    }

    initBaseAccount()
  }, [])

  const value = {
    isBaseApp,
    baseAccount,
    baseProfile,
    isLoading,
    error
  }

  return (
    <BaseAccountContext.Provider value={value}>
      {children}
    </BaseAccountContext.Provider>
  )
}
