import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyFarcasterUser, setUserContext } from '@/lib/auth';

/**
 * POST /api/nft-mints/claims/[id]/mark-shared
 * 
 * Mark claim as shared (user posted to Farcaster)
 * This unlocks the ability to claim tokens
 * 
 * Authentication: REQUIRED (Farcaster JWT)
 * Security: User can only update their own claims (RLS enforced)
 * 
 * @param {string} castHash - Optional Farcaster cast hash for audit trail
 * 
 * @returns {Object} Updated claim status
 */
export async function POST(request, { params }) {
  try {
    const { id: claimId } = params;
    const body = await request.json();
    const { castHash } = body || {};

    if (!claimId) {
      return NextResponse.json(
        { error: 'Claim ID is required' },
        { status: 400 }
      );
    }

    console.log(`📤 Marking claim as shared: ${claimId}`);
    if (castHash) {
      console.log(`   Cast hash: ${castHash}`);
    }

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
        { error: 'Must mint NFT before sharing' },
        { status: 400 }
      );
    }

    // Check if already shared
    if (claim.has_shared) {
      console.log('ℹ️  Already marked as shared');
      return NextResponse.json({
        success: true,
        message: 'Already marked as shared',
        claim: {
          id: claim.id,
          hasShared: true,
          hasClaimed: claim.has_claimed,
          canClaim: !claim.has_claimed // Can claim if not already claimed
        }
      });
    }

    // Update claim to mark as shared
    const { data: updatedClaim, error: updateError } = await supabaseAdmin
      .from('nft_mint_claims')
      .update({
        has_shared: true,
        shared_at: new Date().toISOString(),
        share_cast_hash: castHash || null
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

    console.log(`✅ Claim marked as shared: ${claimId}`);
    console.log(`   User can now claim tokens!`);

    // Return updated status
    return NextResponse.json({
      success: true,
      message: 'Share recorded successfully - you can now claim tokens!',
      claim: {
        id: updatedClaim.id,
        hasShared: true,
        hasClaimed: updatedClaim.has_claimed,
        canClaim: !updatedClaim.has_claimed, // Can claim if not already claimed
        sharedAt: updatedClaim.shared_at
      }
    });

  } catch (error) {
    console.error('❌ Error marking claim as shared:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

