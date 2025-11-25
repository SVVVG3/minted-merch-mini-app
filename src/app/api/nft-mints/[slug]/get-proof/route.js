import { NextResponse } from 'next/server';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { setUserContext } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateMerkleProof } from '@/lib/merkleProof';

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
    const authenticatedFid = await getAuthenticatedFid(request);
    if (!authenticatedFid) {
      console.log(`[${requestId}] ❌ Auth failed: No FID`);
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
      .from('nft_mints')
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

    // Fetch proof from Thirdweb Engine API
    console.log(`[${requestId}] 🔍 Fetching proof from Thirdweb...`);
    
    try {
      // Try Thirdweb's Engine API for getting claimer proofs
      const chainId = 8453; // Base mainnet
      const apiUrl = `https://8453.rpc.thirdweb.com/${process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}/extensions/erc1155-claimable/getClaimerProofs`;
      
      console.log(`[${requestId}] 📞 Calling Thirdweb API...`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contract: campaign.contract_address,
          claimer: walletAddress,
          tokenId: tokenId || '0'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${requestId}] ❌ Thirdweb API error:`, response.status, errorText);
        
        // Fallback to local generation
        console.log(`[${requestId}] 🔄 Falling back to local proof generation...`);
        const proofResult = generateMerkleProof(walletAddress);

        if (!proofResult) {
          return NextResponse.json(
            { error: 'Your wallet is not on the allowlist for this mint.' },
            { status: 403 }
          );
        }

        return NextResponse.json({
          proof: proofResult.proof,
          quantityLimitPerWallet: proofResult.quantityLimitPerWallet,
          pricePerToken: proofResult.pricePerToken,
          currency: proofResult.currency
        });
      }

      const proofData = await response.json();
      console.log(`[${requestId}] ✅ Thirdweb proof received:`, JSON.stringify(proofData, null, 2));

      // Extract proof details
      const proof = proofData.proof || [];
      const maxClaimable = proofData.maxClaimable || proofData.quantityLimitPerWallet || '1';
      const price = proofData.price || proofData.pricePerToken || '0';
      const currency = proofData.currencyAddress || proofData.currency || '0x0000000000000000000000000000000000000000';

      console.log(`[${requestId}] ✅ Proof length:`, proof.length);

      return NextResponse.json({
        proof,
        quantityLimitPerWallet: maxClaimable,
        pricePerToken: price,
        currency
      });

    } catch (error) {
      console.error(`[${requestId}] ❌ Error fetching proof:`, error);
      
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

