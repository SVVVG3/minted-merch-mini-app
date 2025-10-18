'use client';

import { UniversalConnector } from '@reown/appkit-universal-connector';

/**
 * WalletConnect App SDK integration for desktop and mobile web users
 * Provides wallet connection when not in mini app environments
 */

let universalConnectorInstance = null;

// Get project ID from environment
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  console.warn('⚠️ WalletConnect project ID not found. Please set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID');
}

// Configure Base network for our app
const baseMainnet = {
  id: 8453,
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:8453',
  name: 'Base',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: { 
    default: { http: ['https://mainnet.base.org'] },
    public: { http: ['https://mainnet.base.org'] }
  },
  blockExplorerUrls: { default: { name: 'BaseScan', url: 'https://basescan.org' } }
};

export const networks = [baseMainnet];

// Initialize WalletConnect Universal Connector
export async function initializeWalletConnect() {
  if (universalConnectorInstance) {
    return universalConnectorInstance;
  }

  if (!projectId) {
    console.warn('⚠️ WalletConnect project ID not found. Please set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID');
    return null;
  }

  try {
    // Initialize Universal Connector
    universalConnectorInstance = await UniversalConnector.init({
      projectId,
      metadata: {
        name: 'Minted Merch',
        description: 'Custom merchandise for the crypto community',
        url: 'https://app.mintedmerch.shop',
        icons: ['https://app.mintedmerch.shop/logo.png']
      },
      networks: [
        {
          methods: [
            'eth_accounts',
            'eth_requestAccounts',
            'eth_sendTransaction',
            'eth_signTransaction',
            'eth_sign',
            'personal_sign',
            'eth_signTypedData',
            'eth_signTypedData_v3',
            'eth_signTypedData_v4',
            'wallet_switchEthereumChain',
            'wallet_addEthereumChain',
          ],
          chains: [baseMainnet],
          events: [
            'chainChanged',
            'accountsChanged',
            'connect',
            'disconnect',
          ],
          namespace: 'eip155'
        }
      ]
    });

    console.log('✅ WalletConnect Universal Connector initialized successfully');
    return universalConnectorInstance;
  } catch (error) {
    console.error('❌ Failed to initialize WalletConnect:', error);
    return null;
  }
}

// Get WalletConnect instance
export async function getWalletConnect() {
  if (!universalConnectorInstance) {
    return await initializeWalletConnect();
  }
  return universalConnectorInstance;
}

// Check if we should use WalletConnect (not in mini app environment)
export function shouldUseWalletConnect() {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
  
  // Don't use WalletConnect in mini app environments
  if (userAgent.includes('warpcast') || userAgent.includes('farcaster')) {
    return false;
  }
  
  // Don't use WalletConnect on dGEN1 devices (they have built-in wallet)
  if (userAgent.includes('android') && window.ethereum) {
    // Check for dGEN1-specific properties
    if (window.ethereum.isDgen === true || 
        window.ethereum.isEthereumPhone === true ||
        /dgen1/i.test(userAgent) ||
        /ethereumphone/i.test(userAgent)) {
      console.log('🤖 dGEN1 device detected - using native wallet instead of WalletConnect');
      return false;
    }
  }
  
  // Don't use WalletConnect if we have window.ethereum (browser extension)
  if (window.ethereum && !window.ethereum.isMetaMask) {
    return false;
  }
  
  // Use WalletConnect for desktop/mobile web without wallet extensions
  return true;
}

// Connect wallet using WalletConnect
export async function connectWallet() {
  try {
    const universalConnector = await getWalletConnect();
    if (!universalConnector) {
      throw new Error('WalletConnect not initialized');
    }

    console.log('🔗 Connecting wallet via WalletConnect...');
    
    // Connect using Universal Connector
    const { session } = await universalConnector.connect();
    
    console.log('✅ WalletConnect connection successful:', session);
    return universalConnector;
  } catch (error) {
    console.error('❌ Failed to connect wallet via WalletConnect:', error);
    throw error;
  }
}

// Disconnect wallet
export async function disconnectWallet() {
  try {
    const universalConnector = await getWalletConnect();
    if (!universalConnector) return;

    await universalConnector.disconnect();
    console.log('✅ WalletConnect disconnected successfully');
  } catch (error) {
    console.error('❌ Failed to disconnect WalletConnect:', error);
    throw error;
  }
}

// Get active session
export async function getActiveSession() {
  try {
    const universalConnector = await getWalletConnect();
    if (!universalConnector) return null;
    
    return universalConnector.provider.session;
  } catch (error) {
    console.error('❌ Failed to get active session:', error);
    return null;
  }
}

// Get connected accounts
export async function getConnectedAccounts() {
  try {
    const universalConnector = await getWalletConnect();
    if (!universalConnector) return [];
    
    const session = universalConnector.provider.session;
    if (!session) return [];
    
    // Extract accounts from session namespaces
    const accounts = [];
    if (session.namespaces?.eip155?.accounts) {
      accounts.push(...session.namespaces.eip155.accounts);
    }
    
    return accounts;
  } catch (error) {
    console.error('❌ Failed to get connected accounts:', error);
    return [];
  }
}

// Get wallet provider for transactions
export async function getWalletProvider() {
  try {
    const universalConnector = await getWalletConnect();
    if (!universalConnector) return null;
    
    return universalConnector.provider;
  } catch (error) {
    console.error('❌ Failed to get wallet provider:', error);
    return null;
  }
}

// Check if WalletConnect is available
export function isWalletConnectAvailable() {
  return shouldUseWalletConnect() && !!projectId;
}
