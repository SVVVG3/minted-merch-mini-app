// Wallet address utility functions for extracting and formatting wallet data

import { neynarClient, isNeynarAvailable } from './neynar';
import { supabaseAdmin } from './supabase';

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
    
    // ADDED: Extract verified social accounts (X/Twitter usernames)
    const verifiedAccounts = neynarUser.verified_accounts || [];
    
    // Get verified addresses arrays
    const verifiedEthAddresses = verifiedAddresses.eth_addresses || [];
    const verifiedSolAddresses = verifiedAddresses.sol_addresses || [];
    
    // Get primary addresses
    const primaryEthAddress = verifiedAddresses.primary?.eth_address || null;
    const primarySolAddress = verifiedAddresses.primary?.sol_address || null;
    
    // ADDED: Extract X/Twitter username if present
    let xUsername = null;
    const xAccount = verifiedAccounts.find(account => account.platform === 'x');
    if (xAccount && xAccount.username) {
      xUsername = xAccount.username;
      console.log('🐦 Found verified X username:', xUsername);
    }
    
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
      // ADDED: Include X username and verified accounts data
      x_username: xUsername,
      verified_accounts: verifiedAccounts,
      wallet_data_updated_at: new Date().toISOString()
    };

    console.log('📍 Extracted wallet data:', {
      custody_address: custodyAddress,
      verified_eth_count: verifiedEthAddresses.length,
      verified_sol_count: verifiedSolAddresses.length,
      total_addresses: allWalletAddresses.length,
      primary_eth: primaryEthAddress,
      primary_sol: primarySolAddress,
      x_username: xUsername, // ADDED
      verified_accounts_count: verifiedAccounts.length // ADDED
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
 * Fetch comprehensive wallet data from database (includes Bankr addresses)
 * @param {number} fid - User's Farcaster ID
 * @returns {Object|null} Complete wallet data from database or null if failed
 */
export async function fetchUserWalletDataFromDatabase(fid) {
  try {
    console.log('🏦 Fetching comprehensive wallet data from database for FID:', fid);
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        fid,
        username,
        display_name,
        custody_address,
        verified_eth_addresses,
        verified_sol_addresses,
        primary_eth_address,
        primary_sol_address,
        all_wallet_addresses,
        wallet_data_updated_at,
        bankr_account_id,
        bankr_evm_address,
        bankr_solana_address,
        bankr_wallet_data_updated_at,
        x_username
      `)
      .eq('fid', parseInt(fid))
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile from database:', profileError);
      return null;
    }

    if (!profile) {
      console.log('❌ No profile found in database for FID:', fid);
      return null;
    }

    // Extract all wallet addresses from profile (including Bankr addresses)
    const allWalletAddresses = [];
    
    // Add custody address
    if (profile.custody_address) {
      allWalletAddresses.push(profile.custody_address.toLowerCase());
    }
    
    // Add verified ETH addresses from Neynar
    if (profile.verified_eth_addresses && Array.isArray(profile.verified_eth_addresses)) {
      profile.verified_eth_addresses.forEach(addr => {
        if (addr && !allWalletAddresses.includes(addr.toLowerCase())) {
          allWalletAddresses.push(addr.toLowerCase());
        }
      });
    }
    
    // Add verified SOL addresses from Neynar
    if (profile.verified_sol_addresses && Array.isArray(profile.verified_sol_addresses)) {
      profile.verified_sol_addresses.forEach(addr => {
        if (addr && !allWalletAddresses.includes(addr.toLowerCase())) {
          allWalletAddresses.push(addr.toLowerCase());
        }
      });
    }
    
    // Add all wallet addresses from Neynar
    if (profile.all_wallet_addresses && Array.isArray(profile.all_wallet_addresses)) {
      profile.all_wallet_addresses.forEach(addr => {
        if (addr && !allWalletAddresses.includes(addr.toLowerCase())) {
          allWalletAddresses.push(addr.toLowerCase());
        }
      });
    }

    // 🆕 ADD BANKR WALLET ADDRESSES
    if (profile.bankr_evm_address) {
      const bankrEvm = profile.bankr_evm_address.toLowerCase();
      if (!allWalletAddresses.includes(bankrEvm)) {
        allWalletAddresses.push(bankrEvm);
        console.log('💳 Added Bankr EVM address:', profile.bankr_evm_address);
      }
    }
    
    if (profile.bankr_solana_address) {
      const bankrSol = profile.bankr_solana_address.toLowerCase();
      if (!allWalletAddresses.includes(bankrSol)) {
        allWalletAddresses.push(bankrSol);
        console.log('💳 Added Bankr Solana address:', profile.bankr_solana_address);
      }
    }

    // Create comprehensive wallet data object
    const walletData = {
      fid: profile.fid,
      username: profile.username,
      display_name: profile.display_name,
      custody_address: profile.custody_address,
      verified_eth_addresses: profile.verified_eth_addresses || [],
      verified_sol_addresses: profile.verified_sol_addresses || [],
      primary_eth_address: profile.primary_eth_address,
      primary_sol_address: profile.primary_sol_address,
      all_wallet_addresses: allWalletAddresses,
      wallet_data_updated_at: profile.wallet_data_updated_at,
      // Bankr wallet data
      bankr_account_id: profile.bankr_account_id,
      bankr_evm_address: profile.bankr_evm_address,
      bankr_solana_address: profile.bankr_solana_address,
      bankr_wallet_data_updated_at: profile.bankr_wallet_data_updated_at,
      x_username: profile.x_username
    };

    console.log('🏦 Comprehensive wallet data retrieved:', {
      fid: profile.fid,
      username: profile.username,
      total_addresses: allWalletAddresses.length,
      custody_address: !!profile.custody_address,
      verified_eth_count: profile.verified_eth_addresses?.length || 0,
      verified_sol_count: profile.verified_sol_addresses?.length || 0,
      bankr_evm: !!profile.bankr_evm_address,
      bankr_solana: !!profile.bankr_solana_address,
      bankr_account_id: !!profile.bankr_account_id,
      x_username: profile.x_username
    });

    return walletData;

  } catch (error) {
    console.error('❌ Error fetching wallet data from database:', error);
    return null;
  }
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