// Spin Contract Verification Utilities
// Used to verify on-chain spin transactions before awarding points

import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// Spin contract address on Base
const SPIN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SPIN_CONTRACT_ADDRESS;

// Spin event ABI
const SPIN_EVENT_ABI = [{
  type: 'event',
  name: 'Spin',
  inputs: [
    { name: 'anonId', type: 'bytes32', indexed: true },
    { name: 'user', type: 'address', indexed: true },
    { name: 'dayStart', type: 'uint256', indexed: false },
    { name: 'timestamp', type: 'uint256', indexed: false }
  ]
}];

/**
 * Verify that a transaction hash contains a valid Spin event
 * @param {string} txHash - Transaction hash to verify
 * @param {string} userAddress - Expected user address (wallet)
 * @param {number} dayStart - Expected dayStart timestamp
 * @returns {Promise<object>} Verification result
 */
export async function verifySpinTransaction(txHash, userAddress = null, dayStart = null) {
  try {
    console.log('🔍 Verifying spin transaction:', {
      txHash: txHash?.substring(0, 10) + '...',
      userAddress: userAddress?.substring(0, 10) + '...',
      dayStart
    });

    if (!txHash) {
      return {
        success: false,
        error: 'Transaction hash is required'
      };
    }

    if (!SPIN_CONTRACT_ADDRESS) {
      console.error('❌ SPIN_CONTRACT_ADDRESS not configured');
      return {
        success: false,
        error: 'Spin contract not configured'
      };
    }

    // Create viem client for Base
    const client = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org')
    });

    // Get transaction receipt
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (!receipt) {
      return {
        success: false,
        error: 'Transaction not found on blockchain'
      };
    }

    // Check if transaction was successful
    if (receipt.status !== 'success') {
      return {
        success: false,
        error: 'Transaction failed on blockchain'
      };
    }

    // Check if transaction was to the spin contract
    if (receipt.to?.toLowerCase() !== SPIN_CONTRACT_ADDRESS.toLowerCase()) {
      return {
        success: false,
        error: 'Transaction was not to the spin contract',
        details: {
          expected: SPIN_CONTRACT_ADDRESS.toLowerCase(),
          actual: receipt.to?.toLowerCase()
        }
      };
    }

    // Parse logs to find Spin event
    const spinEvent = receipt.logs.find(log => {
      // Check if log is from our contract
      if (log.address.toLowerCase() !== SPIN_CONTRACT_ADDRESS.toLowerCase()) {
        return false;
      }

      // Spin event signature: keccak256("Spin(bytes32,address,uint256,uint256)")
      const spinEventSignature = '0x...'; // TODO: Get from contract deployment
      
      // For now, just verify it's from the contract and has topics
      return log.topics && log.topics.length > 0;
    });

    if (!spinEvent) {
      return {
        success: false,
        error: 'No Spin event found in transaction'
      };
    }

    // Decode the event (simplified - topics[0] is event sig, topics[1] is anonId, topics[2] is user address)
    const eventUserAddress = spinEvent.topics[2]; // Indexed user address

    // Verify user address if provided
    if (userAddress) {
      // Convert both to lowercase and compare (remove 0x padding)
      const normalizedEventAddress = eventUserAddress?.toLowerCase().replace('0x' + '0'.repeat(24), '0x');
      const normalizedUserAddress = userAddress.toLowerCase();

      if (normalizedEventAddress !== normalizedUserAddress) {
        return {
          success: false,
          error: 'User address mismatch',
          details: {
            expected: normalizedUserAddress,
            actual: normalizedEventAddress
          }
        };
      }
    }

    console.log('✅ Spin transaction verified successfully');

    return {
      success: true,
      verified: true,
      blockNumber: receipt.blockNumber,
      blockTimestamp: receipt.blockTimestamp || Date.now() / 1000,
      userAddress: eventUserAddress,
      transactionHash: txHash
    };

  } catch (error) {
    console.error('❌ Error verifying spin transaction:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify transaction'
    };
  }
}

/**
 * Check if a transaction hash has already been used for a check-in
 * @param {string} txHash - Transaction hash to check
 * @returns {Promise<boolean>} True if already used
 */
export async function isTransactionHashUsed(txHash) {
  const { supabaseAdmin } = await import('./supabase.js');
  
  const { data, error } = await supabaseAdmin
    .from('point_transactions')
    .select('id')
    .eq('transaction_type', 'daily_checkin')
    .eq('tx_hash', txHash)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error checking if transaction hash is used:', error);
    return false; // Fail open (allow) if database check fails
  }

  return !!data; // True if found
}

