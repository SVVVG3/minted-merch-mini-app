import { getProvider } from '@base-org/account'

/**
 * Base Account SDK integration
 * Provides enhanced payment and profile features for Base app users
 * while maintaining compatibility with existing Wagmi flow
 */

// Detect if user is in Base app environment
export function isBaseAppEnvironment() {
  if (typeof window === 'undefined') return false
  
  // Check for Base app user agent or hostname
  const isBaseApp = window.location.hostname.includes('base.app') || 
                    window.navigator.userAgent.includes('Base') ||
                    window.location.search.includes('base_app=true')
  
  return isBaseApp
}

// Get Base Account provider if available
export async function getBaseAccountProvider() {
  try {
    if (!isBaseAppEnvironment()) {
      return null
    }
    
    const provider = await getProvider()
    return provider
  } catch (error) {
    console.log('Base Account provider not available:', error.message)
    return null
  }
}

// Get Base Account instance
export async function getBaseAccount() {
  try {
    const provider = await getBaseAccountProvider()
    if (!provider) return null
    
    const account = await provider.getAccount()
    return account
  } catch (error) {
    console.log('Base Account not available:', error.message)
    return null
  }
}

// Enhanced payment function using Base Account SDK
export async function executeBaseAccountPayment(amount, recipient, options = {}) {
  try {
    const account = await getBaseAccount()
    if (!account) {
      throw new Error('Base Account not available')
    }
    
    console.log('💳 Executing Base Account payment:', {
      amount,
      recipient,
      accountAddress: account.address
    })
    
    // Execute one-tap payment
    const result = await account.pay({
      amount: amount.toString(),
      currency: 'USDC',
      recipient: recipient,
      ...options
    })
    
    console.log('✅ Base Account payment successful:', result)
    return {
      success: true,
      transactionHash: result.transactionHash,
      account: account
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
