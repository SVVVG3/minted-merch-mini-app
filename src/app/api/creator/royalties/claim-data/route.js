/**
 * GET /api/creator/royalties/claim-data
 * Generates an on-demand Thirdweb airdrop signature for all pending royalties
 * (batched into a single on-chain transaction).
 * SECURITY: Requires JWT auth + Merch Mogul status + has pending royalties + has wallet
 */

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateClaimSignature, getDefaultClaimDeadline } from '@/lib/claimSignatureService';
import { randomBytes } from 'crypto';

const MERCH_MOGUL_THRESHOLD = 50_000_000;
const TOKEN_DECIMALS = 18n;

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authResult = await verifyFarcasterUser(token);
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const fid = authResult.fid;
    const supabase = getSupabaseAdmin();

    // Verify Merch Mogul + get wallet
    const { data: profile } = await supabase
      .from('profiles')
      .select('staked_balance, primary_eth_address')
      .eq('fid', fid)
      .single();

    const stakedBalance = Number(profile?.staked_balance || 0);
    if (stakedBalance < MERCH_MOGUL_THRESHOLD) {
      return NextResponse.json({ success: false, error: 'Merch Mogul status required' }, { status: 403 });
    }

    const walletAddress = profile?.primary_eth_address;
    if (!walletAddress) {
      return NextResponse.json({
        success: false,
        error: 'No wallet address found. Please connect a wallet to your Farcaster account to claim.',
      }, { status: 400 });
    }

    // Fetch all pending royalties
    const { data: pendingRoyalties, error: royaltiesError } = await supabase
      .from('creator_royalties')
      .select('id, mintedmerch_amount')
      .eq('creator_fid', fid)
      .eq('status', 'pending');

    if (royaltiesError) {
      throw new Error(`Failed to fetch royalties: ${royaltiesError.message}`);
    }

    if (!pendingRoyalties || pendingRoyalties.length === 0) {
      return NextResponse.json({ success: false, error: 'No pending royalties to claim' }, { status: 400 });
    }

    const totalHuman = pendingRoyalties.reduce((s, r) => s + (r.mintedmerch_amount || 0), 0);
    // Convert human-readable amount to on-chain wei (18 decimals)
    const totalWei = BigInt(totalHuman) * (10n ** TOKEN_DECIMALS);

    // Generate a unique UID for this batch (prevents replay attacks)
    const claimUid = randomBytes(32).toString('hex');
    const deadline  = getDefaultClaimDeadline(); // 30 days

    console.log(`💰 Generating creator royalty claim for FID ${fid}: ${totalHuman.toLocaleString()} $mintedmerch (${pendingRoyalties.length} royalties)`);

    const { req, signature } = await generateClaimSignature({
      wallet:   walletAddress,
      amount:   totalWei.toString(),
      payoutId: claimUid,
      deadline,
    });

    // Stamp the claim_uid + deadline on each pending royalty so we can match claim-complete
    const royaltyIds = pendingRoyalties.map(r => r.id);
    await supabase
      .from('creator_royalties')
      .update({ claim_uid: claimUid, claim_deadline: deadline.toISOString() })
      .in('id', royaltyIds);

    console.log(`✅ Claim data generated for FID ${fid}, UID: ${claimUid.slice(0, 10)}...`);

    // Serialize BigInt fields as strings — same pattern used by Missions claim-data route
    const serializedReq = {
      uid:                 req.uid,
      tokenAddress:        req.tokenAddress,
      expirationTimestamp: req.expirationTimestamp.toString(),
      contents:            req.contents.map(c => ({
        recipient: c.recipient,
        amount:    c.amount.toString(),
      })),
    };

    return NextResponse.json({
      success: true,
      data: {
        royaltyIds,
        totalAmount: totalHuman,
        walletAddress,
        req:             serializedReq,
        signature,
        contractAddress: process.env.AIRDROP_CONTRACT_ADDRESS,
        deadline:        deadline.toISOString(),
      },
    });
  } catch (err) {
    console.error('❌ /api/creator/royalties/claim-data GET:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
