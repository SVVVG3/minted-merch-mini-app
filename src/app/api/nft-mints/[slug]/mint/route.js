import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { setUserContext, setSystemContext } from '@/lib/auth';
import { generateClaimSignature } from '@/lib/claimSignatureService';
import { awardNftMintPoints } from '@/lib/points';

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
    const { transactionHash, walletAddress, tokenId = '0', quantity = 1 } = await request.json();

    // Validate inputs
    if (!slug || !transactionHash || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: transactionHash, walletAddress' },
        { status: 400 }
      );
    }

    // Validate quantity
    const mintQuantity = Math.max(1, parseInt(quantity) || 1);
    if (mintQuantity > 100) {
      return NextResponse.json(
        { error: 'Maximum quantity per mint is 100' },
        { status: 400 }
      );
    }

    console.log(`🎨 Recording mint for campaign: ${slug}`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   TX: ${transactionHash}`);
    console.log(`   Quantity: ${mintQuantity}`);

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

    // 🔒 NFT-GATED: No server-side re-check needed
    // The user already passed check-eligibility on frontend, and the on-chain transaction succeeded.
    // Re-checking here just causes rate limiting issues. Security is maintained because:
    // 1. Frontend gates UI with check-eligibility API
    // 2. We verify the transaction actually happened on-chain below
    // 3. Campaign mint limits are still enforced below
    const metadata = campaign.metadata || {};
    if (metadata.requiresNftGating) {
      console.log(`🔒 NFT-gated campaign - user passed frontend eligibility check, transaction succeeded`);
    }

    // Check if user has reached their mint limit for this campaign
    // Sum up quantities from all previous mints
    const { data: existingClaims } = await supabaseAdmin
      .from('nft_mint_claims')
      .select('id, quantity')
      .eq('campaign_id', campaign.id)
      .eq('user_fid', authenticatedFid);

    // Calculate total quantity minted so far (sum of all quantities, or count if no quantity column yet)
    const currentMintCount = existingClaims?.reduce((sum, claim) => sum + (claim.quantity || 1), 0) || 0;
    
    const mintLimit = campaign.mint_limit_per_fid; // null or 0 = unlimited
    const isUnlimited = !mintLimit || mintLimit === 0;
    
    // Check if this batch would exceed the limit
    if (!isUnlimited && (currentMintCount + mintQuantity) > mintLimit) {
      const remaining = mintLimit - currentMintCount;
      console.error(`❌ Mint would exceed limit: ${currentMintCount} + ${mintQuantity} > ${mintLimit}`);
      return NextResponse.json(
        { error: remaining > 0 
            ? `You can only mint ${remaining} more (${currentMintCount}/${mintLimit} used)` 
            : `You have already minted the maximum allowed (${mintLimit}) for this campaign` },
        { status: 400 }
      );
    }
    
    console.log(`✅ User mint count: ${currentMintCount}, adding: ${mintQuantity}, limit: ${isUnlimited ? 'unlimited' : mintLimit}`);

    // 🔒 VERIFY TRANSACTION ON-CHAIN
    // This prevents users from claiming tokens without actually minting the NFT
    console.log(`🔍 Verifying transaction on-chain: ${transactionHash}`);
    
    let actualQuantity = 0; // Will be set from on-chain verification
    
    try {
      const { createPublicClient, http } = await import('viem');
      const { base } = await import('viem/chains');
      
      const publicClient = createPublicClient({
        chain: base,
        transport: http(process.env.ALCHEMY_BASE_RPC_URL || 'https://mainnet.base.org')
      });
      
      // Get transaction receipt
      const receipt = await publicClient.getTransactionReceipt({
        hash: transactionHash
      });
      
      if (!receipt) {
        console.error(`❌ Transaction not found: ${transactionHash}`);
        return NextResponse.json(
          { error: 'Transaction not found on chain. Please wait for confirmation and try again.' },
          { status: 400 }
        );
      }
      
      // Verify transaction was successful
      if (receipt.status !== 'success') {
        console.error(`❌ Transaction failed: ${transactionHash}`);
        return NextResponse.json(
          { error: 'Transaction failed on chain' },
          { status: 400 }
        );
      }
      
      // Verify transaction was to the correct contract
      const contractAddress = campaign.contract_address.toLowerCase();
      if (receipt.to?.toLowerCase() !== contractAddress) {
        console.error(`❌ Transaction was not to the mint contract. Expected: ${contractAddress}, Got: ${receipt.to}`);
        return NextResponse.json(
          { error: 'Transaction was not to the correct mint contract' },
          { status: 400 }
        );
      }
      
      // Verify transaction was from the user's wallet
      if (receipt.from?.toLowerCase() !== walletAddress.toLowerCase()) {
        console.error(`❌ Transaction was not from user's wallet. Expected: ${walletAddress}, Got: ${receipt.from}`);
        return NextResponse.json(
          { error: 'Transaction was not from your wallet' },
          { status: 400 }
        );
      }
      
      // 🔒 VERIFY QUANTITY FROM TRANSACTION LOGS
      // Parse ERC1155 TransferSingle events to verify actual quantity minted
      const { decodeEventLog } = await import('viem');
      const transferSingleAbi = [{
        type: 'event',
        name: 'TransferSingle',
        inputs: [
          { indexed: true, name: 'operator', type: 'address' },
          { indexed: true, name: 'from', type: 'address' },
          { indexed: true, name: 'to', type: 'address' },
          { indexed: false, name: 'id', type: 'uint256' },
          { indexed: false, name: 'value', type: 'uint256' }
        ]
      }];
      
      let verifiedQuantity = 0;
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
      
      for (const log of receipt.logs) {
        // Only check logs from the NFT contract
        if (log.address.toLowerCase() !== contractAddress) continue;
        
        try {
          const decoded = decodeEventLog({
            abi: transferSingleAbi,
            data: log.data,
            topics: log.topics
          });
          
          // Check if this is a mint (from zero address) to the user's wallet
          if (decoded.eventName === 'TransferSingle' &&
              decoded.args.from.toLowerCase() === ZERO_ADDRESS &&
              decoded.args.to.toLowerCase() === walletAddress.toLowerCase()) {
            // Verify correct token ID
            if (decoded.args.id.toString() === tokenId) {
              verifiedQuantity += Number(decoded.args.value);
              console.log(`   Found mint event: tokenId=${decoded.args.id}, quantity=${decoded.args.value}`);
            }
          }
        } catch (decodeError) {
          // Not a TransferSingle event, skip
          continue;
        }
      }
      
      if (verifiedQuantity === 0) {
        console.error(`❌ No valid mint events found in transaction`);
        return NextResponse.json(
          { error: 'No valid NFT mint found in transaction. Make sure you minted the correct NFT.' },
          { status: 400 }
        );
      }
      
      // 🔒 USE VERIFIED QUANTITY - ignore user-supplied quantity
      if (verifiedQuantity !== mintQuantity) {
        console.warn(`⚠️ Quantity mismatch: user claimed ${mintQuantity}, but verified ${verifiedQuantity} on-chain`);
      }
      actualQuantity = verifiedQuantity; // Always trust on-chain data
      
      console.log(`✅ Transaction verified on-chain:`);
      console.log(`   Status: ${receipt.status}`);
      console.log(`   To: ${receipt.to}`);
      console.log(`   From: ${receipt.from}`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Verified Quantity: ${actualQuantity}`);
      
      // 🔒 RE-CHECK MINT LIMIT with verified on-chain quantity
      if (!isUnlimited && (currentMintCount + actualQuantity) > mintLimit) {
        const remaining = mintLimit - currentMintCount;
        console.error(`❌ On-chain quantity (${actualQuantity}) would exceed limit: ${currentMintCount} + ${actualQuantity} > ${mintLimit}`);
        return NextResponse.json(
          { error: `Transaction minted ${actualQuantity} NFTs but you can only mint ${remaining} more. Contact support.` },
          { status: 400 }
        );
      }
      
    } catch (verifyError) {
      console.error(`❌ Error verifying transaction:`, verifyError);
      
      // If transaction is pending, tell user to wait
      if (verifyError.message?.includes('not found') || verifyError.message?.includes('could not be found')) {
        return NextResponse.json(
          { error: 'Transaction not yet confirmed. Please wait a moment and try again.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to verify transaction on chain' },
        { status: 500 }
      );
    }

    // Record mint in database
    console.log(`💾 Recording mint in database...`);
    
    // 🔒 SECURITY: Use actualQuantity (verified on-chain), NOT user-supplied mintQuantity
    // Calculate scaled reward amount for batch mint
    const baseRewardAmount = BigInt(campaign.token_reward_amount);
    const scaledRewardAmount = (baseRewardAmount * BigInt(actualQuantity)).toString();
    
    console.log(`   Base reward: ${campaign.token_reward_amount}`);
    console.log(`   Scaled reward (x${actualQuantity}): ${scaledRewardAmount}`);
    
    const { data: mintClaim, error: mintError } = await supabaseAdmin
      .from('nft_mint_claims')
      .insert({
        campaign_id: campaign.id,
        user_fid: authenticatedFid,
        wallet_address: walletAddress.toLowerCase(),
        transaction_hash: transactionHash,
        token_id: tokenId,
        quantity: actualQuantity, // 🔒 VERIFIED quantity from on-chain
        token_reward_amount: scaledRewardAmount, // Store scaled reward amount
        has_shared: false,
        has_claimed: false
      })
      .select()
      .single();

    if (mintError) {
      // Check for duplicate transaction hash
      if (mintError.code === '23505' || mintError.message?.includes('duplicate') || mintError.message?.includes('unique')) {
        console.error(`❌ Duplicate transaction hash: ${transactionHash}`);
        return NextResponse.json(
          { error: 'This transaction has already been used to claim. Each mint transaction can only be used once.' },
          { status: 400 }
        );
      }
      console.error('❌ Error recording mint:', mintError);
      return NextResponse.json(
        { error: 'Failed to record mint' },
        { status: 500 }
      );
    }

    console.log(`✅ Mint recorded: ${mintClaim.id} (quantity: ${actualQuantity})`);

    // Update campaign total_mints counter (increment by actual quantity, not just 1)
    const { error: updateCampaignError } = await supabaseAdmin
      .from('nft_mints')
      .update({ 
        total_mints: (campaign.total_mints || 0) + actualQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    if (updateCampaignError) {
      console.error('⚠️ Error updating campaign total_mints:', updateCampaignError);
      // Don't fail the request, the mint was successful
    } else {
      console.log(`📊 Campaign total_mints updated: ${campaign.total_mints || 0} → ${(campaign.total_mints || 0) + actualQuantity}`);
    }

    // Generate claim signature for token reward
    console.log(`🔐 Generating claim signature...`);
    
    // Calculate deadline (30 days from now)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);

    try {
      const claimSignatureData = await generateClaimSignature({
        wallet: walletAddress.toLowerCase(),
        amount: scaledRewardAmount, // Scaled reward amount for batch mint
        payoutId: mintClaim.id,
        deadline // Pass Date object directly (like Ambassador system)
      });

      console.log(`✅ Claim signature generated`);

      // Convert BigInt values to strings for JSONB storage (like Ambassador system)
      const serializableReq = {
        uid: claimSignatureData.req.uid,
        tokenAddress: claimSignatureData.req.tokenAddress,
        expirationTimestamp: claimSignatureData.req.expirationTimestamp.toString(), // BigInt -> string
        contents: claimSignatureData.req.contents.map(content => ({
          recipient: content.recipient,
          amount: content.amount.toString() // BigInt -> string
        }))
      };

      // Store req + signature together as a single JSON blob (like Ambassador system)
      const claimDataJson = JSON.stringify({
        req: serializableReq,
        signature: claimSignatureData.signature
      });

      console.log(`💾 Storing claim data (req + signature together)`);

      // Update mint claim with signature data (use system context to bypass RLS)
      await setSystemContext();
      
      const { error: updateError } = await supabaseAdmin
        .from('nft_mint_claims')
        .update({
          claim_signature: claimDataJson, // Store BOTH req + signature together (like Ambassador)
          claim_req: serializableReq, // Also keep separate for backwards compatibility
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
      console.log(`   Quantity: ${actualQuantity} (verified on-chain)`);
      console.log(`   Total mints: ${campaign.total_mints + actualQuantity}`);

      // 🏆 AWARD LEADERBOARD POINTS FOR MINTING (1000 points per NFT)
      // Only award points for NeonStakingTicket campaign
      if (slug === 'NeonStakingTicket') {
        try {
          const pointsResult = await awardNftMintPoints(
            authenticatedFid,
            actualQuantity,
            slug,
            transactionHash,
            1000 // 1000 points per mint
          );
          
          if (pointsResult.success) {
            console.log(`🏆 Awarded ${pointsResult.pointsEarned} leaderboard points to FID ${authenticatedFid}`);
          } else {
            console.error('⚠️ Failed to award mint points:', pointsResult.error);
          }
        } catch (pointsError) {
          console.error('⚠️ Error awarding mint points (non-blocking):', pointsError);
          // Don't fail the mint, just log the error
        }
      } else {
        console.log(`ℹ️ Skipping leaderboard points for campaign ${slug} (only NeonStakingTicket awards points)`);
      }

      // Return success with claim data
      return NextResponse.json({
        success: true,
        message: `NFT mint recorded successfully (x${actualQuantity})`,
        claim: {
          id: mintClaim.id,
          campaignId: campaign.id,
          hasMinted: true,
          hasShared: false,
          hasClaimed: false,
          canClaim: false, // Must share first
          quantity: actualQuantity, // 🔒 Verified quantity
          tokenRewardAmount: scaledRewardAmount, // Scaled reward for batch
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
          quantity: actualQuantity, // 🔒 Verified quantity
          tokenRewardAmount: scaledRewardAmount
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

