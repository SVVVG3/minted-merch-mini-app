/**
 * Claim Signature Service
 * 
 * Generates cryptographic signatures for self-service payout claims.
 * Uses admin wallet to sign claim data, which can be verified on-chain.
 * 
 * Security Features:
 * - Signatures include nonce (payoutId) to prevent replay attacks
 * - Time-limited (30-day deadline)
 * - Chain-specific (Base network)
 * - Admin private key never exposed to client
 */

import { ethers } from 'ethers';

const ADMIN_PRIVATE_KEY = process.env.ADMIN_WALLET_PRIVATE_KEY;
const AIRDROP_CONTRACT_ADDRESS = process.env.AIRDROP_CONTRACT_ADDRESS;
const CHAIN_ID = 8453; // Base network

/**
 * Generate a claim signature for a payout
 * 
 * @param {Object} params - Claim parameters
 * @param {string} params.wallet - Ambassador's wallet address
 * @param {string|number} params.amount - Token amount to claim
 * @param {string} params.payoutId - Unique payout ID (prevents replay)
 * @param {Date} params.deadline - Expiration time for claim
 * @returns {Promise<string>} Signature bytes
 */
export async function generateClaimSignature({ 
  wallet, 
  amount, 
  payoutId,
  deadline 
}) {
  // Validate inputs
  if (!ethers.utils.isAddress(wallet)) {
    throw new Error('Invalid wallet address');
  }
  
  const amountBigInt = BigInt(amount);
  if (amountBigInt <= 0n) {
    throw new Error('Invalid amount: must be greater than 0');
  }
  
  if (!ADMIN_PRIVATE_KEY) {
    throw new Error('ADMIN_WALLET_PRIVATE_KEY not configured');
  }
  
  if (!AIRDROP_CONTRACT_ADDRESS) {
    throw new Error('AIRDROP_CONTRACT_ADDRESS not configured');
  }
  
  try {
    const signer = new ethers.Wallet(ADMIN_PRIVATE_KEY);
    
    // Create unique payload (prevents replay attacks)
    // Includes: recipient, amount, nonce, chainId, deadline
    const payload = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'string', 'uint256', 'uint256'],
      [
        wallet,                                      // recipient
        amountBigInt.toString(),                    // tokens to claim
        payoutId,                                    // unique nonce
        CHAIN_ID,                                    // prevent cross-chain replay
        Math.floor(deadline.getTime() / 1000)       // unix timestamp
      ]
    );
    
    const hash = ethers.utils.keccak256(payload);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    
    console.log(`✍️ Generated claim signature:`, {
      payoutId,
      wallet: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
      amount: amountBigInt.toString(),
      deadline: deadline.toISOString(),
      signaturePreview: `${signature.slice(0, 10)}...${signature.slice(-8)}`
    });
    
    return signature;
  } catch (error) {
    console.error('❌ Error generating claim signature:', error);
    throw new Error(`Failed to generate claim signature: ${error.message}`);
  }
}

/**
 * Check if a claim signature has expired
 * 
 * @param {string|Date} deadline - Deadline timestamp
 * @returns {boolean} True if expired
 */
export function isSignatureExpired(deadline) {
  const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
  const now = new Date();
  return now > deadlineDate;
}

/**
 * Calculate default claim deadline (30 days from now)
 * 
 * @returns {Date} Deadline date
 */
export function getDefaultClaimDeadline() {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30); // 30 days
  return deadline;
}

/**
 * Validate claim data before generating signature
 * 
 * @param {Object} claimData - Data to validate
 * @returns {Object} Validation result
 */
export function validateClaimData(claimData) {
  const errors = [];
  
  if (!claimData.wallet || !ethers.utils.isAddress(claimData.wallet)) {
    errors.push('Invalid or missing wallet address');
  }
  
  if (!claimData.amount || BigInt(claimData.amount) <= 0n) {
    errors.push('Invalid or missing amount');
  }
  
  if (!claimData.payoutId) {
    errors.push('Missing payout ID');
  }
  
  if (!claimData.deadline) {
    errors.push('Missing deadline');
  } else if (isSignatureExpired(claimData.deadline)) {
    errors.push('Deadline is in the past');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

