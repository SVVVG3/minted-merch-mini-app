import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { createThirdwebClient, getContract } from 'thirdweb';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { base } from 'thirdweb/chains';
import { generateAirdropSignatureERC20 } from 'thirdweb/extensions/airdrop';
import { isAddress, keccak256, toHex } from 'thirdweb/utils';
import { getAddress } from 'viem';

// Contract configuration
const ADMIN_PRIVATE_KEY = process.env.ADMIN_WALLET_PRIVATE_KEY;
const AIRDROP_CONTRACT_ADDRESS = process.env.AIRDROP_CONTRACT_ADDRESS;
const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
const CHAIN_ID = 8453; // Base

/**
 * Generate claim signature for a specific token
 */
async function generateTokenClaimSignature({ wallet, tokenAddress, amount, claimId, deadline }) {
  if (!isAddress(wallet)) {
    throw new Error('Invalid wallet address');
  }
  
  const amountBigInt = BigInt(amount);
  if (amountBigInt <= 0n) {
    throw new Error('Invalid amount: must be greater than 0');
  }
  
  if (!ADMIN_PRIVATE_KEY) {
    throw new Error('ADMIN_WALLET_PRIVATE_KEY not configured');
  }
  
  if (!AIRDROP_CONTRACT_ADDRESS) {
    throw new Error('AIRDROP_CONTRACT_ADDRESS not configured');
  }
  
  if (!THIRDWEB_CLIENT_ID) {
    throw new Error('NEXT_PUBLIC_THIRDWEB_CLIENT_ID not configured');
  }
  
  const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
  
  // Initialize Thirdweb client
  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
  
  // Get airdrop contract
  const airdropContract = getContract({
    client,
    chain: base,
    address: AIRDROP_CONTRACT_ADDRESS
  });
  
  // Create admin account
  const adminAccount = privateKeyToAccount({
    client,
    privateKey: ADMIN_PRIVATE_KEY
  });
  
  // Generate unique UID from claimId
  const uid = keccak256(toHex(claimId));
  
  // Generate signature using Thirdweb SDK
  const { req, signature } = await generateAirdropSignatureERC20({
    contract: airdropContract,
    account: adminAccount,
    airdropRequest: {
      uid,
      tokenAddress,
      expirationTimestamp: deadlineDate,
      contents: [{
        recipient: wallet,
        amount: amountBigInt
      }]
    }
  });
  
  return { req, signature };
}

/**
 * POST /api/dailyspin/claim-data
 * 
 * Generate claim signatures for unclaimed winnings.
 * Supports claiming all unclaimed tokens or a specific token.
 * 
 * Body:
 * - walletAddress: User's wallet address for receiving tokens
 * - tokenId: (optional) Specific token ID to claim, or omit for all
 * 
 * Returns signatures for each token type that needs claiming.
 * 
 * Requires authentication.
 */
export async function POST(request) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    // Authenticate user
    const fid = await getAuthenticatedFid(request);
    if (!fid) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { walletAddress, tokenId } = body;

    // Validate wallet address
    if (!walletAddress || !isAddress(walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Valid wallet address required' },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] 🔐 Generating claim data for FID ${fid}, wallet ${walletAddress}`);

    // Build query for unclaimed winnings
    let query = supabaseAdmin
      .from('spin_winnings')
      .select(`
        id,
        amount,
        usd_value,
        spin_tokens (
          id,
          symbol,
          name,
          contract_address,
          decimals
        )
      `)
      .eq('user_fid', fid)
      .eq('claimed', false);

    // Filter by specific token if provided
    if (tokenId) {
      query = query.eq('token_id', tokenId);
    }

    const { data: unclaimedWinnings, error: winningsError } = await query;

    if (winningsError) {
      console.error(`[${requestId}] Error fetching unclaimed winnings:`, winningsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch winnings' },
        { status: 500 }
      );
    }

    if (!unclaimedWinnings || unclaimedWinnings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No unclaimed winnings found' },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] Found ${unclaimedWinnings.length} unclaimed winnings`);

    // Group winnings by token
    const winningsByToken = {};
    for (const winning of unclaimedWinnings) {
      const tokenKey = winning.spin_tokens.id;
      if (!winningsByToken[tokenKey]) {
        winningsByToken[tokenKey] = {
          token: winning.spin_tokens,
          totalAmount: BigInt(0),
          totalUsdValue: 0,
          winningIds: []
        };
      }
      winningsByToken[tokenKey].totalAmount += BigInt(winning.amount);
      winningsByToken[tokenKey].totalUsdValue += parseFloat(winning.usd_value) || 0;
      winningsByToken[tokenKey].winningIds.push(winning.id);
    }

    // Generate claim signature for each unique token
    const claims = [];
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30); // 30-day validity

    for (const [tokenKey, group] of Object.entries(winningsByToken)) {
      try {
        // Create unique claim ID combining user FID, token, and timestamp
        const claimId = `dailyspin-${fid}-${tokenKey}-${Date.now()}`;

        console.log(`[${requestId}] Generating signature for ${group.token.symbol}:`, {
          amount: group.totalAmount.toString(),
          winnings: group.winningIds.length
        });

        const { req, signature } = await generateTokenClaimSignature({
          wallet: walletAddress.toLowerCase(),
          tokenAddress: group.token.contract_address,
          amount: group.totalAmount.toString(),
          claimId,
          deadline
        });

        // Convert BigInt values to strings for JSON serialization
        const serializableReq = {
          uid: req.uid,
          tokenAddress: req.tokenAddress,
          expirationTimestamp: req.expirationTimestamp.toString(),
          contents: req.contents.map(content => ({
            recipient: content.recipient,
            amount: content.amount.toString()
          }))
        };

        claims.push({
          tokenId: group.token.id,
          symbol: group.token.symbol,
          name: group.token.name,
          contractAddress: getAddress(group.token.contract_address),
          decimals: group.token.decimals,
          totalAmount: group.totalAmount.toString(),
          displayAmount: (Number(group.totalAmount) / Math.pow(10, group.token.decimals)).toFixed(4),
          totalUsdValue: group.totalUsdValue.toFixed(4),
          winningIds: group.winningIds,
          claimData: {
            contractAddress: getAddress(AIRDROP_CONTRACT_ADDRESS),
            chainId: CHAIN_ID,
            req: serializableReq,
            signature
          }
        });

        console.log(`[${requestId}] ✅ Signature generated for ${group.token.symbol}`);

      } catch (signatureError) {
        console.error(`[${requestId}] ❌ Error generating signature for ${group.token.symbol}:`, signatureError);
        return NextResponse.json(
          { success: false, error: `Failed to generate claim for ${group.token.symbol}` },
          { status: 500 }
        );
      }
    }

    console.log(`[${requestId}] ✅ Generated ${claims.length} claim signatures for FID ${fid}`);

    return NextResponse.json({
      success: true,
      claims,
      totalTokenTypes: claims.length,
      totalWinnings: unclaimedWinnings.length,
      walletAddress: getAddress(walletAddress),
      expiresAt: deadline.toISOString()
    });

  } catch (error) {
    console.error(`[${requestId}] ❌ Error in /api/dailyspin/claim-data:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

