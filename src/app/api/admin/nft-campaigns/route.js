import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

/**
 * GET /api/admin/nft-campaigns
 * List all NFT campaigns (admin only)
 */
export const GET = withAdminAuth(async (request) => {
  try {
    console.log('📋 Fetching all NFT campaigns for admin');

    // Fetch all campaigns with claim stats
    const { data: campaigns, error } = await supabaseAdmin
      .from('nft_mints')
      .select(`
        *,
        claims:nft_mint_claims(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching campaigns:', error);
      return NextResponse.json(
        { error: 'Failed to fetch campaigns' },
        { status: 500 }
      );
    }

    // Transform data to include claim counts
    const campaignsWithStats = campaigns.map(campaign => ({
      ...campaign,
      total_claims: campaign.claims?.[0]?.count || 0
    }));

    console.log(`✅ Found ${campaigns.length} campaigns`);

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithStats
    });

  } catch (error) {
    console.error('❌ Error in admin campaigns endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/nft-campaigns
 * Create new NFT campaign (admin only)
 */
export const POST = withAdminAuth(async (request) => {
  try {
    const body = await request.json();
    const {
      slug,
      title,
      description,
      contractAddress,
      contractChainId = 8453,
      contractType = 'ERC1155',
      tokenId = '0',
      tokenRewardAmount,
      maxSupply,
      startDate,
      endDate,
      imageUrl,
      metadata = {},
      awardsLeaderboardPoints = false,
      pointsPerMint = 1000
    } = body;

    // Validate required fields
    if (!slug || !title || !contractAddress || !tokenRewardAmount || !imageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`➕ Creating new campaign: ${title}`);

    // Create campaign
    const { data: campaign, error } = await supabaseAdmin
      .from('nft_mints')
      .insert({
        slug,
        title,
        description,
        contract_address: contractAddress,
        contract_chain_id: contractChainId,
        contract_type: contractType,
        token_id: tokenId,
        token_reward_amount: tokenRewardAmount,
        max_supply: maxSupply || null,
        start_date: startDate || null,
        end_date: endDate || null,
        image_url: imageUrl,
        metadata,
        is_active: true,
        awards_leaderboard_points: awardsLeaderboardPoints,
        points_per_mint: pointsPerMint
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating campaign:', error);
      
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Campaign slug already exists' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create campaign' },
        { status: 500 }
      );
    }

    console.log(`✅ Campaign created: ${campaign.id}`);

    return NextResponse.json({
      success: true,
      campaign
    });

  } catch (error) {
    console.error('❌ Error in create campaign endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

