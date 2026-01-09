/**
 * Personal Sign Signature Verification for Free Order Claims
 * 
 * This module handles:
 * 1. Generating messages for free orders (no PII)
 * 2. Verifying personal_sign signatures server-side
 * 3. Checking nonces to prevent replay attacks
 * 4. Rate limiting free order claims
 * 
 * Uses personal_sign (signMessage) instead of EIP-712 for better
 * wallet compatibility across Farcaster and Base app.
 */

import { verifyMessage, getAddress } from 'viem';
import { supabaseAdmin } from './supabase';

// Maximum age of a signature (5 minutes)
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Reconstruct the message that was signed on the frontend
 * This MUST match exactly what the frontend creates
 * 
 * @param {Object} messageData - Message data from frontend
 * @returns {string} The message string that was signed
 */
export function reconstructSignedMessage(messageData) {
  const { orderId, fid, discountCode, itemCount, nonce } = messageData;
  
  return [
    'Minted Merch Free Order Claim',
    '',
    `Order ID: ${orderId}`,
    `Farcaster ID: ${fid}`,
    `Discount Code: ${discountCode}`,
    `Item Count: ${itemCount}`,
    `Nonce: ${nonce}`,
    '',
    'Sign this message to confirm your free order.',
    'This does not cost any gas or funds.'
  ].join('\n');
}

/**
 * Verify a free order claim signature using personal_sign
 * 
 * @param {Object} params - Verification parameters
 * @param {string} params.signature - The personal_sign signature
 * @param {Object} params.message - The message data that was signed
 * @param {string} params.expectedAddress - The wallet address that should have signed
 * @returns {Object} Verification result
 */
export async function verifyFreeOrderSignature({ signature: rawSignature, message, expectedAddress }) {
  try {
    console.log('🔐 Verifying free order signature (personal_sign):', {
      hasSignature: !!rawSignature,
      signatureLength: rawSignature?.length,
      expectedAddress: expectedAddress?.substring(0, 10) + '...',
      orderId: message?.orderId,
      fid: message?.fid,
      nonce: message?.nonce
    });

    // Validate inputs
    if (!rawSignature || typeof rawSignature !== 'string') {
      return {
        success: false,
        error: 'Invalid signature format',
        code: 'INVALID_SIGNATURE_FORMAT'
      };
    }
    
    let signature = rawSignature;
    
    // Log raw signature for debugging
    console.log('🔍 Raw signature received:', {
      length: signature.length,
      prefix: signature.substring(0, 40),
      suffix: signature.substring(Math.max(0, signature.length - 20)),
      looksLikeJson: signature.startsWith('{') || signature.startsWith('['),
      looksLikeBase64: /^[A-Za-z0-9+/=]+$/.test(signature.replace(/^0x/, ''))
    });
    
    // Handle JSON-encoded signatures (some wallets return objects as strings)
    if (signature.startsWith('{') || signature.startsWith('[')) {
      try {
        const parsed = JSON.parse(signature);
        console.log('📝 Parsed JSON signature:', Object.keys(parsed));
        signature = parsed.signature || parsed.sig || parsed.result || parsed.data || parsed;
        if (typeof signature !== 'string') {
          signature = JSON.stringify(signature);
        }
      } catch (e) {
        console.log('⚠️ Failed to parse JSON signature');
      }
    }
    
    // Handle base64-encoded signatures
    if (signature.length > 132 && !signature.startsWith('0x')) {
      try {
        // Try to decode as base64
        const decoded = Buffer.from(signature, 'base64').toString('hex');
        if (decoded.length === 130) {
          signature = '0x' + decoded;
          console.log('📝 Decoded base64 signature');
        }
      } catch (e) {
        // Not base64, continue
      }
    }
    
    // Ensure 0x prefix
    if (!signature.startsWith('0x')) {
      signature = '0x' + signature;
    }
    
    // Try to normalize signature to expected format (132 chars = 0x + 130 hex)
    // Some wallets return signatures with extra data
    if (signature.length !== 132) {
      console.log('⚠️ Signature length is not 132:', signature.length);
      
      // Try to extract a 130-char hex signature if embedded anywhere
      const hexMatch = signature.match(/0x[a-fA-F0-9]{130}/);
      if (hexMatch) {
        signature = hexMatch[0];
        console.log('📝 Extracted standard signature from data');
      } else {
        // Try to find any 130-char hex string
        const hexOnlyMatch = signature.match(/[a-fA-F0-9]{130}/);
        if (hexOnlyMatch) {
          signature = '0x' + hexOnlyMatch[0];
          console.log('📝 Extracted hex signature without 0x prefix');
        } else if (signature.length > 132 && signature.startsWith('0x')) {
          // If signature is longer, try trimming to 132 chars
          const trimmed = signature.substring(0, 132);
          if (/^0x[a-fA-F0-9]{130}$/.test(trimmed)) {
            signature = trimmed;
            console.log('📝 Trimmed signature to 132 chars');
          }
        }
      }
    }
    
    // Final signature details
    console.log('🔍 Processed signature:', {
      length: signature.length,
      prefix: signature.substring(0, 10),
      suffix: signature.substring(signature.length - 10),
      isValidHex: /^0x[a-fA-F0-9]+$/.test(signature),
      isCorrectLength: signature.length === 132
    });

    if (!expectedAddress) {
      return {
        success: false,
        error: 'Expected wallet address is required',
        code: 'MISSING_ADDRESS'
      };
    }

    if (!message || !message.orderId || message.fid === undefined) {
      return {
        success: false,
        error: 'Invalid message format',
        code: 'INVALID_MESSAGE_FORMAT'
      };
    }

    // Check signature age (nonce is timestamp)
    const signatureAge = Date.now() - Number(message.nonce);
    if (signatureAge > SIGNATURE_MAX_AGE_MS) {
      console.log('⏰ Signature expired:', {
        signatureAge: signatureAge / 1000,
        maxAge: SIGNATURE_MAX_AGE_MS / 1000
      });
      return {
        success: false,
        error: 'Signature has expired. Please try again.',
        code: 'SIGNATURE_EXPIRED'
      };
    }

    // Check if nonce has already been used (prevents replay attacks)
    const nonceCheck = await checkNonceUsed(message.nonce.toString());
    if (nonceCheck.used) {
      console.log('🔄 Nonce already used:', message.nonce.toString());
      return {
        success: false,
        error: 'This signature has already been used',
        code: 'NONCE_ALREADY_USED'
      };
    }

    // Normalize the expected address
    const normalizedExpectedAddress = getAddress(expectedAddress);
    
    // Reconstruct the message that was signed
    const signedMessage = reconstructSignedMessage(message);
    
    console.log('📝 Reconstructed message for verification:', {
      messageLength: signedMessage.length,
      messagePreview: signedMessage.substring(0, 50) + '...'
    });

    // Verify the signature using viem's verifyMessage (for personal_sign)
    let isValid;
    try {
      isValid = await verifyMessage({
        address: normalizedExpectedAddress,
        message: signedMessage,
        signature: signature,
      });
    } catch (verifyError) {
      console.error('❌ verifyMessage threw error:', verifyError.message);
      
      // If viem complains about signature length, try to give a helpful message
      if (verifyError.message.includes('signature length') || verifyError.message.includes('invalid signature')) {
        return {
          success: false,
          error: `Signature verification failed: ${verifyError.message}`,
          code: 'SIGNATURE_FORMAT_ERROR',
          details: {
            receivedLength: rawSignature.length,
            processedLength: signature.length,
            expectedLength: 132,
            rawPrefix: rawSignature.substring(0, 30),
            processedPrefix: signature.substring(0, 20)
          }
        };
      }
      throw verifyError;
    }

    if (!isValid) {
      console.log('❌ Signature verification failed - signature does not match');
      return {
        success: false,
        error: 'Invalid signature - wallet address mismatch',
        code: 'SIGNATURE_MISMATCH'
      };
    }

    console.log('✅ Signature verified successfully');
    return {
      success: true,
      verified: true,
      signerAddress: normalizedExpectedAddress
    };

  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return {
      success: false,
      error: `Signature verification failed: ${error.message}`,
      code: 'VERIFICATION_ERROR'
    };
  }
}

/**
 * Check if a nonce has already been used
 * 
 * @param {string} nonce - The nonce to check
 * @returns {Object} Result with 'used' boolean
 */
async function checkNonceUsed(nonce) {
  try {
    const { data, error } = await supabaseAdmin
      .from('signature_claim_nonces')
      .select('id')
      .eq('nonce', nonce)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error checking nonce:', error);
      throw error;
    }

    return { used: !!data };
  } catch (error) {
    console.error('Error checking nonce:', error);
    // On error, assume not used (will be caught by unique constraint on insert)
    return { used: false };
  }
}

/**
 * Mark a nonce as used after successful order creation
 * 
 * @param {Object} params - Parameters
 * @param {string} params.nonce - The nonce to mark as used
 * @param {number} params.fid - User's FID
 * @param {string} params.walletAddress - User's wallet address
 * @param {string} params.orderId - The order ID created
 * @returns {Object} Result
 */
export async function markNonceUsed({ nonce, fid, walletAddress, orderId }) {
  try {
    const { error } = await supabaseAdmin
      .from('signature_claim_nonces')
      .insert({
        nonce: nonce.toString(),
        fid: fid,
        wallet_address: walletAddress.toLowerCase(),
        order_id: orderId
      });

    if (error) {
      // If duplicate, that's fine - nonce is already marked as used
      if (error.code === '23505') { // Unique violation
        console.log('Nonce already marked as used (concurrent request)');
        return { success: true, alreadyUsed: true };
      }
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error marking nonce as used:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if user can claim a free order (rate limiting)
 * 
 * @param {number} fid - User's FID
 * @returns {Object} Rate limit status
 */
export async function checkFreeOrderRateLimit(fid) {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('check_free_order_claim_limit', { p_fid: fid });

    if (error) {
      console.error('Error checking rate limit:', error);
      // On error, allow the claim (don't block users due to DB issues)
      return {
        allowed: true,
        dailyRemaining: 3,
        hourlyOk: true,
        error: error.message
      };
    }

    return {
      allowed: data.allowed,
      dailyRemaining: data.daily_remaining,
      hourlyOk: data.hourly_ok,
      dailyCount: data.daily_count || 0,
      nextAvailable: data.next_available
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return {
      allowed: true,
      dailyRemaining: 3,
      hourlyOk: true,
      error: error.message
    };
  }
}

/**
 * Record a free order claim (for rate limiting)
 * 
 * @param {number} fid - User's FID
 * @returns {Object} Result
 */
export async function recordFreeOrderClaim(fid) {
  try {
    const { error } = await supabaseAdmin
      .rpc('record_free_order_claim', { p_fid: fid });

    if (error) {
      console.error('Error recording free order claim:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error recording free order claim:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Full validation for a free order signature claim
 * Combines all checks: signature, nonce, rate limit
 * 
 * @param {Object} params - Validation parameters
 * @param {string} params.signature - The personal_sign signature
 * @param {Object} params.message - The message that was signed
 * @param {string} params.expectedAddress - Expected signer wallet address
 * @param {number} params.fid - User's FID
 * @returns {Object} Validation result
 */
export async function validateFreeOrderClaim({ signature, message, expectedAddress, fid }) {
  console.log('🔒 Validating free order claim:', {
    orderId: message?.orderId,
    fid: fid,
    walletPrefix: expectedAddress?.substring(0, 10)
  });

  // Step 1: Check rate limit
  const rateLimit = await checkFreeOrderRateLimit(fid);
  if (!rateLimit.allowed) {
    const reason = !rateLimit.hourlyOk 
      ? 'Please wait at least 1 hour between free order claims'
      : `Daily limit reached (${rateLimit.dailyCount}/3). Try again tomorrow.`;
    
    return {
      success: false,
      error: reason,
      code: 'RATE_LIMITED',
      rateLimit: rateLimit
    };
  }

  // Step 2: Verify the signature
  const signatureResult = await verifyFreeOrderSignature({
    signature,
    message,
    expectedAddress
  });

  if (!signatureResult.success) {
    return signatureResult;
  }

  // Step 3: All validations passed
  return {
    success: true,
    verified: true,
    signerAddress: signatureResult.signerAddress,
    rateLimit: rateLimit
  };
}
