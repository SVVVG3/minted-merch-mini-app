// Token-gated chat eligibility system for $mintedmerch holders

import { checkTokenBalanceDirectly } from './blockchainAPI';

const MINTEDMERCH_TOKEN_ADDRESS = '0x774EAeFE73Df7959496Ac92a77279A8D7d690b07';
const BASE_CHAIN_ID = 8453;
const REQUIRED_TOKENS = 50000000; // 50M tokens

/**
 * Check if a user is eligible for the token-gated chat
 * @param {Array} walletAddresses - User's wallet addresses
 * @returns {Promise<Object>} Eligibility result
 */
export async function checkChatEligibility(walletAddresses) {
  try {
    console.log('🎫 Checking chat eligibility for wallets:', walletAddresses);
    
    // Filter valid Ethereum addresses
    const validAddresses = walletAddresses.filter(addr => 
      typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42
    );

    if (validAddresses.length === 0) {
      return {
        eligible: false,
        tokenBalance: 0,
        requiredBalance: REQUIRED_TOKENS,
        message: 'No valid wallet addresses found'
      };
    }

    // Check token balance using direct blockchain RPC
    const tokenBalance = await checkTokenBalanceDirectly(
      validAddresses,
      [MINTEDMERCH_TOKEN_ADDRESS],
      BASE_CHAIN_ID
    );

    const eligible = tokenBalance >= REQUIRED_TOKENS;
    
    console.log('🎫 Chat eligibility result:', {
      eligible,
      tokenBalance,
      requiredBalance: REQUIRED_TOKENS,
      walletCount: validAddresses.length
    });

    return {
      eligible,
      tokenBalance,
      requiredBalance: REQUIRED_TOKENS,
      message: eligible 
        ? `✅ Eligible! You hold ${tokenBalance.toLocaleString()} $MINTEDMERCH tokens`
        : `❌ Not eligible. You need ${REQUIRED_TOKENS.toLocaleString()} tokens but only have ${tokenBalance.toLocaleString()}`
    };

  } catch (error) {
    console.error('❌ Error checking chat eligibility:', error);
    return {
      eligible: false,
      tokenBalance: 0,
      requiredBalance: REQUIRED_TOKENS,
      message: 'Error checking eligibility. Please try again.',
      error: error.message
    };
  }
}

/**
 * Batch check eligibility for multiple users (for admin monitoring)
 * @param {Array} users - Array of user objects with FID and wallet addresses
 * @returns {Promise<Array>} Array of eligibility results
 */
export async function batchCheckEligibility(users) {
  console.log('🔍 Batch checking eligibility for', users.length, 'users');
  
  const results = [];
  
  // Process in batches to avoid overwhelming the RPC
  const batchSize = 10;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (user) => {
      try {
        const eligibility = await checkChatEligibility(user.walletAddresses || []);
        return {
          fid: user.fid,
          username: user.username,
          displayName: user.displayName,
          ...eligibility,
          lastChecked: new Date().toISOString()
        };
      } catch (error) {
        return {
          fid: user.fid,
          username: user.username,
          displayName: user.displayName,
          eligible: false,
          tokenBalance: 0,
          requiredBalance: REQUIRED_TOKENS,
          message: 'Error checking eligibility',
          error: error.message,
          lastChecked: new Date().toISOString()
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Generate chat invitation data for eligible users
 * @param {number} userFid - User's Farcaster ID
 * @param {Array} walletAddresses - User's wallet addresses
 * @param {Object} existingEligibility - Optional pre-computed eligibility result to avoid re-checking
 * @returns {Promise<Object>} Invitation result
 */
export async function generateChatInvitation(userFid, walletAddresses, existingEligibility = null) {
  // Use existing eligibility result if provided, otherwise check again
  const eligibility = existingEligibility || await checkChatEligibility(walletAddresses);
  
  if (!eligibility.eligible) {
    return {
      success: false,
      message: eligibility.message
    };
  }

  // Generate invitation token and record the invitation
  const invitationToken = `invite_${userFid}_${Date.now()}`;
  const groupInviteLink = 'https://farcaster.xyz/~/group/f_3WBwjLNbY6K9khTauJog';
  
  // TODO: Store invitation in database for tracking
  try {
    await fetch('/api/chat-invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fid: userFid,
        invitation_token: invitationToken,
        group_link: groupInviteLink,
        token_balance: eligibility.tokenBalance,
        generated_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.warn('Could not record invitation:', error);
  }
  
  return {
    success: true,
    invitationToken,
    groupInviteLink,
    message: `✅ You're eligible! Join the $MINTEDMERCH holders chat.`,
    eligibility,
    instructions: [
      '1. You hold the required 50M+ $MINTEDMERCH tokens',
      '2. Click the group link below to join the chat',
      '3. Your eligibility will be monitored automatically',
      '4. Note: You may be removed if your token balance falls below 50M'
    ]
  };
}

/**
 * Get summary statistics for chat eligibility monitoring
 * @param {Array} eligibilityResults - Results from batchCheckEligibility
 * @returns {Object} Summary statistics
 */
export function getEligibilitySummary(eligibilityResults) {
  const total = eligibilityResults.length;
  const eligible = eligibilityResults.filter(r => r.eligible).length;
  const ineligible = total - eligible;
  
  const totalTokens = eligibilityResults.reduce((sum, r) => sum + (r.tokenBalance || 0), 0);
  const avgTokens = total > 0 ? totalTokens / total : 0;
  
  const ineligibleUsers = eligibilityResults
    .filter(r => !r.eligible)
    .sort((a, b) => (b.tokenBalance || 0) - (a.tokenBalance || 0));

  return {
    total,
    eligible,
    ineligible,
    eligibilityRate: total > 0 ? (eligible / total * 100).toFixed(1) : 0,
    totalTokens,
    avgTokens,
    ineligibleUsers: ineligibleUsers.slice(0, 20), // Top 20 closest to eligibility
    summary: `${eligible}/${total} users eligible (${((eligible / total) * 100).toFixed(1)}%)`
  };
}
