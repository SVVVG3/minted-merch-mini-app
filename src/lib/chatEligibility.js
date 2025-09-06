// Token-gated chat eligibility system for $mintedmerch holders

import { checkTokenBalanceDirectly } from './blockchainAPI';
import { updateChatMemberBalance } from './chatMemberDatabase';
import { updateUserTokenBalance } from './tokenBalanceCache';

const MINTEDMERCH_TOKEN_ADDRESS = '0x774EAeFE73Df7959496Ac92a77279A8D7d690b07';
const BASE_CHAIN_ID = 8453;
const REQUIRED_TOKENS = 50000000; // 50M tokens

/**
 * Check if a user is eligible for the token-gated chat
 * @param {Array} walletAddresses - User's wallet addresses
 * @param {number} fid - User's Farcaster ID (optional, for caching)
 * @returns {Promise<Object>} Eligibility result
 */
export async function checkChatEligibility(walletAddresses, fid = null) {
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

    // Update token balance cache if FID is provided
    if (fid && tokenBalance > 0) {
      try {
        console.log(`💾 Updating token balance cache for FID ${fid}: ${tokenBalance} tokens`);
        await updateUserTokenBalance(fid, validAddresses, tokenBalance);
      } catch (cacheError) {
        console.warn(`⚠️ Failed to update token balance cache for FID ${fid}:`, cacheError.message);
        // Don't fail the eligibility check if cache update fails
      }
    }

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
  
  // Process users sequentially to avoid rate limiting (no concurrent requests)
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    try {
      console.log(`🔍 Checking user ${i + 1}/${users.length}: ${user.username} (FID: ${user.fid})`);
      
      // Add longer delay between users to avoid overwhelming RPC
      if (i > 0) {
        const delay = 5000; // 5 second delay between users
        console.log(`⏳ Waiting ${delay}ms before next user...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const eligibility = await checkChatEligibility(user.walletAddresses || [], user.fid);
      
      // Store token balance in database for caching
      await updateChatMemberBalance(user.fid, eligibility.tokenBalance, 'success');
      
      results.push({
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfpUrl: user.pfpUrl,
        ...eligibility,
        lastChecked: new Date().toISOString()
      });
      
      console.log(`✅ User ${user.username}: ${eligibility.tokenBalance.toLocaleString()} tokens (eligible: ${eligibility.eligible})`);
      
    } catch (error) {
      console.error(`❌ Error checking ${user.username}:`, error);
      
      // Store error status in database
      await updateChatMemberBalance(user.fid, 0, 'error');
      
      results.push({
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfpUrl: user.pfpUrl,
        eligible: false,
        tokenBalance: 0,
        requiredBalance: REQUIRED_TOKENS,
        message: 'Error checking eligibility',
        error: error.message,
        lastChecked: new Date().toISOString()
      });
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
  const eligibility = existingEligibility || await checkChatEligibility(walletAddresses, userFid);
  
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
