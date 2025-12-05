// API endpoint to check NFT-gated eligibility for minting
// Verifies user holds required NFTs before allowing mint

import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { checkNftGatedEligibility } from '@/lib/blockchainAPI';

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    
    // Verify authentication using standard auth helper
    const fid = await getAuthenticatedFid(request);
    if (!fid) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { walletAddresses } = body;

    if (!walletAddresses || !Array.isArray(walletAddresses) || walletAddresses.length === 0) {
      return Response.json({ 
        error: 'walletAddresses array required' 
      }, { status: 400 });
    }

    // Fetch campaign to check if it has NFT gating
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('nft_mints')
      .select('*')
      .eq('slug', slug)
      .single();

    if (campaignError || !campaign) {
      console.error('❌ Campaign not found:', slug);
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check if campaign requires NFT gating
    const metadata = campaign.metadata || {};
    
    if (!metadata.requiresNftGating || !metadata.requiredNfts || metadata.requiredNfts.length === 0) {
      // No NFT gating required - everyone is eligible
      return Response.json({
        eligible: true,
        eligibleQuantity: campaign.mint_limit_per_fid || 1,
        gated: false,
        message: 'This campaign does not require NFT holdings to mint.'
      });
    }

    console.log(`🔒 Checking NFT eligibility for FID ${fid} on campaign ${slug}`);
    console.log(`📋 Required NFTs:`, metadata.requiredNfts);
    console.log(`💳 Checking wallets:`, walletAddresses);

    // Check eligibility using blockchain calls
    const eligibilityResult = await checkNftGatedEligibility(
      walletAddresses,
      metadata.requiredNfts
    );

    // Cap eligible quantity to campaign's mint limit
    const mintLimit = campaign.mint_limit_per_fid || 30;
    const cappedQuantity = Math.min(eligibilityResult.eligibleQuantity, mintLimit);

    // Also check how many the user has already minted
    const { data: existingMints, error: mintsError } = await supabaseAdmin
      .from('nft_mint_claims')
      .select('quantity')
      .eq('campaign_id', campaign.id)
      .eq('user_fid', fid);

    const totalMinted = existingMints?.reduce((sum, claim) => sum + (claim.quantity || 1), 0) || 0;
    const remainingAllowed = Math.max(0, cappedQuantity - totalMinted);

    console.log(`🔒 Eligibility result for FID ${fid}:`, {
      eligible: eligibilityResult.eligible && remainingAllowed > 0,
      completeSets: eligibilityResult.eligibleQuantity,
      cappedQuantity,
      totalMinted,
      remainingAllowed
    });

    return Response.json({
      eligible: eligibilityResult.eligible && remainingAllowed > 0,
      eligibleQuantity: remainingAllowed,
      completeSets: eligibilityResult.eligibleQuantity,
      holdings: eligibilityResult.holdings,
      totalMinted,
      mintLimit,
      gated: true,
      message: eligibilityResult.eligible 
        ? remainingAllowed > 0
          ? `You can mint up to ${remainingAllowed} NFT${remainingAllowed > 1 ? 's' : ''}! (${totalMinted}/${cappedQuantity} already minted)`
          : `You've already minted all ${totalMinted} NFTs you're eligible for.`
        : eligibilityResult.message
    });

  } catch (error) {
    console.error('❌ Error checking NFT eligibility:', error);
    return Response.json({ 
      error: 'Failed to check eligibility',
      details: error.message 
    }, { status: 500 });
  }
}

