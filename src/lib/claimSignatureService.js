/**
 * Claim Signature Service
 * 
 * Generates EIP-712 signatures for Thirdweb Airdrop contract claims using official SDK.
 * Uses admin wallet to sign claim data, which can be verified on-chain.
 * 
 * Contract Function:
 * airdropERC20WithSignature(
 *   (bytes32 uid, address tokenAddress, uint256 expirationTimestamp, (address recipient, uint256 amount)[] contents) req,
 *   bytes signature
 * )
 * 
 * Security Features:
 * - EIP-712 typed signatures (domain-separated) via Thirdweb SDK
 * - Unique UID per payout (prevents replay attacks)
 * - Time-limited (30-day deadline)
 * - Chain-specific (Base network)
 * - Admin private key never exposed to client
 */

import { createThirdwebClient, getContract } from 'thirdweb';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { base } from 'thirdweb/chains';
import { generateAirdropSignatureERC20 } from 'thirdweb/extensions/airdrop';
import { isAddress, keccak256, toHex } from 'thirdweb/utils';

const ADMIN_PRIVATE_KEY = process.env.ADMIN_WALLET_PRIVATE_KEY;
const AIRDROP_CONTRACT_ADDRESS = process.env.AIRDROP_CONTRACT_ADDRESS;
const TOKEN_ADDRESS = process.env.MINTEDMERCH_TOKEN_ADDRESS;
const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

/**
 * Generate a claim signature for a payout using Thirdweb SDK
 * 
 * @param {Object} params - Claim parameters
 * @param {string} params.wallet - Ambassador's wallet address
 * @param {string|number} params.amount - Token amount to claim
 * @param {string} params.payoutId - Unique payout ID (prevents replay)
 * @param {Date} params.deadline - Expiration time for claim
 * @returns {Promise<Object>} { req, signature } - Ready to use with airdropERC20WithSignature
 */
export async function generateClaimSignature({ 
  wallet, 
  amount, 
  payoutId,
  deadline 
}) {
  // Validate inputs
  if (!isAddress(wallet)) {
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
  
  if (!TOKEN_ADDRESS) {
    throw new Error('MINTEDMERCH_TOKEN_ADDRESS not configured');
  }
  
  if (!THIRDWEB_CLIENT_ID) {
    throw new Error('NEXT_PUBLIC_THIRDWEB_CLIENT_ID not configured');
  }
  
  // Ensure deadline is a Date object
  const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
  if (isNaN(deadlineDate.getTime())) {
    throw new Error('Invalid deadline date');
  }
  
  try {
    // Initialize Thirdweb client
    const client = createThirdwebClient({ 
      clientId: THIRDWEB_CLIENT_ID 
    });
    
    // Get airdrop contract
    const airdropContract = getContract({
      client,
      chain: base,
      address: AIRDROP_CONTRACT_ADDRESS
    });
    
    // Create admin account from private key
    const adminAccount = privateKeyToAccount({
      client,
      privateKey: ADMIN_PRIVATE_KEY
    });
    
    // Generate unique UID from payoutId (bytes32)
    const uid = keccak256(toHex(payoutId));
    
    // Expiration timestamp (unix seconds)
    const expirationTimestamp = BigInt(Math.floor(deadlineDate.getTime() / 1000));
    
    // Build the airdrop request using Thirdweb SDK
    const { req, signature } = await generateAirdropSignatureERC20({
      contract: airdropContract,
      account: adminAccount,
      airdropRequest: {
        uid,
        tokenAddress: TOKEN_ADDRESS,
        expirationTimestamp,
        contents: [{
          recipient: wallet,
          amount: amountBigInt
        }]
      }
    });
    
    console.log(`✍️ Generated Thirdweb SDK airdrop signature:`, {
      payoutId,
      uid: uid.slice(0, 10) + '...',
      wallet: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
      amount: amountBigInt.toString(),
      tokenAddress: TOKEN_ADDRESS,
      expirationTimestamp: deadlineDate.toISOString(),
      signaturePreview: `${signature.slice(0, 10)}...${signature.slice(-8)}`,
      adminAddress: adminAccount.address
    });
    
    // Return the full req object and signature
    return {
      req,
      signature
    };
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
  
  if (!claimData.wallet || !isAddress(claimData.wallet)) {
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

