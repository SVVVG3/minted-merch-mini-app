"use client";

import { shareToFarcaster } from "@/lib/farcasterShare";
import { triggerHaptic } from "@/lib/haptics";
import { useFarcaster } from "@/lib/useFarcaster";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

/**
 * MintPageClient - Main UI for NFT Mint Campaign
 *
 * User Flow:
 * 1. Load campaign data + auto-register user
 * 2. Mint NFT (WalletConnect)
 * 3. MANDATORY share to Farcaster
 * 4. Claim tokens (after share)
 * 5. Show staking teaser + CTA to shop
 */
export default function MintPageClient({ slug }) {
  const router = useRouter();
  const {
    user: farcasterUser,
    sessionToken,
    isInFarcaster,
    isReady,
  } = useFarcaster();

  // Wagmi hooks for NFT minting
  const {
    writeContract: writeMintContract,
    data: mintTxHash,
    isPending: isMintTxPending,
    error: mintWriteError,
  } = useWriteContract();
  const { isLoading: isMintConfirming, isSuccess: isMintConfirmed } =
    useWaitForTransactionReceipt({
      hash: mintTxHash,
    });

  // Wagmi hooks for token claiming (like Ambassador program)
  const {
    writeContract: writeClaimContract,
    data: claimTxHash,
    isPending: isClaimTxPending,
    error: claimWriteError,
  } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } =
    useWaitForTransactionReceipt({
      hash: claimTxHash,
    });

  // Campaign data
  const [campaign, setCampaign] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mint state
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState(null);
  const [claimId, setClaimId] = useState(null);
  const [mintQuantity, setMintQuantity] = useState(1);

  // Share state
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [hasShared, setHasShared] = useState(false);

  // Claim state
  const [claimError, setClaimError] = useState(null);
  const [hasClaimed, setHasClaimed] = useState(false);

  // Staking teaser
  const [showStakingTeaser, setShowStakingTeaser] = useState(false);

  // Auto-register user on page load
  useEffect(() => {
    if (farcasterUser && sessionToken) {
      console.log("📝 Auto-registering user...");

      fetch("/api/register-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          fid: farcasterUser.fid,
          username: farcasterUser.username,
          displayName: farcasterUser.displayName || farcasterUser.username,
          bio: farcasterUser.bio || null,
          pfpUrl: farcasterUser.pfpUrl || null,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("✅ User registered/updated:", data);
        })
        .catch((err) => {
          console.error("⚠️  Profile registration failed (non-blocking):", err);
        });
    }
  }, [farcasterUser, sessionToken]);

  // Fetch campaign data
  useEffect(() => {
    async function fetchCampaign() {
      try {
        setLoading(true);

        const headers = {};
        if (sessionToken) {
          headers["Authorization"] = `Bearer ${sessionToken}`;
        }

        const response = await fetch(`/api/nft-mints/${slug}`, { headers });

        if (!response.ok) {
          throw new Error("Campaign not found");
        }

        const data = await response.json();
        console.log("📋 Campaign data:", data);

        setCampaign(data.campaign);
        setUserStatus(data.userStatus);

        // Set initial state based on user status
        if (data.userStatus.claimId) {
          setClaimId(data.userStatus.claimId);
        }
        if (data.userStatus.hasShared) {
          setHasShared(true);
        }
        if (data.userStatus.hasClaimed) {
          setHasClaimed(true);
          setShowStakingTeaser(true);
        }
      } catch (err) {
        console.error("❌ Error fetching campaign:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchCampaign();
    }
  }, [slug, sessionToken]);

  // Watch for mint transaction confirmation
  useEffect(() => {
    if (isMintConfirmed && mintTxHash) {
      console.log("✅ NFT mint confirmed! TX:", mintTxHash);

      // Record mint in backend
      const recordMint = async () => {
        try {
          const { sdk } = await import("@/lib/frame");
          const accounts = await sdk.wallet.ethProvider.request({
            method: "eth_requestAccounts",
          });
          const walletAddress = accounts[0];

          console.log("💾 Recording mint in database...");
          const response = await fetch(`/api/nft-mints/${slug}/mint`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              transactionHash: mintTxHash,
              walletAddress,
              tokenId: campaign.tokenId || "0",
            }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log("✅ Mint recorded:", data);

            // Update state
            setClaimId(data.claim.id); // Fix: API returns data.claim.id, not data.claimId
            setUserStatus((prev) => ({
              ...prev,
              hasMinted: true,
              canMint: false,
            }));
            setShowShareModal(true);
          } else {
            console.error("⚠️  Failed to record mint");
          }
        } catch (err) {
          console.error("❌ Error recording mint:", err);
        } finally {
          setIsMinting(false);
        }
      };

      recordMint();
    }
  }, [isMintConfirmed, mintTxHash]);

  // Watch for Wagmi errors
  useEffect(() => {
    if (claimWriteError) {
      console.error("❌ Wagmi claim error:", claimWriteError);
      setClaimError(claimWriteError.message || "Transaction failed");
    }
  }, [claimWriteError]);

  useEffect(() => {
    if (mintWriteError) {
      console.error("❌ Wagmi mint error:", mintWriteError);
      
      // Parse the error and show a cleaner message
      const errorMsg = mintWriteError.message || "";
      let cleanError = "Transaction failed. Please try again.";
      
      if (errorMsg.includes("User rejected") || errorMsg.includes("rejected the request")) {
        cleanError = "Transaction cancelled.";
      } else if (errorMsg.includes("insufficient funds")) {
        cleanError = "Insufficient funds in your wallet.";
      } else if (errorMsg.includes("!Qty") || errorMsg.includes("exceeds maximum")) {
        cleanError = "You have reached your mint limit.";
      } else if (errorMsg.includes("not eligible") || errorMsg.includes("allowlist")) {
        cleanError = "Your wallet is not eligible for this mint.";
      } else if (errorMsg.includes("sold out") || errorMsg.includes("max supply")) {
        cleanError = "This NFT is sold out.";
      }
      
      setMintError(cleanError);
      setIsMinting(false);
    }
  }, [mintWriteError]);

  // Watch for claim transaction confirmation
  useEffect(() => {
    if (isClaimConfirmed && claimTxHash) {
      console.log("✅ Token claim confirmed! TX:", claimTxHash);

      // Mark as claimed in backend
      const markClaimed = async () => {
        try {
          console.log("💾 Marking claim as complete in database...");
          const response = await fetch(
            `/api/nft-mints/claims/${claimId}/mark-claimed`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionToken}`,
              },
              body: JSON.stringify({
                transactionHash: claimTxHash,
              }),
            }
          );

          if (response.ok) {
            console.log("✅ Claim marked as complete!");
            setHasClaimed(true);
            setShowStakingTeaser(true);
          } else {
            console.error("⚠️  Failed to mark claim as complete");
          }
        } catch (err) {
          console.error("❌ Error marking claim:", err);
        }
      };

      markClaimed();
    }
  }, [isClaimConfirmed, claimTxHash]);

  // Auto-scroll to show success screen after claim
  useEffect(() => {
    if (hasClaimed && showStakingTeaser) {
      console.log("📜 Scrolling to show success screen...");
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      }, 300);
    }
  }, [hasClaimed, showStakingTeaser]);

  // Handle NFT mint using Thirdweb's claimTo (automatically handles allowlist proofs)
  const handleMint = async () => {
    console.log("🎨 Mint button clicked");
    triggerHaptic("medium", isInFarcaster);

    if (!farcasterUser || !sessionToken) {
      setMintError("Please sign in to mint");
      return;
    }

    if (!campaign) {
      setMintError("Campaign data not loaded");
      return;
    }

    try {
      setIsMinting(true);
      setMintError(null);

      console.log("🎨 Starting mint process...");
      console.log("📋 Contract:", campaign.contractAddress);
      console.log("🎫 Token ID:", campaign.tokenId || 0);

      // Get wallet address
      const { sdk } = await import("@/lib/frame");
      const accounts = await sdk.wallet.ethProvider.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || !accounts[0]) {
        throw new Error("No wallet connected");
      }

      const walletAddress = accounts[0];
      console.log("💳 Wallet address:", walletAddress);

      // Fetch claim params from backend (uses Thirdweb getClaimParams)
      console.log("🔍 Fetching claim params from backend...");
      console.log("📊 Mint quantity:", mintQuantity);
      const proofResponse = await fetch(`/api/nft-mints/${slug}/get-proof`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          walletAddress,
          tokenId: campaign.tokenId || 0,
          quantity: mintQuantity,
        }),
      });

      if (!proofResponse.ok) {
        const errorData = await proofResponse.json().catch(() => ({}));
        console.error("❌ Failed to fetch claim params:", errorData);
        throw new Error(
          errorData.error || "You are not eligible to mint this NFT"
        );
      }

      const { pricePerToken, currency, allowlistProof } =
        await proofResponse.json();
      console.log("✅ Claim params received from Thirdweb");
      console.log("   Price per token:", pricePerToken);
      console.log("   Currency:", currency);
      console.log("   Proof length:", allowlistProof.proof.length);

      // ERC1155 claim ABI
      const erc1155ClaimABI = [
        {
          name: "claim",
          type: "function",
          inputs: [
            { name: "receiver", type: "address" },
            { name: "tokenId", type: "uint256" },
            { name: "quantity", type: "uint256" },
            { name: "currency", type: "address" },
            { name: "pricePerToken", type: "uint256" },
            {
              name: "allowlistProof",
              type: "tuple",
              components: [
                { name: "proof", type: "bytes32[]" },
                { name: "quantityLimitPerWallet", type: "uint256" },
                { name: "pricePerToken", type: "uint256" },
                { name: "currency", type: "address" },
              ],
            },
            { name: "data", type: "bytes" },
          ],
          outputs: [],
        },
      ];

      // Build allowlist proof tuple from Thirdweb's claim params (as-is)
      const allowlistProofTuple = {
        proof: allowlistProof.proof,
        quantityLimitPerWallet: BigInt(allowlistProof.quantityLimitPerWallet),
        pricePerToken: BigInt(allowlistProof.pricePerToken),
        currency: allowlistProof.currency,
      };

      console.log("📤 Sending transaction via Wagmi...");

      // Send via Wagmi using the exact params from Thirdweb
      // Scale value for batch mints
      const totalValue = BigInt(pricePerToken) * BigInt(mintQuantity);
      
      writeMintContract({
        address: campaign.contractAddress,
        abi: erc1155ClaimABI,
        functionName: "claim",
        args: [
          walletAddress,
          BigInt(campaign.tokenId || 0),
          BigInt(mintQuantity), // Use selected quantity
          currency, // Use main currency from claimParams
          BigInt(pricePerToken), // Use main pricePerToken from claimParams
          allowlistProofTuple, // Use allowlist proof tuple
          "0x",
        ],
        value: totalValue, // Total cost for batch mint
      });

      console.log("✅ Mint transaction sent - waiting for user approval...");
      // Transaction will be handled by useEffect watching isMintConfirmed
    } catch (err) {
      console.error("❌ Mint error:", err);

      // Provide clean error messages for common failures
      const errorMsg = err.message || "";
      let cleanError = "Failed to mint NFT. Please try again.";

      if (errorMsg.includes("User rejected") || errorMsg.includes("rejected the request")) {
        cleanError = "Transaction cancelled.";
      } else if (errorMsg.includes("allowlist") || errorMsg.includes("not eligible")) {
        cleanError = "Your wallet is not eligible for this mint.";
      } else if (errorMsg.includes("!Qty") || errorMsg.includes("exceeds maximum")) {
        cleanError = "You have reached your mint limit.";
      } else if (errorMsg.includes("insufficient funds")) {
        cleanError = "Insufficient funds in your wallet.";
      } else if (errorMsg.includes("No wallet connected")) {
        cleanError = "Please connect your wallet to mint.";
      }

      setMintError(cleanError);
      setIsMinting(false);
    }
  };

  // Handle share to Farcaster
  const handleShare = async () => {
    console.log("🔘 Share button clicked!");
    triggerHaptic("medium", isInFarcaster);
    console.log("   Claim ID:", claimId);
    console.log("   Session Token:", sessionToken ? "Present" : "Missing");
    console.log("   Campaign:", campaign?.slug);

    if (!claimId) {
      console.error("❌ No claim ID available");
      setMintError("Claim ID not found. Please refresh and try again.");
      return;
    }

    if (!sessionToken) {
      console.error("❌ No session token available");
      setMintError("Session token not found. Please refresh and try again.");
      return;
    }

    try {
      setIsSharing(true);
      setMintError(null);

      // Get share config from campaign metadata
      const shareText =
        campaign.metadata?.shareText ||
        `Just minted ${campaign.title}! 🎨\n\nMint yours and claim tokens 👇`;

      // Use share page URL (frame button links to main page)
      const sharePageUrl = `${window.location.origin}/share/${slug}`;
      const additionalEmbeds = campaign.metadata?.shareEmbeds || [];
      const shareEmbeds = [sharePageUrl, ...additionalEmbeds];

      console.log("📤 Sharing to Farcaster...");
      console.log("   Text:", shareText);
      console.log("   Embeds:", shareEmbeds);

      // Open Farcaster compose window
      const shareResult = await shareToFarcaster({
        text: shareText,
        embeds: shareEmbeds,
        isInFarcaster,
      });

      console.log("🔍 Share result:", shareResult);

      if (shareResult) {
        console.log("✅ Share window opened");

        // Mark as shared in backend (unlocks claim button)
        const markSharedResponse = await fetch(
          `/api/nft-mints/claims/${claimId}/mark-shared`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({}),
          }
        );

        if (markSharedResponse.ok) {
          console.log("✅ Marked as shared");
          setHasShared(true);
          setShowShareModal(false); // Close modal

          // Auto-scroll to show Claim button
          setTimeout(() => {
            console.log("📜 Scrolling to show Claim button...");
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            });
          }, 400);
        } else {
          const errorData = await markSharedResponse.json();
          console.error("❌ Failed to mark as shared:", errorData);
          setMintError(
            `Failed to mark share: ${errorData.error || "Unknown error"}`
          );
        }
      } else {
        console.log("ℹ️ Share window not opened (user may have cancelled)");
      }
    } catch (err) {
      console.error("❌ Share error:", err);
      setMintError(`Share failed: ${err.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  // Handle token claim using Wagmi (same as Ambassador program)
  const handleClaim = async () => {
    console.log("💰 Claim button clicked!");
    triggerHaptic("medium", isInFarcaster);

    if (!claimId || !sessionToken) {
      setClaimError("Missing claim data. Please refresh and try again.");
      return;
    }

    try {
      setClaimError(null);

      console.log("📡 Fetching claim data from API...");

      // Get claim signature and params from backend
      const claimDataResponse = await fetch(
        `/api/nft-mints/claims/${claimId}/claim-data`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (!claimDataResponse.ok) {
        const errorData = await claimDataResponse.json();
        throw new Error(errorData.error || "Failed to fetch claim data");
      }

      const { claimData } = await claimDataResponse.json();
      console.log("✅ Claim data received:", claimData);

      // Convert to BigInt (same as Ambassador program)
      const reqWithBigInt = {
        uid: claimData.req.uid,
        tokenAddress: claimData.req.tokenAddress,
        expirationTimestamp: BigInt(claimData.req.expirationTimestamp),
        contents: claimData.req.contents.map((content) => ({
          recipient: content.recipient,
          amount: BigInt(content.amount),
        })),
      };

      console.log("📝 Prepared claim request");

      // Airdrop contract ABI (same as Ambassador program)
      const airdropABI = [
        {
          name: "airdropERC20WithSignature",
          type: "function",
          inputs: [
            {
              name: "req",
              type: "tuple",
              components: [
                { name: "uid", type: "bytes32" },
                { name: "tokenAddress", type: "address" },
                { name: "expirationTimestamp", type: "uint256" },
                {
                  name: "contents",
                  type: "tuple[]",
                  components: [
                    { name: "recipient", type: "address" },
                    { name: "amount", type: "uint256" },
                  ],
                },
              ],
            },
            { name: "signature", type: "bytes" },
          ],
          outputs: [],
        },
      ];

      // Call Wagmi writeContract (triggers wallet approval)
      console.log("📤 Calling writeContract...");
      writeClaimContract({
        address: claimData.contractAddress,
        abi: airdropABI,
        functionName: "airdropERC20WithSignature",
        args: [reqWithBigInt, claimData.signature],
      });

      console.log("✅ Claim transaction sent - waiting for user approval...");
      // Transaction will be handled by useEffect watching isClaimConfirmed
    } catch (err) {
      console.error("❌ Claim error:", err);
      setClaimError(err.message || "Failed to claim tokens");
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading campaign...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">
            ❌ {error || "Campaign not found"}
          </p>
          <button
            onClick={() => {
              triggerHaptic("medium", isInFarcaster);
              router.push("/");
            }}
            className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200"
          >
            Back to Shop
          </button>
        </div>
      </div>
    );
  }

  // Calculate if user can mint (include Wagmi transaction states)
  const isMintingProcess = isMinting || isMintTxPending || isMintConfirming;
  const canMint = userStatus?.canMint !== false && !isMintingProcess;

  // Calculate if user is claiming (include Wagmi transaction states)
  const isClaimingProcess = isClaimTxPending || isClaimConfirming;

  // Helper function to format token rewards (e.g., 100000 * 3 mints = "300K $mintedmerch")
  const formatTokenReward = (mintCount, baseReward) => {
    const total = mintCount * baseReward;
    if (total >= 1000000) {
      return `${(total / 1000000).toFixed(total % 1000000 === 0 ? 0 : 1)}M $mintedmerch`;
    } else if (total >= 1000) {
      return `${(total / 1000).toFixed(total % 1000 === 0 ? 0 : 0)}K $mintedmerch`;
    }
    return `${total.toLocaleString()} $mintedmerch`;
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 py-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-2 text-center">
        <button
          onClick={() => {
            triggerHaptic("light", isInFarcaster);
            router.push("/");
          }}
          className="text-gray-400 hover:text-white inline-block"
        >
          ← Back to Shop
        </button>
      </div>

      {/* Header Image - Use collab logo if specified in metadata, otherwise spinner logo */}
      <div className="mb-4 relative rounded-xl overflow-hidden flex justify-center items-center">
        <Image
          src={campaign.metadata?.headerImage || "/MintedMerchSpinnerLogo.png"}
          alt={campaign.metadata?.headerAlt || "Minted Merch"}
          width={400}
          height={campaign.metadata?.headerImage ? 100 : 200}
          className="object-contain"
          priority
        />
      </div>

      {/* NFT Image */}
      <div className="mb-8 relative aspect-square rounded-2xl overflow-hidden bg-gray-900">
        <Image
          src={campaign.imageUrl}
          alt={campaign.title}
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Campaign Info */}
      <div className="mb-6 space-y-4">
        <h1 className="text-3xl font-bold text-center">{campaign.title}</h1>
        <p className="text-gray-300 text-lg">{campaign.description}</p>
      </div>

      {/* Main Action Section - MOVED UP: Mint button before info sections */}
      <div className="space-y-4 mb-8">
        {/* STATE 1: Can Mint - Show Quantity Selector + Mint Button */}
        {((!userStatus?.hasMinted) || (hasClaimed && canMint)) && (
          <>
            {/* Quantity Selector - Only show if mint limit > 1 or unlimited */}
            {canMint && (userStatus?.mintLimit === null || userStatus?.mintLimit > 1 || !userStatus?.mintLimit) && (
              <div className="flex items-center justify-center gap-4 mb-4">
                <span className="text-gray-400 text-sm">Quantity:</span>
                <div className="flex items-center bg-gray-800 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setMintQuantity(Math.max(1, mintQuantity - 1))}
                    disabled={mintQuantity <= 1}
                    className={`px-4 py-2 text-lg font-bold transition-colors ${
                      mintQuantity <= 1 ? "text-gray-600 cursor-not-allowed" : "text-white hover:bg-gray-700"
                    }`}
                  >
                    −
                  </button>
                  <span className="px-4 py-2 text-white font-bold min-w-[3rem] text-center">
                    {mintQuantity}
                  </span>
                  <button
                    onClick={() => {
                      const maxAllowed = userStatus?.mintLimit || 20;
                      const remaining = maxAllowed - (userStatus?.mintCount || 0);
                      setMintQuantity(Math.min(remaining, mintQuantity + 1));
                    }}
                    disabled={userStatus?.mintLimit && mintQuantity >= (userStatus.mintLimit - (userStatus?.mintCount || 0))}
                    className={`px-4 py-2 text-lg font-bold transition-colors ${
                      userStatus?.mintLimit && mintQuantity >= (userStatus.mintLimit - (userStatus?.mintCount || 0))
                        ? "text-gray-600 cursor-not-allowed"
                        : "text-white hover:bg-gray-700"
                    }`}
                  >
                    +
                  </button>
                </div>
                {userStatus?.mintLimit && (
                  <span className="text-gray-500 text-sm">
                    ({userStatus?.mintCount || 0}/{userStatus.mintLimit} minted)
                  </span>
                )}
              </div>
            )}
            
            <button
              onClick={handleMint}
              disabled={!canMint}
              className={`w-full py-4 rounded-xl text-xl font-bold transition-all ${
                canMint
                  ? "bg-white text-black hover:bg-gray-200 hover:scale-105"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isMintConfirming
                ? "Confirming..."
                : isMintTxPending
                ? "Approve in wallet..."
                : isMinting
                ? "Preparing..."
                : canMint
                ? (mintQuantity > 1 
                    ? `${campaign.metadata?.mintButtonText || campaign.metadata?.buttonText || "Mint"} (${mintQuantity})`
                    : (campaign.metadata?.mintButtonText || campaign.metadata?.buttonText || "Mint NFT"))
                : "❌ Mint Unavailable"}
            </button>

            {mintError && (
              <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                {mintError}
              </div>
            )}

            {!canMint &&
              campaign.maxSupply &&
              campaign.totalMints >= campaign.maxSupply && (
                <p className="text-center text-gray-400">
                  Maximum supply reached ({campaign.maxSupply} mints)
                </p>
              )}
          </>
        )}

        {/* STATE 2: Minted but not shared - Show Share Button (REQUIRED) */}
        {userStatus?.hasMinted && !hasShared && !showShareModal && (
          <div className="p-6 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500 rounded-xl space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl">🎉</div>
              <h3 className="text-2xl font-bold">NFT Minted!</h3>
              <p className="text-gray-300">
                Share your mint to claim $mintedmerch
              </p>
            </div>

            <button
              onClick={handleShare}
              disabled={isSharing}
              className="w-full py-4 bg-[#6A3CFF] text-white rounded-xl font-bold hover:bg-[#5A2FE6] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
            >
              {isSharing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Opening Share...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
                  </svg>
                  Share to Farcaster (Required)
                </>
              )}
            </button>
          </div>
        )}

        {/* STATE 3: Shared but not claimed - Show Claim Button */}
        {userStatus?.hasMinted && hasShared && !hasClaimed && (
          <>
            <button
              onClick={handleClaim}
              disabled={isClaimingProcess}
              className="w-full py-4 bg-[#3eb489] hover:bg-[#359970] text-white rounded-xl text-xl font-bold disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
            >
              {isClaimConfirming
                ? "Confirming..."
                : isClaimTxPending
                ? "Approve in wallet..."
                : "Claim $mintedmerch"}
            </button>

            {claimError && (
              <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                {claimError}
              </div>
            )}
          </>
        )}

        {/* STATE 4: Claimed - Clean Success Screen (use ASCII only for Beeper) */}
        {hasClaimed && showStakingTeaser && (
          campaign.metadata?.successAscii ? (
            // Beeper-style ASCII success screen
            <div className="space-y-2.5 font-mono">
              <div className="bg-black border-4 border-[#77fb82] rounded-lg p-3.5 shadow-lg shadow-[#77fb82]/20">
                <div className="text-[#77fb82] space-y-2.5">
                  <div className="text-center">
                    <pre className="text-xs leading-snug">{campaign.metadata.successAscii}</pre>
                  </div>
                  <div className="border-2 border-[#77fb82] p-3 bg-black/50">
                    <p className="text-sm mb-2">{">"} REWARDS_CLAIMED</p>
                    <div className="space-y-1.5 text-sm">
                      <p className="flex justify-between">
                        <span>TOKENS:</span>
                        <span className="text-white font-bold">
                          {userStatus?.tokenRewardAmount ? `${Number(userStatus.tokenRewardAmount).toLocaleString()} $MINTEDMERCH` : `${(campaign.tokenRewardAmount || 100000).toLocaleString()} $MINTEDMERCH`}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span>NFT:</span>
                        <span className="text-white font-bold">{userStatus?.mintCount || 1}x {campaign.title}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>STATUS:</span>
                        <span className="text-white font-bold">[CONFIRMED]</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Clean Minted Merch success screen (default)
            <div className="bg-gradient-to-b from-gray-900 to-black border border-[#3eb489] rounded-xl p-6 text-center space-y-4">
              <h3 className="text-2xl font-bold text-[#3eb489]">Mint & Claim Complete!</h3>
              <p className="text-gray-300">
                You've minted {userStatus?.mintCount || 1} NFT{(userStatus?.mintCount || 1) > 1 ? 's' : ''} and claimed{' '}
                <span className="text-[#3eb489] font-bold">
                  {formatTokenReward(userStatus?.mintCount || 1, campaign.tokenRewardAmount || 100000)}
                </span>
                {' '}- thank you for supporting Minted Merch!
              </p>
              {canMint && (
                <p className="text-sm text-gray-400">
                  You can mint more below! ({userStatus?.mintCount || 0}/{userStatus?.mintLimit || '∞'} minted)
                </p>
              )}
            </div>
          )
        )}
      </div>

      {/* Where Staking Meets Merch Section - Show FIRST after user has minted */}
      {userStatus?.hasMinted && (
        <div className="border border-[#3eb489]/50 rounded-xl p-6 mb-8 space-y-4" style={{ backgroundColor: 'rgba(62, 180, 137, 0.1)' }}>
          <p className="text-lg font-bold text-center" style={{ color: '#3eb489' }}>
            Where Staking Meets Merch!
          </p>
          <p className="text-gray-300 text-sm text-center">
            Stake any amount to earn daily rewards! Stake 50M+ $mintedmerch to become a Merch Mogul and unlock: exclusive collab partnerships, the ability to place custom orders, group chat access, and 15% off store wide.
          </p>
          <button
            onClick={() => {
              triggerHaptic("light", isInFarcaster);
              router.push("/stake");
            }}
            className="w-full py-3 rounded-lg font-bold transition-all hover:scale-105"
            style={{ backgroundColor: '#3eb489', color: '#000' }}
          >
            Start Staking →
          </button>
        </div>
      )}

      {/* About Minted Merch Section */}
      <div className="border border-gray-800 rounded-xl p-6 mb-8 space-y-4">
        {/* Spinner Logo */}
        <div className="flex justify-center">
          <Image
            src="/MintedMerchSpinnerLogo.png"
            alt="Minted Merch"
            width={240}
            height={240}
            className="object-contain"
          />
        </div>

        <div className="space-y-3 text-gray-300 text-center">
          <p className="text-lg font-bold text-white">
            Where Tokens Meet Merch
          </p>

          <div className="space-y-2 text-left">
            <div className="flex items-start gap-2">
              <span className="text-sm">✅</span>
              <span className="text-sm">Exclusive collabs & drops</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm">✅</span>
              <span className="text-sm">
                Shop with 1200+ coins across 20+ chains
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm">✅</span>
              <span className="text-sm">
                Free daily spins w/ leaderboard & raffles
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm">✅</span>
              <span className="text-sm">
                Win $mintedmerch, gift cards, & merch
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-900 rounded-lg space-y-2">
          <h3 className="text-lg font-bold text-center">
            Become a Merch Mogul 🤌
          </h3>
          <ul className="text-sm text-gray-400 space-y-1 ml-4">
            <li>• Exclusive Collab Partner Access</li>
            <li>• Custom Merch Orders</li>
            <li>• Group Chat Access</li>
            <li>• 15% off store wide</li>
            <li>• Ambassador Program</li>
          </ul>
        </div>
      </div>

      {/* Where Staking Meets Merch Section - Show at bottom for users who haven't minted */}
      {!userStatus?.hasMinted && (
        <div className="border border-[#3eb489]/50 rounded-xl p-6 mb-8 space-y-4" style={{ backgroundColor: 'rgba(62, 180, 137, 0.1)' }}>
          <p className="text-lg font-bold text-center" style={{ color: '#3eb489' }}>
            Where Staking Meets Merch!
          </p>
          <p className="text-gray-300 text-sm text-center">
            Stake any amount to earn daily rewards! Stake 50M+ $mintedmerch to become a Merch Mogul and unlock: exclusive collab partnerships, the ability to place custom orders, group chat access, and 15% off store wide.
          </p>
          <button
            onClick={() => {
              triggerHaptic("light", isInFarcaster);
              router.push("/stake");
            }}
            className="w-full py-3 rounded-lg font-bold transition-all hover:scale-105"
            style={{ backgroundColor: '#3eb489', color: '#000' }}
          >
            Start Staking →
          </button>
        </div>
      )}

      {/* Share Modal (Displayed as overlay when showShareModal is true) */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
          style={{ pointerEvents: "auto" }}
        >
          <div className="bg-black border border-gray-800 rounded-2xl p-8 max-w-md w-full space-y-6">
            <div className="text-center space-y-2">
              <div className="text-5xl">🎉</div>
              <h3 className="text-2xl font-bold">You Minted!</h3>
              <p className="text-gray-300">Share to claim $mintedmerch</p>
            </div>

            <button
              onClick={(e) => {
                console.log("🖱️ Share button CLICKED!", {
                  isSharing,
                  claimId,
                  sessionToken: !!sessionToken,
                });
                e.preventDefault();
                e.stopPropagation();
                handleShare();
              }}
              disabled={isSharing}
              style={{ pointerEvents: isSharing ? "none" : "auto" }}
              className="w-full py-4 bg-[#6A3CFF] text-white rounded-xl font-bold hover:bg-[#5A2FE6] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
            >
              {isSharing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Opening Share...
                </>
              ) : (
                <>
                  {/* Official Farcaster Logo (2024 rebrand) */}
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 520 457"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"
                      fill="currentColor"
                    />
                  </svg>
                  Share to Farcaster
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
