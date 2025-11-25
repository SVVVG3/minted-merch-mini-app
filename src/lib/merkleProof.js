import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'viem';
import allowlistData from './beeper-allowlist.json';

/**
 * Generate Merkle proof for a wallet address from the allowlist snapshot
 * Matches Thirdweb's snapshot merkle tree structure
 */
export function generateMerkleProof(walletAddress) {
  try {
    const entries = allowlistData;
    
    console.log(`📋 Loaded ${entries.length} addresses from allowlist`);

    // Find the wallet in the allowlist (case-insensitive search)
    const entry = entries.find(e => e.address.toLowerCase() === walletAddress.toLowerCase());
    
    if (!entry) {
      console.log(`❌ Wallet ${walletAddress} not found in allowlist`);
      return null;
    }

    console.log(`✅ Wallet found in allowlist:`, entry);

    // Create leaf nodes
    // Try simple format: just keccak256(address) - preserving checksum case
    const leaves = entries.map(e => 
      keccak256(e.address) // Use checksummed address from CSV
    );

    // Create Merkle tree
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    console.log(`🌳 Merkle root: ${root}`);

    // Get proof for this wallet (use the checksummed version from CSV)
    const leaf = keccak256(entry.address);
    const proof = tree.getHexProof(leaf);

    console.log(`✅ Generated proof with ${proof.length} elements`);

    return {
      proof,
      quantityLimitPerWallet: entry.maxClaimable,
      pricePerToken: entry.price,
      currency: entry.currencyAddress,
      merkleRoot: root
    };

  } catch (error) {
    console.error('❌ Error generating Merkle proof:', error);
    throw error;
  }
}

