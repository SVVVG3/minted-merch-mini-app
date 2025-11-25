import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'viem';
import fs from 'fs';
import path from 'path';

/**
 * Generate Merkle proof for a wallet address from the allowlist snapshot
 * Matches Thirdweb's snapshot merkle tree structure
 */
export function generateMerkleProof(walletAddress, csvPath) {
  try {
    // Read and parse CSV
    const csvFilePath = path.join(process.cwd(), csvPath);
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    
    // Parse CSV (skip header)
    const entries = lines.slice(1).map(line => {
      const [address, maxClaimable, price, currencyAddress] = line.split(',');
      return {
        address: address.toLowerCase(),
        maxClaimable: maxClaimable || '1',
        price: price || '0',
        currencyAddress: currencyAddress || '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
      };
    });

    console.log(`📋 Loaded ${entries.length} addresses from allowlist`);

    // Find the wallet in the allowlist
    const entry = entries.find(e => e.address === walletAddress.toLowerCase());
    
    if (!entry) {
      console.log(`❌ Wallet ${walletAddress} not found in allowlist`);
      return null;
    }

    console.log(`✅ Wallet found in allowlist:`, entry);

    // Create leaf nodes (hash of address)
    // Thirdweb uses keccak256(address) for ERC1155 snapshot leaves
    const leaves = entries.map(e => 
      keccak256(e.address)
    );

    // Create Merkle tree
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    console.log(`🌳 Merkle root: ${root}`);

    // Get proof for this wallet
    const leaf = keccak256(walletAddress.toLowerCase());
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

