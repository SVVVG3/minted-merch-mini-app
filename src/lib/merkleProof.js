import { MerkleTree } from "merkletreejs";
import { encodePacked, keccak256 } from "viem";
import allowlistData from "./beeper-allowlist.json";

/**
 * Generate Merkle proof for a wallet address from the allowlist snapshot
 * Matches Thirdweb's DropERC1155 snapshot merkle tree structure
 *
 * Leaf structure: keccak256(abi.encodePacked(address, tokenId, maxClaimable, price, currency))
 * Note: Thirdweb's DropERC1155 includes tokenId in the leaf encoding
 */
export function generateMerkleProof(walletAddress, tokenId = 0) {
  try {
    const entries = allowlistData;

    console.log(`📋 Loaded ${entries.length} addresses from allowlist`);

    // Find the wallet in the allowlist (case-insensitive search)
    const entry = entries.find(
      (e) => e.address.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!entry) {
      console.log(`❌ Wallet ${walletAddress} not found in allowlist`);
      return null;
    }

    console.log(`✅ Wallet found in allowlist:`, entry);

    // Create leaf nodes using Thirdweb's encoding format
    // CRITICAL: Must match contract's encoding: abi.encodePacked(address, tokenId, maxClaimable, price, currency)
    const leaves = entries.map((e) => {
      const encoded = encodePacked(
        ["address", "uint256", "uint256", "uint256", "address"],
        [
          e.address,
          BigInt(tokenId),
          BigInt(e.maxClaimable),
          BigInt(e.price),
          e.currencyAddress,
        ]
      );
      return keccak256(encoded);
    });

    // Create Merkle tree (sorted pairs to match Thirdweb)
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    console.log(`🌳 Merkle root: ${root}`);

    // Get proof for this wallet using the same encoding
    const leafEncoded = encodePacked(
      ["address", "uint256", "uint256", "uint256", "address"],
      [
        entry.address,
        BigInt(tokenId),
        BigInt(entry.maxClaimable),
        BigInt(entry.price),
        entry.currencyAddress,
      ]
    );
    const leaf = keccak256(leafEncoded);
    const proof = tree.getHexProof(leaf);

    console.log(`✅ Generated proof with ${proof.length} elements`);
    console.log(`🔑 Leaf hash: ${leaf}`);

    return {
      proof,
      quantityLimitPerWallet: entry.maxClaimable,
      pricePerToken: entry.price,
      currency: entry.currencyAddress,
      merkleRoot: root,
    };
  } catch (error) {
    console.error("❌ Error generating Merkle proof:", error);
    throw error;
  }
}
