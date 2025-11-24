import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyFarcasterUser, setUserContext } from '@/lib/auth';

/**
 * GET /api/nft-mints/[slug]
 * 
 * Fetch NFT campaign details by slug and check user's mint/claim status
 * 
 * Authentication: Optional (returns campaign info for all, but user status only for authenticated)
 * 
 * @returns {Object} Campaign data + user status
 */
export async function GET(request, { params }) {
  try {
    const { slug } = params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Campaign slug is required' },
        { status: 400 }
      );
    }

    console.log(`📋 Fetching NFT campaign: ${slug}`);

    // Fetch campaign data (public can view active campaigns due to RLS)
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('nft_mints')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (campaignError || !campaign) {
      console.error('❌ Campaign not found:', campaignError);
      return NextResponse.json(
        { error: 'Campaign not found or inactive' },
        { status: 404 }
      );
    }

    console.log(`✅ Campaign found: ${campaign.title}`);

    // Initialize user status
    let userStatus = {
      hasMinted: false,
      hasShared: false,
      hasClaimed: false,
      canMint: true,
      canClaim: false,
      claimId: null
    };

    // If user is authenticated, check their mint/claim status
    try {
      const farcasterUser = await verifyFarcasterUser(request);
      
      if (farcasterUser?.fid) {
        console.log(`🔍 Checking mint status for FID ${farcasterUser.fid}`);
        
        // Set user context for RLS
        await setUserContext(farcasterUser.fid);

        // Check if user has already minted this campaign
        const { data: existingClaim, error: claimError } = await supabaseAdmin
          .from('nft_mint_claims')
          .select('*')
          .eq('campaign_id', campaign.id)
          .eq('user_fid', farcasterUser.fid)
          .single();

        if (existingClaim) {
          console.log(`✅ User has minted: ${existingClaim.id}`);
          userStatus = {
            hasMinted: true,
            hasShared: existingClaim.has_shared,
            hasClaimed: existingClaim.has_claimed,
            canMint: false, // Already minted
            canClaim: existingClaim.has_shared && !existingClaim.has_claimed, // Can claim if shared but not claimed yet
            claimId: existingClaim.id,
            mintedAt: existingClaim.minted_at,
            sharedAt: existingClaim.shared_at,
            claimedAt: existingClaim.claimed_at
          };
        } else {
          console.log(`ℹ️ User has not minted yet`);
          userStatus.canMint = true;
        }
      }
    } catch (authError) {
      // User not authenticated - that's OK, just return campaign info without user status
      console.log('ℹ️ Unauthenticated user viewing campaign');
    }

    // Check if campaign has reached max supply
    if (campaign.max_supply && campaign.total_mints >= campaign.max_supply) {
      console.log(`⚠️ Campaign at max supply: ${campaign.total_mints}/${campaign.max_supply}`);
      userStatus.canMint = false;
    }

    // Check if campaign has ended
    if (campaign.end_date && new Date(campaign.end_date) < new Date()) {
      console.log(`⚠️ Campaign has ended: ${campaign.end_date}`);
      userStatus.canMint = false;
    }

    // Return campaign data + user status
    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        slug: campaign.slug,
        title: campaign.title,
        description: campaign.description,
        imageUrl: campaign.image_url,
        contractAddress: campaign.contract_address,
        contractChainId: campaign.contract_chain_id,
        contractType: campaign.contract_type,
        tokenId: campaign.token_id,
        tokenRewardAmount: campaign.token_reward_amount,
        maxSupply: campaign.max_supply,
        totalMints: campaign.total_mints,
        startDate: campaign.start_date,
        endDate: campaign.end_date,
        metadata: campaign.metadata, // Contains shareText, shareEmbeds, ogImageText, etc.
        isActive: campaign.is_active,
        createdAt: campaign.created_at
      },
      userStatus
    });

  } catch (error) {
    console.error('❌ Error fetching campaign:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

