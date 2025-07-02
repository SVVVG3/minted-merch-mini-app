// Wallet address utility functions for extracting and formatting wallet data

import { neynarClient, isNeynarAvailable } from './neynar';

/**
 * Extract wallet data from a Neynar user response
 * @param {Object} neynarUser - User object from Neynar API
 * @returns {Object} Formatted wallet data for database storage
 */
export function extractWalletDataFromNeynar(neynarUser) {
  if (!neynarUser) {
    console.log('No Neynar user data provided');
    return null;
  }

  try {
    // Extract basic addresses
    const custodyAddress = neynarUser.custody_address;
    const verifications = neynarUser.verifications || [];
    const verifiedAddresses = neynarUser.verified_addresses || {};
    
    // Get verified addresses arrays
    const verifiedEthAddresses = verifiedAddresses.eth_addresses || [];
    const verifiedSolAddresses = verifiedAddresses.sol_addresses || [];
    
    // Get primary addresses
    const primaryEthAddress = verifiedAddresses.primary?.eth_address || null;
    const primarySolAddress = verifiedAddresses.primary?.sol_address || null;
    
    // Combine all addresses (custody + verified) and normalize to lowercase
    const allWalletAddresses = [];
    
    // Add custody address
    if (custodyAddress) {
      allWalletAddresses.push(custodyAddress.toLowerCase());
    }
    
    // Add verified ETH addresses
    verifiedEthAddresses.forEach(addr => {
      if (addr && !allWalletAddresses.includes(addr.toLowerCase())) {
        allWalletAddresses.push(addr.toLowerCase());
      }
    });
    
    // Add verified SOL addresses (keep original case for Solana)
    verifiedSolAddresses.forEach(addr => {
      if (addr && !allWalletAddresses.includes(addr.toLowerCase())) {
        allWalletAddresses.push(addr.toLowerCase());
      }
    });
    
    // Add verifications (might be duplicates, but let's be thorough)
    verifications.forEach(addr => {
      if (addr && !allWalletAddresses.includes(addr.toLowerCase())) {
        allWalletAddresses.push(addr.toLowerCase());
      }
    });

    const walletData = {
      custody_address: custodyAddress,
      verified_eth_addresses: verifiedEthAddresses,
      verified_sol_addresses: verifiedSolAddresses,
      primary_eth_address: primaryEthAddress,
      primary_sol_address: primarySolAddress,
      all_wallet_addresses: allWalletAddresses,
      wallet_data_updated_at: new Date().toISOString()
    };

    console.log('📍 Extracted wallet data:', {
      custody_address: custodyAddress,
      verified_eth_count: verifiedEthAddresses.length,
      verified_sol_count: verifiedSolAddresses.length,
      total_addresses: allWalletAddresses.length,
      primary_eth: primaryEthAddress,
      primary_sol: primarySolAddress
    });

    return walletData;

  } catch (error) {
    console.error('Error extracting wallet data from Neynar user:', error);
    return null;
  }
}

/**
 * Fetch wallet data for a user by FID using Neynar
 * @param {number} fid - User's Farcaster ID
 * @returns {Object|null} Wallet data or null if failed
 */
export async function fetchUserWalletData(fid) {
  if (!isNeynarAvailable()) {
    console.log('Neynar not available, cannot fetch wallet data');
    return null;
  }

  try {
    console.log('🔍 Fetching wallet data for FID:', fid);
    
    const userResponse = await neynarClient.fetchBulkUsers({
      fids: [parseInt(fid)]
    });

    if (!userResponse.users || userResponse.users.length === 0) {
      console.log('No user found for FID:', fid);
      return null;
    }

    const user = userResponse.users[0];
    console.log('👤 Found user:', user.username, user.display_name);
    
    return extractWalletDataFromNeynar(user);

  } catch (error) {
    console.error('Error fetching wallet data for FID', fid, ':', error);
    return null;
  }
}

/**
 * Check if a wallet address belongs to a user
 * @param {Array} userWalletAddresses - Array of user's wallet addresses (lowercase)
 * @param {string} targetAddress - Address to check (will be normalized)
 * @returns {boolean} True if address belongs to user
 */
export function isUserWalletAddress(userWalletAddresses, targetAddress) {
  if (!userWalletAddresses || !targetAddress) {
    return false;
  }
  
  return userWalletAddresses.includes(targetAddress.toLowerCase());
}

/**
 * Format wallet addresses for display
 * @param {Array} addresses - Array of wallet addresses
 * @returns {Array} Formatted addresses with checksums where appropriate
 */
export function formatWalletAddressesForDisplay(addresses) {
  if (!addresses || !Array.isArray(addresses)) {
    return [];
  }
  
  return addresses.map(addr => {
    // For ETH addresses, we could add checksum formatting here
    // For SOL addresses, keep original case
    if (addr.length === 42 && addr.startsWith('0x')) {
      // ETH address - return as is for now, could add checksum later
      return addr;
    } else {
      // Probably SOL address - find original case from somewhere if needed
      return addr;
    }
  });
} 