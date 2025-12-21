import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { generateClaimSignature } from '@/lib/claimSignatureService';
import { getAddress } from 'viem';

// Airdrop contract address
const AIRDROP_CONTRACT_ADDRESS = '0x8569755C6fa4127b3601846077FFB5D083586500';
const CHAIN_ID = 8453; // Base
const MIN_NEYNAR_SCORE = 0.9; // Minimum Neynar score required to claim

/**
 * GET /api/follow/claim-data
 * 
 * Generate claim signature for the 100k token reward
 * Requirements:
 * - User has Neynar score >= 0.9
 * - User has completed all tasks
 * - User has shared (share-before-claim)
 * - User hasn't claimed yet
 */
export async function GET(request) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    // Authenticate user
    const fid = await getAuthenticatedFid(request);
    if (!fid) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`[${requestId}] 🔐 Generating follow reward claim for FID ${fid}`);

    // Get user's follow reward record
    const { data: reward, error: rewardError } = await supabaseAdmin
      .from('follow_rewards')
      .select('*')
      .eq('user_fid', fid)
      .single();

    if (rewardError || !reward) {
      console.error(`[${requestId}] ❌ No reward record found`);
      return NextResponse.json(
        { error: 'Please complete all tasks first' },
        { status: 400 }
      );
    }

    // Check Neynar score requirement
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('neynar_score')
      .eq('fid', fid)
      .single();

    const neynarScore = profile?.neynar_score ? parseFloat(profile.neynar_score) : null;
    if (neynarScore === null || neynarScore < MIN_NEYNAR_SCORE) {
      console.error(`[${requestId}] ❌ Neynar score ${neynarScore} below minimum ${MIN_NEYNAR_SCORE}`);
      return NextResponse.json(
        { error: `This reward requires a Neynar score of ${MIN_NEYNAR_SCORE} or higher. Your score: ${neynarScore?.toFixed(2) || 'unknown'}` },
        { status: 403 }
      );
    }

    // Check if user has shared (share-before-claim requirement)
    if (!reward.has_shared) {
      console.error(`[${requestId}] ❌ User has not shared yet`);
      return NextResponse.json(
        { error: 'Please share to Farcaster before claiming your reward.' },
        { status: 400 }
      );
    }

    // Verify all tasks completed
    if (!reward.all_tasks_completed) {
      console.error(`[${requestId}] ❌ Tasks not completed`);
      return NextResponse.json(
        { error: 'Please complete all tasks before claiming' },
        { status: 400 }
      );
    }

    // Check if already claimed
    if (reward.has_claimed) {
      console.error(`[${requestId}] ⚠️ Already claimed`);
      return NextResponse.json(
        { error: 'Reward already claimed' },
        { status: 400 }
      );
    }

    // Check if we have a valid wallet address
    if (!reward.wallet_address) {
      console.error(`[${requestId}] ❌ No wallet address`);
      return NextResponse.json(
        { error: 'No wallet address found. Please connect a wallet.' },
        { status: 400 }
      );
    }

    // Check if we already have a valid signature
    let claimData;
    if (reward.claim_signature && reward.claim_req) {
      try {
        const existingReq = typeof reward.claim_req === 'string' 
          ? JSON.parse(reward.claim_req) 
          : reward.claim_req;
        
        // Check if signature is still valid (not expired)
        if (reward.claim_signature_expires_at) {
          const expiresAt = new Date(reward.claim_signature_expires_at);
          if (expiresAt > new Date()) {
            console.log(`[${requestId}] ✅ Using existing valid signature`);
            claimData = {
              req: existingReq,
              signature: reward.claim_signature
            };
          }
        }
      } catch (parseError) {
        console.log(`[${requestId}] ⚠️ Could not parse existing signature, generating new one`);
      }
    }

    // Generate new signature if needed
    if (!claimData) {
      console.log(`[${requestId}] 🔐 Generating new claim signature...`);

      // Generate signature (30 days validity)
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);

      try {
        const claimSignatureData = await generateClaimSignature({
          wallet: reward.wallet_address.toLowerCase(),
          amount: reward.reward_amount, // Already in wei (10000000000000000000000)
          payoutId: `follow-reward-${reward.id}`, // Unique ID for this claim
          deadline
        });

        // Convert BigInt values to strings for storage
        const serializableReq = {
          uid: claimSignatureData.req.uid,
          tokenAddress: claimSignatureData.req.tokenAddress,
          expirationTimestamp: claimSignatureData.req.expirationTimestamp.toString(),
          contents: claimSignatureData.req.contents.map(content => ({
            recipient: content.recipient,
            amount: content.amount.toString()
          }))
        };

        // Store the signature
        await supabaseAdmin
          .from('follow_rewards')
          .update({
            claim_signature: claimSignatureData.signature,
            claim_req: serializableReq,
            claim_signature_generated_at: new Date().toISOString(),
            claim_signature_expires_at: deadline.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', reward.id);

        claimData = {
          req: serializableReq,
          signature: claimSignatureData.signature
        };

        console.log(`[${requestId}] ✅ New signature generated`);

      } catch (signatureError) {
        console.error(`[${requestId}] ❌ Error generating signature:`, signatureError);
        return NextResponse.json(
          { error: 'Failed to generate claim signature' },
          { status: 500 }
        );
      }
    }

    // Log for audit
    console.log(`[${requestId}] 📋 Follow reward claim data accessed:`);
    console.log(`   Reward ID: ${reward.id}`);
    console.log(`   User FID: ${fid}`);
    console.log(`   Wallet: ${reward.wallet_address}`);
    console.log(`   Amount: ${reward.reward_amount} wei`);

    // Return claim data
    return NextResponse.json({
      success: true,
      claimData: {
        contractAddress: getAddress(AIRDROP_CONTRACT_ADDRESS),
        chainId: CHAIN_ID,
        req: claimData.req,
        signature: claimData.signature,
        walletAddress: reward.wallet_address,
        rewardAmount: '100000' // Display amount (100,000 tokens)
      }
    });

  } catch (error) {
    console.error(`[${requestId}] ❌ Error generating claim data:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

