import { supabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedFid } from "@/lib/userAuth";
import { NextResponse } from "next/server";
import { generateMerkleProof } from "@/lib/merkleProof";

/**
 * POST /api/nft-mints/[slug]/get-proof
 *
 * Fetches allowlist proof using Thirdweb v5 SDK
 * Uses getClaimParams which automatically fetches the correct Merkle proof from Thirdweb
 * This ensures the proof matches the on-chain Merkle root exactly
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
        { error: "Authentication required" },
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
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Fetch campaign from database
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("nft_mints")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (campaignError || !campaign) {
      console.error(`[${requestId}] ❌ Campaign not found:`, campaignError);
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    console.log(`[${requestId}] 📋 Campaign:`, campaign.title);
    console.log(`[${requestId}] 📍 Contract:`, campaign.contract_address);

    // Generate Merkle proof from local allowlist
    console.log(`[${requestId}] 🔍 Generating Merkle proof from allowlist...`);

    try {
      const proofResult = generateMerkleProof(walletAddress);

      if (!proofResult) {
        console.log(`[${requestId}] ❌ Wallet not on allowlist`);
        return NextResponse.json(
          { error: "Your wallet is not on the allowlist for this mint." },
          { status: 403 }
        );
      }

      console.log(`[${requestId}] ✅ Merkle proof generated successfully`);
      console.log(`[${requestId}]    Proof length:`, proofResult.proof.length);
      console.log(`[${requestId}]    Merkle root:`, proofResult.merkleRoot);

      return NextResponse.json({
        proof: proofResult.proof,
        quantityLimitPerWallet: proofResult.quantityLimitPerWallet,
        pricePerToken: proofResult.pricePerToken,
        currency: proofResult.currency,
      });
    } catch (error) {
      console.error(`[${requestId}] ❌ Error generating proof:`, error);

      return NextResponse.json(
        { error: "Failed to generate allowlist proof. Please contact support." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
