import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { setUserContext } from '@/lib/auth';
import { generateClaimSignature } from '@/lib/claimSignatureService';

/**
 * GET /api/nft-mints/claims/[id]/claim-data
 * 
 * Fetch claim signature and contract params for token airdrop
 * 
 * Authentication: REQUIRED (Farcaster JWT)
 * Security: User can only access their own claim data (RLS enforced)
 * 
 * @returns {Object} Signature and contract params for airdrop claim
 */
export async function GET(request, { params }) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    const { id: claimId } = params;

    if (!claimId) {
      return NextResponse.json(
        { error: 'Claim ID is required' },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] 🔐 Fetching claim data for claim: ${claimId}`);

    // 🔒 AUTHENTICATE USER (REQUIRED)
    const authenticatedFid = await getAuthenticatedFid(request);
    if (!authenticatedFid) {
      return NextResponse.json(
        { error: 'Unauthorized - Farcaster authentication required' },
        { status: 401 }
      );
    }

    console.log(`[${requestId}] ✅ Authenticated as FID ${authenticatedFid}`);

    // Set user context for RLS (ensures user can only see their own claims)
    await setUserContext(authenticatedFid);

    // Fetch claim (RLS will ensure user can only access their own)
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('nft_mint_claims')
      .select(`
        *,
        campaign:nft_mints(
          id,
          title,
          token_reward_amount,
          contract_address,
          contract_chain_id
        )
      `)
      .eq('id', claimId)
      .eq('user_fid', authenticatedFid) // Double-check ownership
      .single();

    if (claimError || !claim) {
      console.error(`[${requestId}] ❌ Claim not found:`, claimError);
      return NextResponse.json(
        { error: 'Claim not found or access denied' },
        { status: 404 }
      );
    }

    console.log(`[${requestId}] ✅ Claim found for FID ${authenticatedFid}`);

    // Verify user has minted
    if (!claim.minted_at) {
      console.error(`[${requestId}] ❌ User has not minted yet`);
      return NextResponse.json(
        { error: 'NFT must be minted before claiming tokens' },
        { status: 400 }
      );
    }

    // Verify user has shared (REQUIRED before claim)
    if (!claim.has_shared) {
      console.error(`[${requestId}] ❌ User has not shared yet`);
      return NextResponse.json(
        { error: 'Must share mint on Farcaster before claiming tokens' },
        { status: 400 }
      );
    }

    // Check if already claimed
    if (claim.has_claimed) {
      console.error(`[${requestId}] ⚠️  Tokens already claimed`);
      return NextResponse.json(
        { error: 'Tokens have already been claimed' },
        { status: 400 }
      );
    }

    // Parse claim signature (stored as JSON with req + signature, like Ambassador system)
    let claimData;
    
    try {
      // Try parsing as JSON first (new format)
      claimData = JSON.parse(claim.claim_signature);
      
      if (!claimData.req || !claimData.signature) {
        throw new Error('Invalid claim data format');
      }
      
      console.log(`[${requestId}] ✅ Using existing valid signature`);
      
    } catch (parseError) {
      // If parsing fails, regenerate signature (for old claims or corrupted data)
      console.log(`[${requestId}] 🔐 Generating new claim signature...`);
      
      // Generate new signature (30 days validity)
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);

      try {
        const claimSignatureData = await generateClaimSignature({
          wallet: claim.wallet_address.toLowerCase(),
          amount: claim.campaign.token_reward_amount,
          payoutId: claim.id,
          deadline: Math.floor(deadline.getTime() / 1000)
        });

        // Convert BigInt values to strings for storage
        const serializableReq = {
          uid: claimSignatureData.req.uid,
          tokenAddress: claimSignatureData.req.tokenAddress,
          expirationTimestamp: claimSignatureData.req.expirationTimestamp.toString(),
          contents: claimSignatureData.req.contents.map(content => ({
            recipient: content.recipient,
            amount: content.amount.toString()
          }))
        };

        // Store req + signature together as a single JSON blob (like Ambassador)
        const claimDataJson = JSON.stringify({
          req: serializableReq,
          signature: claimSignatureData.signature
        });

        console.log(`[${requestId}] ✅ New signature generated`);

        // Update claim with new claim data (using system context to bypass RLS for update)
        const { setSystemContext } = await import('@/lib/auth');
        await setSystemContext();
        
        await supabaseAdmin
          .from('nft_mint_claims')
          .update({
            claim_signature: claimDataJson, // Store BOTH req + signature together
            claim_req: serializableReq, // Also keep separate for backwards compatibility
            claim_signature_generated_at: new Date().toISOString(),
            claim_signature_expires_at: deadline.toISOString()
          })
          .eq('id', claim.id);

        // Use the newly generated claim data
        claimData = {
          req: serializableReq,
          signature: claimSignatureData.signature
        };

        // Reset to user context
        await setUserContext(authenticatedFid);
        
      } catch (signatureError) {
        console.error(`[${requestId}] ❌ Error generating signature:`, signatureError);
        return NextResponse.json(
          { error: 'Failed to generate claim signature' },
          { status: 500 }
        );
      }
    }

    // Airdrop contract address
    const { getAddress } = await import('viem');
    const AIRDROP_CONTRACT_ADDRESS = getAddress('0x8569755C6fa4127b3601846077FFB5D083586500');
    const CHAIN_ID = 8453; // Base

    // Log access for audit trail
    console.log(`[${requestId}] 📋 Claim data accessed:`);
    console.log(`   Claim ID: ${claim.id}`);
    console.log(`   User FID: ${authenticatedFid}`);
    console.log(`   Wallet: ${claim.wallet_address}`);
    console.log(`   Amount: ${claim.campaign.token_reward_amount} wei`);
    console.log(`   Signature expires: ${claim.claim_signature_expires_at}`);

    // Return claim data in format expected by thirdweb airdrop function (same as Ambassador)
    return NextResponse.json({
      success: true,
      claimData: {
        // Contract details
        contractAddress: AIRDROP_CONTRACT_ADDRESS,
        chainId: CHAIN_ID,
        
        // Use the EXACT req + signature that were generated together (critical for EIP-712 verification)
        req: claimData.req,
        signature: claimData.signature,
        
        // Metadata
        campaignTitle: claim.campaign.title,
        walletAddress: claim.wallet_address,
        expiresAt: claim.claim_signature_expires_at
      }
    });

  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching claim data:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

