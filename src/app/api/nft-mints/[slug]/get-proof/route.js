import { supabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedFid } from "@/lib/userAuth";
import { NextResponse } from "next/server";
import { createThirdwebClient, getContract } from "thirdweb";
import { base } from "thirdweb/chains";
import { getClaimParams } from "thirdweb/utils";

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

    // Fetch Merkle proof using Thirdweb v5 SDK
    console.log(`[${requestId}] 🔍 Fetching claim params from Thirdweb SDK...`);

    try {
      // Create Thirdweb client (use secret key for server-side calls)
      const client = createThirdwebClient({
        secretKey: process.env.THIRDWEB_SECRET_KEY,
      });

      // Get contract instance
      const contract = getContract({
        client,
        chain: base,
        address: campaign.contract_address,
      });

      console.log(`[${requestId}] 📡 Calling getClaimParams...`);

      // getClaimParams automatically fetches the Merkle proof from Thirdweb's backend
      // This ensures we get the EXACT proof that matches the on-chain Merkle root
      const claimParams = await getClaimParams({
        contract,
        to: walletAddress,
        quantity: BigInt(1),
        type: "erc1155",
        tokenId: BigInt(tokenId || 0),
        from: walletAddress, // Required for allowlist verification
      });

      console.log(`[${requestId}] ✅ Claim params received from Thirdweb`);
      console.log(
        `[${requestId}]    Has allowlist proof:`,
        !!claimParams.allowlistProof
      );
      console.log(
        `[${requestId}]    Price per token:`,
        claimParams.pricePerToken?.toString()
      );
      console.log(
        `[${requestId}]    Currency:`,
        claimParams.currency
      );

      if (claimParams.allowlistProof) {
        console.log(
          `[${requestId}]    Proof length:`,
          claimParams.allowlistProof.proof?.length || 0
        );
      }

      // Extract the allowlist proof
      const allowlistProof = claimParams.allowlistProof;

      if (
        !allowlistProof ||
        !allowlistProof.proof ||
        allowlistProof.proof.length === 0
      ) {
        console.log(
          `[${requestId}] ❌ No allowlist proof - wallet may not be eligible`
        );
        return NextResponse.json(
          { error: "Your wallet is not on the allowlist for this mint." },
          { status: 403 }
        );
      }

      // Use the MAIN claimParams pricePerToken, not the allowlistProof one
      // The allowlistProof.pricePerToken is often uint256 max
      return NextResponse.json({
        proof: allowlistProof.proof,
        quantityLimitPerWallet:
          allowlistProof.quantityLimitPerWallet?.toString() || "1",
        pricePerToken: claimParams.pricePerToken?.toString() || "0",
        currency: claimParams.currency || "0x0000000000000000000000000000000000000000",
      });
    } catch (thirdwebError) {
      console.error(`[${requestId}] ❌ Thirdweb SDK error:`, thirdwebError);
      console.error(`[${requestId}]    Error details:`, thirdwebError.message);

      // If Thirdweb returns an error, it might mean the wallet isn't eligible
      if (
        thirdwebError.message?.includes("not eligible") ||
        thirdwebError.message?.includes("allowlist")
      ) {
        return NextResponse.json(
          { error: "Your wallet is not on the allowlist for this mint." },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          error:
            "Failed to fetch claim parameters from Thirdweb. Please try again.",
        },
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
