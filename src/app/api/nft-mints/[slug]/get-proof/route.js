import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getContract } from 'thirdweb';
import { getActiveClaimCondition } from 'thirdweb/extensions/erc1155';
import { fetchProofsERC1155, tokenMerkleRoot } from 'thirdweb/extensions/airdrop';
import { base } from 'thirdweb/chains';
import { client } from '@/lib/thirdwebClient';

/**
 * POST /api/nft-mints/[slug]/get-proof
 * 
 * Fetches allowlist proof for a wallet address from Thirdweb
 * Required for private/allowlisted NFT mints
 */
export async function POST(request, { params }) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] 🔍 GET PROOF REQUEST`);

  try {
    const { slug } = params;
    const body = await request.json();
    const { walletAddress, tokenId } = body;

    // Authenticate request
    const { authenticatedFid, error: authError } = await authenticateRequest(request);
    if (authError) {
      console.log(`[${requestId}] ❌ Auth failed:`, authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`[${requestId}] FID:`, authenticatedFid);
    console.log(`[${requestId}] Campaign slug:`, slug);
    console.log(`[${requestId}] Wallet:`, walletAddress);
    console.log(`[${requestId}] Token ID:`, tokenId);

    // Validate inputs
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Fetch campaign from database
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('nft_mint_campaigns')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (campaignError || !campaign) {
      console.error(`[${requestId}] ❌ Campaign not found:`, campaignError);
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    console.log(`[${requestId}] 📋 Campaign:`, campaign.title);
    console.log(`[${requestId}] 📍 Contract:`, campaign.contract_address);

    // Get contract instance
    const contract = getContract({
      client,
      chain: base,
      address: campaign.contract_address
    });

    // Fetch active claim condition to get merkle root and other details
    console.log(`[${requestId}] 🔍 Fetching active claim condition...`);
    
    try {
      const claimCondition = await getActiveClaimCondition({
        contract,
        tokenId: BigInt(tokenId || 0)
      });

      console.log(`[${requestId}] ✅ Claim condition received`);
      console.log(`[${requestId}]    Merkle root:`, claimCondition.merkleRoot);
      console.log(`[${requestId}]    Currency:`, claimCondition.currency);
      console.log(`[${requestId}]    Price:`, claimCondition.pricePerToken?.toString());
      console.log(`[${requestId}]    Quantity limit:`, claimCondition.quantityLimitPerWallet?.toString());

      // If there's no merkle root, it's a public claim (no allowlist)
      if (!claimCondition.merkleRoot || claimCondition.merkleRoot === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        console.log(`[${requestId}] ℹ️  No merkle root - public claim`);
        return NextResponse.json({
          proof: [],
          quantityLimitPerWallet: claimCondition.quantityLimitPerWallet?.toString() || '1',
          pricePerToken: claimCondition.pricePerToken?.toString() || '0',
          currency: claimCondition.currency || '0x0000000000000000000000000000000000000000'
        });
      }

      // For allowlisted claims, try using Thirdweb SDK first
      console.log(`[${requestId}] 🔍 Fetching Merkle proof using Thirdweb SDK...`);
      
      try {
        const merkleRoot = await tokenMerkleRoot({
          contract,
          tokenAddress: campaign.contract_address
        });
        
        console.log(`[${requestId}] 📋 Retrieved merkle root:`, merkleRoot);
        
        const proofs = await fetchProofsERC1155({
          contract,
          recipient: walletAddress,
          merkleRoot
        });
        
        console.log(`[${requestId}] ✅ Merkle proof received from SDK`);
        console.log(`[${requestId}]    Proof:`, proofs);
        
        return NextResponse.json({
          proof: proofs || [],
          quantityLimitPerWallet: claimCondition.quantityLimitPerWallet?.toString() || '1',
          pricePerToken: claimCondition.pricePerToken?.toString() || '0',
          currency: claimCondition.currency || '0x0000000000000000000000000000000000000000'
        });
        
      } catch (sdkError) {
        console.error(`[${requestId}] ⚠️  SDK proof fetch failed, trying alternative method:`, sdkError.message);
        
        // Fallback: try direct API call
        const chainId = 8453; // Base mainnet
        const apiUrl = `https://${chainId}.rpc.thirdweb.com/${process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}/contract/${campaign.contract_address}/erc1155/claim-conditions/${tokenId || 0}/getClaimerProofs?claimer=${walletAddress}`;
        
        console.log(`[${requestId}] 🔄 Trying direct API:`, apiUrl);
        
        const proofResponse = await fetch(apiUrl);

        if (!proofResponse.ok) {
          const errorText = await proofResponse.text();
          console.error(`[${requestId}] ❌ API proof fetch failed:`, errorText);
          
          // Wallet not on allowlist
          if (proofResponse.status === 404 || errorText.includes('not found')) {
            return NextResponse.json(
              { error: 'Your wallet is not on the allowlist for this mint.' },
              { status: 403 }
            );
          }
          
          throw new Error(`Both SDK and API proof fetch failed`);
        }

        const proofData = await proofResponse.json();
        console.log(`[${requestId}] ✅ Merkle proof received from API`);

        return NextResponse.json({
          proof: proofData.proof || [],
          quantityLimitPerWallet: proofData.maxClaimable || claimCondition.quantityLimitPerWallet?.toString() || '1',
          pricePerToken: proofData.price || claimCondition.pricePerToken?.toString() || '0',
          currency: proofData.currencyAddress || claimCondition.currency || '0x0000000000000000000000000000000000000000'
        });
      }

    } catch (error) {
      console.error(`[${requestId}] ❌ Error:`, error);
      
      return NextResponse.json(
        { error: 'Failed to fetch allowlist proof. Please contact support.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

