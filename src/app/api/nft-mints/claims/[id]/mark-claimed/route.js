import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyFarcasterUser, setUserContext } from '@/lib/auth';

/**
 * POST /api/nft-mints/claims/[id]/mark-claimed
 * 
 * Mark claim as completed (tokens claimed on-chain)
 * Called after successful transaction to airdrop contract
 * 
 * Authentication: REQUIRED (Farcaster JWT)
 * Security: User can only update their own claims (RLS enforced)
 * 
 * @param {string} transactionHash - On-chain transaction hash of the claim
 * 
 * @returns {Object} Updated claim status
 */
export async function POST(request, { params }) {
  try {
    const { id: claimId } = params;
    const { transactionHash } = await request.json();

    if (!claimId) {
      return NextResponse.json(
        { error: 'Claim ID is required' },
        { status: 400 }
      );
    }

    if (!transactionHash) {
      return NextResponse.json(
        { error: 'Transaction hash is required' },
        { status: 400 }
      );
    }

    console.log(`💰 Marking claim as completed: ${claimId}`);
    console.log(`   TX: ${transactionHash}`);

    // 🔒 AUTHENTICATE USER (REQUIRED)
    const farcasterUser = await verifyFarcasterUser(request);
    if (!farcasterUser?.fid) {
      return NextResponse.json(
        { error: 'Unauthorized - Farcaster authentication required' },
        { status: 401 }
      );
    }

    const authenticatedFid = farcasterUser.fid;
    console.log(`✅ Authenticated as FID ${authenticatedFid}`);

    // Set user context for RLS
    await setUserContext(authenticatedFid);

    // Fetch claim (RLS ensures user can only access their own)
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('nft_mint_claims')
      .select('id, user_fid, has_shared, has_claimed, minted_at')
      .eq('id', claimId)
      .eq('user_fid', authenticatedFid) // Double-check ownership
      .single();

    if (claimError || !claim) {
      console.error('❌ Claim not found:', claimError);
      return NextResponse.json(
        { error: 'Claim not found or access denied' },
        { status: 404 }
      );
    }

    // Verify user has minted
    if (!claim.minted_at) {
      console.error('❌ User has not minted yet');
      return NextResponse.json(
        { error: 'Must mint NFT first' },
        { status: 400 }
      );
    }

    // Verify user has shared
    if (!claim.has_shared) {
      console.error('❌ User has not shared yet');
      return NextResponse.json(
        { error: 'Must share mint before claiming' },
        { status: 400 }
      );
    }

    // Check if already claimed
    if (claim.has_claimed) {
      console.log('ℹ️  Already marked as claimed');
      return NextResponse.json({
        success: true,
        message: 'Tokens already claimed',
        claim: {
          id: claim.id,
          hasClaimed: true
        }
      });
    }

    // Update claim to mark as completed
    const { data: updatedClaim, error: updateError } = await supabaseAdmin
      .from('nft_mint_claims')
      .update({
        has_claimed: true,
        claimed_at: new Date().toISOString(),
        claim_transaction_hash: transactionHash
      })
      .eq('id', claimId)
      .eq('user_fid', authenticatedFid) // RLS check
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating claim:', updateError);
      return NextResponse.json(
        { error: 'Failed to update claim status' },
        { status: 500 }
      );
    }

    console.log(`✅ Claim marked as completed: ${claimId}`);
    console.log(`   User has successfully claimed tokens!`);

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Tokens claimed successfully! 🎉',
      claim: {
        id: updatedClaim.id,
        hasMinted: true,
        hasShared: true,
        hasClaimed: true,
        claimedAt: updatedClaim.claimed_at,
        transactionHash: transactionHash
      }
    });

  } catch (error) {
    console.error('❌ Error marking claim as completed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

