'use client';

import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';

/**
 * WalletConnect integration for desktop and mobile web users
 * Provides wallet connection when not in mini app environments
 */

let walletKitInstance = null;
let coreInstance = null;

// Initialize WalletConnect Core and WalletKit
export async function initializeWalletConnect() {
  if (walletKitInstance) {
    return walletKitInstance;
  }

  try {
    // Get project ID from environment
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
    
    if (!projectId) {
      console.warn('⚠️ WalletConnect project ID not found. Please set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID');
      return null;
    }

    // Create Core instance
    coreInstance = new Core({
      projectId,
    });

    // Initialize WalletKit
    walletKitInstance = await WalletKit.init({
      core: coreInstance,
      metadata: {
        name: 'Minted Merch',
        description: 'Custom merchandise for the crypto community',
        url: 'https://app.mintedmerch.shop',
        icons: ['https://app.mintedmerch.shop/logo.png'],
      },
    });

    console.log('✅ WalletConnect initialized successfully');
    return walletKitInstance;
  } catch (error) {
    console.error('❌ Failed to initialize WalletConnect:', error);
    return null;
  }
}

// Get WalletConnect instance
export async function getWalletConnect() {
  if (!walletKitInstance) {
    return await initializeWalletConnect();
  }
  return walletKitInstance;
}

// Check if we should use WalletConnect (not in mini app environment)
export function shouldUseWalletConnect() {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
  
  // Don't use WalletConnect in mini app environments
  if (userAgent.includes('warpcast') || userAgent.includes('farcaster')) {
    return false;
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
    const walletKit = await getWalletConnect();
    if (!walletKit) {
      throw new Error('WalletConnect not initialized');
    }

    // Set up session proposal handler
    walletKit.on('session_proposal', async (proposal) => {
      try {
        console.log('📱 WalletConnect session proposal received:', proposal);
        
        // Build approved namespaces for Base network
        const approvedNamespaces = buildApprovedNamespaces({
          proposal: proposal.params,
          supportedNamespaces: {
            eip155: {
              chains: ['eip155:8453'], // Base Mainnet
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
              events: [
                'chainChanged',
                'accountsChanged',
                'connect',
                'disconnect',
              ],
              accounts: [], // Will be populated after connection
            },
          },
        });

        // Approve the session
        const session = await walletKit.approveSession({
          id: proposal.id,
          namespaces: approvedNamespaces,
        });

        console.log('✅ WalletConnect session approved:', session);
        
        // Return the session for further use
        return session;
      } catch (error) {
        console.error('❌ Failed to approve WalletConnect session:', error);
        
        // Reject the session
        await walletKit.rejectSession({
          id: proposal.id,
          reason: getSdkError('USER_REJECTED'),
        });
        
        throw error;
      }
    });

    // Set up session request handler
    walletKit.on('session_request', async (event) => {
      try {
        console.log('📱 WalletConnect session request received:', event);
        
        const { topic, params, id } = event;
        const { request } = params;
        
        // Handle different request methods
        switch (request.method) {
          case 'eth_requestAccounts':
          case 'eth_accounts':
            // Return connected accounts
            const accounts = await getConnectedAccounts();
            const response = {
              id,
              result: accounts,
              jsonrpc: '2.0',
            };
            await walletKit.respondSessionRequest({ topic, response });
            break;
            
          case 'eth_sendTransaction':
            // Handle transaction signing
            const txParams = request.params[0];
            const signedTx = await signTransaction(txParams);
            const txResponse = {
              id,
              result: signedTx,
              jsonrpc: '2.0',
            };
            await walletKit.respondSessionRequest({ topic, response: txResponse });
            break;
            
          case 'personal_sign':
            // Handle message signing
            const message = request.params[0];
            const address = request.params[1];
            const signature = await signMessage(message, address);
            const signResponse = {
              id,
              result: signature,
              jsonrpc: '2.0',
            };
            await walletKit.respondSessionRequest({ topic, response: signResponse });
            break;
            
          default:
            // Reject unsupported methods
            const errorResponse = {
              id,
              jsonrpc: '2.0',
              error: {
                code: 4200,
                message: `Unsupported method: ${request.method}`,
              },
            };
            await walletKit.respondSessionRequest({ topic, response: errorResponse });
        }
      } catch (error) {
        console.error('❌ Failed to handle WalletConnect session request:', error);
        
        // Send error response
        const errorResponse = {
          id: event.id,
          jsonrpc: '2.0',
          error: {
            code: 5000,
            message: 'User rejected',
          },
        };
        await walletKit.respondSessionRequest({ 
          topic: event.topic, 
          response: errorResponse 
        });
      }
    });

    // Get active sessions
    const activeSessions = walletKit.getActiveSessions();
    console.log('📱 Active WalletConnect sessions:', activeSessions);
    
    return walletKit;
  } catch (error) {
    console.error('❌ Failed to connect wallet via WalletConnect:', error);
    throw error;
  }
}

// Get connected accounts (placeholder - implement based on your wallet logic)
async function getConnectedAccounts() {
  // This should return the user's connected wallet addresses
  // For now, return empty array - implement based on your wallet integration
  return [];
}

// Sign transaction (placeholder - implement based on your wallet logic)
async function signTransaction(txParams) {
  // This should handle transaction signing
  // For now, throw error - implement based on your wallet integration
  throw new Error('Transaction signing not implemented');
}

// Sign message (placeholder - implement based on your wallet logic)
async function signMessage(message, address) {
  // This should handle message signing
  // For now, throw error - implement based on your wallet integration
  throw new Error('Message signing not implemented');
}

// Disconnect wallet
export async function disconnectWallet() {
  try {
    const walletKit = await getWalletConnect();
    if (!walletKit) return;

    const activeSessions = walletKit.getActiveSessions();
    
    // Disconnect all active sessions
    for (const [topic, session] of Object.entries(activeSessions)) {
      await walletKit.disconnectSession({
        topic,
        reason: getSdkError('USER_DISCONNECTED'),
      });
    }
    
    console.log('✅ WalletConnect disconnected successfully');
  } catch (error) {
    console.error('❌ Failed to disconnect WalletConnect:', error);
    throw error;
  }
}

// Get active sessions
export async function getActiveSessions() {
  try {
    const walletKit = await getWalletConnect();
    if (!walletKit) return {};
    
    return walletKit.getActiveSessions();
  } catch (error) {
    console.error('❌ Failed to get active sessions:', error);
    return {};
  }
}

// Check if WalletConnect is available
export function isWalletConnectAvailable() {
  return shouldUseWalletConnect() && !!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
}
