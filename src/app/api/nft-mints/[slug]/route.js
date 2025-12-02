import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { setUserContext } from '@/lib/auth';

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

    // Check if supabaseAdmin is initialized
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not initialized - missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    // Fetch campaign data (public can view active campaigns due to RLS)
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('nft_mints')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (campaignError || !campaign) {
      console.error('❌ Campaign not found:', {
        error: campaignError,
        code: campaignError?.code,
        message: campaignError?.message,
        details: campaignError?.details,
        hint: campaignError?.hint,
        slug,
        campaign
      });
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
      const authenticatedFid = await getAuthenticatedFid(request);
      
      if (authenticatedFid) {
        console.log(`🔍 Checking mint status for FID ${authenticatedFid}`);
        
        // Set user context for RLS
        await setUserContext(authenticatedFid);

        // Check user's existing mints for this campaign
        const { data: existingClaims, error: claimError } = await supabaseAdmin
          .from('nft_mint_claims')
          .select('*')
          .eq('campaign_id', campaign.id)
          .eq('user_fid', authenticatedFid)
          .order('created_at', { ascending: false });

        // Calculate total quantity minted (sum of quantities, or count if no quantity field)
        const mintCount = existingClaims?.reduce((sum, claim) => sum + (claim.quantity || 1), 0) || 0;
        const mintLimit = campaign.mint_limit_per_fid; // null or 0 = unlimited
        const isUnlimited = !mintLimit || mintLimit === 0;
        const canMintMore = isUnlimited || mintCount < mintLimit;

        // Get the most recent claim for status display
        const latestClaim = existingClaims?.[0];

        if (existingClaims?.length > 0) {
          console.log(`✅ User has minted ${mintCount} total (across ${existingClaims.length} claims), limit: ${isUnlimited ? 'unlimited' : mintLimit}`);
          userStatus = {
            hasMinted: true,
            hasShared: latestClaim?.has_shared || false,
            hasClaimed: latestClaim?.has_claimed || false,
            canMint: canMintMore, // Can mint more if under limit
            canClaim: latestClaim?.has_shared && !latestClaim?.has_claimed,
            claimId: latestClaim?.id,
            mintedAt: latestClaim?.minted_at,
            sharedAt: latestClaim?.shared_at,
            claimedAt: latestClaim?.claimed_at,
            mintCount,
            mintLimit: isUnlimited ? null : mintLimit,
            lastMintQuantity: latestClaim?.quantity || 1 // For proportional claim display
          };
        } else {
          console.log(`ℹ️ User has not minted yet`);
          userStatus.canMint = true;
          userStatus.mintCount = 0;
          userStatus.mintLimit = isUnlimited ? null : mintLimit;
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

