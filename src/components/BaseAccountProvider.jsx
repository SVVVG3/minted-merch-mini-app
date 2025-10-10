'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { isBaseAppEnvironment, getBaseAccount, getBaseAccountProfile } from '@/lib/baseAccount'

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
    async function initializeBaseAccount() {
      try {
        setIsLoading(true)
        setError(null)

        // Check if we're in Base app environment
        const inBaseApp = isBaseAppEnvironment()
        setIsBaseApp(inBaseApp)

        if (!inBaseApp) {
          console.log('🔗 Not in Base app environment, using standard Wagmi flow')
          setIsLoading(false)
          return
        }

        console.log('🚀 Base app environment detected, initializing Base Account...')

        // Get Base Account
        const account = await getBaseAccount()
        if (account) {
          setBaseAccount(account)
          console.log('✅ Base Account initialized:', account.address)

          // Get profile data
          const profile = await getBaseAccountProfile()
          if (profile) {
            setBaseProfile(profile)
            console.log('👤 Base Account profile loaded:', {
              hasEmail: !!profile.email,
              hasShippingAddress: !!profile.shippingAddress,
              hasPhone: !!profile.phone
            })
          }
        } else {
          console.log('⚠️ Base Account not available, falling back to Wagmi')
        }
      } catch (err) {
        console.error('❌ Base Account initialization failed:', err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    initializeBaseAccount()
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
