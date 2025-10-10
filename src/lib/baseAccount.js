import { createBaseAccountSDK } from '@base-org/account'

/**
 * Base Account SDK integration
 * Provides enhanced payment and profile features for Base app users
 * while maintaining compatibility with existing Wagmi flow
 */

// Detect if user is actually in Base app (not Farcaster)
export function isBaseAppEnvironment() {
  if (typeof window === 'undefined') return false
  
  // Check user agent to determine actual environment
  const userAgent = window.navigator?.userAgent?.toLowerCase() || ''
  
  // If we're in Farcaster/Warpcast, we're NOT in Base app
  if (userAgent.includes('warpcast') || userAgent.includes('farcaster')) {
    return false
  }
  
  // Check if we're actually in Base app environment
  // Base app should have specific user agent indicators
  const isBaseApp = userAgent.includes('base') || 
                    window.location?.hostname?.includes('base.app') ||
                    window.location?.search?.includes('base_app=true')
  
  // Also check if Base Account SDK is available AND we're in Base app
  const hasBaseSDK = !!(window.base && window.base.pay && window.base.getPaymentStatus)
  
  return isBaseApp && hasBaseSDK
}

// Get Base Account SDK instance if available
export async function getBaseAccountSDK() {
  try {
    // If using CDN, window.base is already the SDK instance
    if (typeof window !== 'undefined' && window.base && window.base.pay) {
      return window.base // Directly return the global Base Account SDK instance
    }
    
    // Fallback for NPM package usage (if needed in future)
    if (!isBaseAppEnvironment()) {
      return null
    }
    
    const sdk = await createBaseAccountSDK()
    return sdk
  } catch (error) {
    console.log('Base Account SDK not available:', error.message)
    return null
  }
}

// Get Base Account instance
export async function getBaseAccount() {
  try {
    const sdk = await getBaseAccountSDK()
    if (!sdk) return null
    
    // The SDK itself is the account instance
    return sdk
  } catch (error) {
    console.log('Base Account not available:', error.message)
    return null
  }
}

// Enhanced payment function using Base Account SDK
export async function executeBaseAccountPayment(amount, recipient, options = {}) {
  try {
    if (!isBaseAppEnvironment()) {
      throw new Error('Base Account not available')
    }
    
    console.log('💳 Executing Base Account payment:', {
      amount,
      recipient
    })
    
    // Execute one-tap payment using window.base API
    const result = await window.base.pay({
      amount: amount.toString(), // USD amount - SDK quotes equivalent USDC
      to: recipient,
      testnet: false // Set to true for testnet
    })
    
    console.log('✅ Base Account payment initiated:', result)
    
    // Get payment status
    const status = await window.base.getPaymentStatus({
      id: result.id,
      testnet: false
    })
    
    console.log('✅ Base Account payment status:', status)
    
    return {
      success: true,
      paymentId: result.id,
      status: status.status,
      transactionHash: status.transactionHash || result.id
    }
  } catch (error) {
    console.error('❌ Base Account payment failed:', error)
    throw error
  }
}

// Get user profile data from Base Account
export async function getBaseAccountProfile() {
  try {
    const account = await getBaseAccount()
    if (!account) return null
    
    const profile = await account.getProfile()
    return profile
  } catch (error) {
    console.log('Base Account profile not available:', error.message)
    return null
  }
}

// Auto-fill shipping data from Base profile
export async function getBaseAccountShippingData() {
  try {
    const profile = await getBaseAccountProfile()
    if (!profile?.shippingAddress) return null
    
    const shippingData = {
      firstName: profile.shippingAddress.firstName || '',
      lastName: profile.shippingAddress.lastName || '',
      address1: profile.shippingAddress.address1 || '',
      address2: profile.shippingAddress.address2 || '',
      city: profile.shippingAddress.city || '',
      province: profile.shippingAddress.province || '',
      zip: profile.shippingAddress.zip || '',
      country: profile.shippingAddress.country || 'US',
      phone: profile.shippingAddress.phone || '',
      email: profile.email || ''
    }
    
    console.log('📦 Base Account shipping data:', shippingData)
    return shippingData
  } catch (error) {
    console.log('Base Account shipping data not available:', error.message)
    return null
  }
}

// Check if Base Account has sufficient USDC balance
export async function checkBaseAccountBalance(requiredAmount) {
  try {
    const account = await getBaseAccount()
    if (!account) return { hasBalance: false, balance: 0 }
    
    const balance = await account.getBalance('USDC')
    const hasBalance = parseFloat(balance) >= parseFloat(requiredAmount)
    
    return {
      hasBalance,
      balance: parseFloat(balance),
      formattedBalance: balance
    }
  } catch (error) {
    console.log('Base Account balance check failed:', error.message)
    return { hasBalance: false, balance: 0 }
  }
}

// Debug function to check Base Account availability
export function debugBaseAccount() {
  if (typeof window === 'undefined') {
    console.log('🔍 Base Account Debug: Server-side rendering')
    return { available: false, reason: 'Server-side rendering' }
  }
  
  const userAgent = window.navigator?.userAgent?.toLowerCase() || ''
  const isFarcaster = userAgent.includes('warpcast') || userAgent.includes('farcaster')
  const isBaseApp = userAgent.includes('base') || 
                    window.location?.hostname?.includes('base.app') ||
                    window.location?.search?.includes('base_app=true')
  
  const debug = {
    hasWindow: typeof window !== 'undefined',
    hasBase: !!window.base,
    hasPay: !!(window.base && window.base.pay),
    hasGetPaymentStatus: !!(window.base && window.base.getPaymentStatus),
    userAgent: window.navigator?.userAgent,
    hostname: window.location?.hostname,
    baseObject: window.base ? Object.keys(window.base) : null,
    environment: {
      isFarcaster,
      isBaseApp,
      detectedEnvironment: isFarcaster ? 'Farcaster' : (isBaseApp ? 'Base App' : 'Unknown')
    },
    available: !!(window.base && window.base.pay && window.base.getPaymentStatus && isBaseApp && !isFarcaster),
    baseAccountInstance: window.base ? 'Available' : 'Not Available'
  }
  
  console.log('🔍 Base Account Debug:', debug)
  return debug
}
