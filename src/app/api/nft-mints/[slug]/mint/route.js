import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { setUserContext, setSystemContext } from '@/lib/auth';
import { generateClaimSignature } from '@/lib/claimSignatureService';

/**
 * POST /api/nft-mints/[slug]/mint
 * 
 * Record user's NFT mint and generate token claim signature
 * 
 * Authentication: REQUIRED (Farcaster JWT)
 * 
 * @param {string} transactionHash - On-chain transaction hash of the mint
 * @param {string} walletAddress - User's wallet address that minted
 * @param {string} tokenId - Token ID minted (usually "0" for ERC1155)
 * 
 * @returns {Object} Claim data with signature for airdrop contract
 */
export async function POST(request, { params }) {
  try {
    const { slug } = params;
    const { transactionHash, walletAddress, tokenId = '0' } = await request.json();

    // Validate inputs
    if (!slug || !transactionHash || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: transactionHash, walletAddress' },
        { status: 400 }
      );
    }

    console.log(`🎨 Recording mint for campaign: ${slug}`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   TX: ${transactionHash}`);

    // 🔒 AUTHENTICATE USER (REQUIRED)
    const authenticatedFid = await getAuthenticatedFid(request);
    if (!authenticatedFid) {
      return NextResponse.json(
        { error: 'Unauthorized - Farcaster authentication required' },
        { status: 401 }
      );
    }

    console.log(`✅ Authenticated as FID ${authenticatedFid}`);

    // 🆕 AUTO-REGISTER USER IF FIRST TIME VISITOR
    // This ensures profile exists before we try to insert mint claim (FK constraint)
    console.log(`👤 Checking if profile exists for FID ${authenticatedFid}...`);
    
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('fid')
      .eq('fid', authenticatedFid)
      .single();

    if (!existingProfile) {
      console.log(`📝 Creating profile for first-time user FID ${authenticatedFid}`);
      
      // Call existing register-user endpoint to create full profile
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const registerResponse = await fetch(`${baseUrl}/api/register-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') // Pass through JWT
          },
          body: JSON.stringify({
            fid: authenticatedFid,
            username: farcasterUser.username,
            displayName: farcasterUser.displayName || farcasterUser.username,
            bio: farcasterUser.bio || null,
            pfpUrl: farcasterUser.pfpUrl || null
          })
        });

        if (!registerResponse.ok) {
          console.error('❌ Failed to create profile:', await registerResponse.text());
          return NextResponse.json(
            { error: 'Failed to create user profile' },
            { status: 500 }
          );
        }

        console.log(`✅ Profile created successfully for FID ${authenticatedFid}`);
      } catch (registerError) {
        console.error('❌ Error calling register-user:', registerError);
        return NextResponse.json(
          { error: 'Failed to initialize user profile' },
          { status: 500 }
        );
      }
    } else {
      console.log(`✅ Profile already exists for FID ${authenticatedFid}`);
    }

    // Set user context for RLS
    await setUserContext(authenticatedFid);

    // Fetch campaign
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

    // Check if campaign has reached max supply
    if (campaign.max_supply && campaign.total_mints >= campaign.max_supply) {
      console.error(`❌ Campaign at max supply: ${campaign.total_mints}/${campaign.max_supply}`);
      return NextResponse.json(
        { error: 'Campaign has reached maximum supply' },
        { status: 400 }
      );
    }

    // Check if campaign has ended
    if (campaign.end_date && new Date(campaign.end_date) < new Date()) {
      console.error(`❌ Campaign has ended: ${campaign.end_date}`);
      return NextResponse.json(
        { error: 'Campaign has ended' },
        { status: 400 }
      );
    }

    // Check if user has already minted (RLS will only show their own claims)
    const { data: existingClaim } = await supabaseAdmin
      .from('nft_mint_claims')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('user_fid', authenticatedFid)
      .single();

    if (existingClaim) {
      console.error(`❌ User has already minted: ${existingClaim.id}`);
      return NextResponse.json(
        { error: 'You have already minted this NFT' },
        { status: 400 }
      );
    }

    // TODO: Verify NFT ownership via Zapper API or on-chain call
    // For MVP, we trust the transaction hash provided by user
    // In production, you should verify the transaction actually happened
    console.log(`⚠️  Skipping on-chain verification for MVP (trusting tx hash)`);

    // Record mint in database
    console.log(`💾 Recording mint in database...`);
    
    const { data: mintClaim, error: mintError } = await supabaseAdmin
      .from('nft_mint_claims')
      .insert({
        campaign_id: campaign.id,
        user_fid: authenticatedFid,
        wallet_address: walletAddress.toLowerCase(),
        transaction_hash: transactionHash,
        token_id: tokenId,
        has_shared: false,
        has_claimed: false
      })
      .select()
      .single();

    if (mintError) {
      console.error('❌ Error recording mint:', mintError);
      return NextResponse.json(
        { error: 'Failed to record mint' },
        { status: 500 }
      );
    }

    console.log(`✅ Mint recorded: ${mintClaim.id}`);

    // Generate claim signature for token reward
    console.log(`🔐 Generating claim signature...`);
    
    // Calculate deadline (30 days from now)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);

    try {
      const claimSignatureData = await generateClaimSignature({
        wallet: walletAddress.toLowerCase(),
        amount: campaign.token_reward_amount, // Already in wei format
        payoutId: mintClaim.id,
        deadline: Math.floor(deadline.getTime() / 1000) // Unix timestamp
      });

      console.log(`✅ Claim signature generated`);

      // Update mint claim with signature data (use system context to bypass RLS)
      await setSystemContext();
      
      const { error: updateError } = await supabaseAdmin
        .from('nft_mint_claims')
        .update({
          claim_signature: claimSignatureData.signature,
          claim_req: claimSignatureData.req, // Store the exact signed req object from Thirdweb
          claim_signature_generated_at: new Date().toISOString(),
          claim_signature_expires_at: deadline.toISOString()
        })
        .eq('id', mintClaim.id);

      if (updateError) {
        console.error('⚠️  Error saving signature:', updateError);
        // Don't fail the request, signature generation can be retried
      }

      // Reset to user context
      await setUserContext(authenticatedFid);

      console.log(`🎉 Mint recorded successfully!`);
      console.log(`   Campaign: ${campaign.title}`);
      console.log(`   User FID: ${authenticatedFid}`);
      console.log(`   Claim ID: ${mintClaim.id}`);
      console.log(`   Total mints: ${campaign.total_mints + 1}`); // +1 because trigger updates after this

      // Return success with claim data
      return NextResponse.json({
        success: true,
        message: 'NFT mint recorded successfully',
        claim: {
          id: mintClaim.id,
          campaignId: campaign.id,
          hasMinted: true,
          hasShared: false,
          hasClaimed: false,
          canClaim: false, // Must share first
          tokenRewardAmount: campaign.token_reward_amount,
          signatureExpiresAt: deadline.toISOString()
        }
      });

    } catch (signatureError) {
      console.error('❌ Error generating claim signature:', signatureError);
      
      // Mint was recorded, but signature failed
      // User can still share and try to claim later
      return NextResponse.json({
        success: true,
        warning: 'Mint recorded but claim signature generation failed',
        claim: {
          id: mintClaim.id,
          campaignId: campaign.id,
          hasMinted: true,
          hasShared: false,
          hasClaimed: false,
          canClaim: false,
          tokenRewardAmount: campaign.token_reward_amount
        }
      }, { status: 201 });
    }

  } catch (error) {
    console.error('❌ Error in mint endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

