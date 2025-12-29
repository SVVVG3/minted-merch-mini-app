// API endpoint for Minted Merch Missions submissions
// POST /api/mogul/submit
// Handles both:
// - Interaction bounties (auto-verified) → Requires missions eligibility (50M+ tokens OR 1M+ staked)
// - Custom bounties (manual proof) → Requires 50M+ STAKED or targeted
// SECURITY: Requires JWT authentication

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { 
  checkMissionsEligibility, 
  checkCustomBountyEligibility,
  getMogulSubmissionCount,
  CUSTOM_BOUNTY_STAKED_THRESHOLD
} from '@/lib/mogulHelpers';
import { checkMogulSubmissionRateLimit } from '@/lib/rateLimiter';
import { verifyFarcasterBounty } from '@/lib/farcasterBountyVerification';
import { generateClaimSignature, getDefaultClaimDeadline } from '@/lib/claimSignatureService';

// Interaction bounty types - auto-verified
const INTERACTION_BOUNTY_TYPES = ['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_like_recast', 'farcaster_engagement'];

export async function POST(request) {
  try {
    // SECURITY: Verify JWT authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authResult = await verifyFarcasterUser(token);

    if (!authResult.authenticated) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication token'
      }, { status: 401 });
    }

    const fid = authResult.fid;
    
    // Parse request body
    const body = await request.json();
    const { bountyId, proofUrl, proofDescription } = body;

    if (!bountyId) {
      return NextResponse.json({
        success: false,
        error: 'Bounty ID is required'
      }, { status: 400 });
    }

    console.log(`📝 Processing missions bounty submission for FID ${fid}, Bounty: ${bountyId}`);

    // Get bounty details first to determine type
    const { data: bounty, error: bountyError } = await supabaseAdmin
      .from('bounties')
      .select('*')
      .eq('id', bountyId)
      .single();

    if (bountyError || !bounty) {
      return NextResponse.json({
        success: false,
        error: 'Bounty not found'
      }, { status: 404 });
    }

    const isInteractionBounty = INTERACTION_BOUNTY_TYPES.includes(bounty.bounty_type);
    const isCustomBounty = bounty.bounty_type === 'custom';

    // SECURITY: Check eligibility based on bounty type
    const { isEligible, isMogul, isStaker, tokenBalance, stakedBalance } = await checkMissionsEligibility(fid);

    if (isInteractionBounty) {
      // Interaction bounties - need missions eligibility (50M+ tokens OR 1M+ staked)
      if (!isEligible) {
        return NextResponse.json({
          success: false,
          error: 'Missions eligibility required (50M+ $mintedmerch tokens OR 1M+ staked)',
          tokenBalance,
          stakedBalance,
          requirements: {
            mogulThreshold: 50_000_000,
            stakerThreshold: 10_000_000
          }
        }, { status: 403 });
      }
    } else if (isCustomBounty) {
      // Custom bounties - need 50M+ staked OR be in target list
      const customEligibility = await checkCustomBountyEligibility(fid, bounty.target_ambassador_fids);
      
      if (!customEligibility.isEligible) {
        return NextResponse.json({
          success: false,
          error: 'Custom bounty eligibility required (50M+ $mintedmerch staked)',
          stakedBalance,
          requirement: CUSTOM_BOUNTY_STAKED_THRESHOLD
        }, { status: 403 });
      }

      // Custom bounties require proof
      if (!proofUrl) {
        return NextResponse.json({
          success: false,
          error: 'Proof URL is required for custom bounties'
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Unknown bounty type'
      }, { status: 400 });
    }

    // SECURITY: Rate limiting - prevent submission spam
    const rateLimit = await checkMogulSubmissionRateLimit(fid, 20, 60);
    
    if (!rateLimit.allowed) {
      console.warn(`⚠️ Rate limit exceeded for mogul FID ${fid}`);
      
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please wait before submitting again.',
        details: {
          attemptsRemaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt
        }
      }, { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimit.resetAt - new Date()) / 1000).toString(),
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': rateLimit.remaining.toString()
        }
      });
    }

    // Check if bounty is active
    if (!bounty.is_active) {
      return NextResponse.json({
        success: false,
        error: 'This bounty is no longer active'
      }, { status: 400 });
    }

    // Check if bounty has expired
    if (bounty.expires_at && new Date(bounty.expires_at) < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'This bounty has expired'
      }, { status: 400 });
    }

    // Check if bounty has reached max completions
    if (bounty.current_completions >= bounty.max_completions) {
      return NextResponse.json({
        success: false,
        error: 'This bounty has reached maximum completions'
      }, { status: 400 });
    }

    // Check user's submission count for this bounty
    const userSubmissions = await getMogulSubmissionCount(fid, bountyId);

    if (bounty.max_submissions_per_ambassador !== null) {
      if (userSubmissions >= bounty.max_submissions_per_ambassador) {
        return NextResponse.json({
          success: false,
          error: `You have reached the submission limit for this bounty`
        }, { status: 400 });
      }
    }

    let submission;
    let payout = null;

    if (isInteractionBounty) {
      // === INTERACTION BOUNTY: Auto-verification ===
      console.log(`🎯 Auto-verifying ${bounty.bounty_type} bounty for FID ${fid}`);

      const verificationResult = await verifyFarcasterBounty(
        bounty.bounty_type,
        fid,
        bounty.target_cast_hash,
        bounty.target_cast_author_fid
      );

      if (!verificationResult.verified) {
        console.log(`❌ Verification failed: ${verificationResult.error}`);
        return NextResponse.json({
          success: false,
          error: verificationResult.error || 'Verification failed',
          bountyType: bounty.bounty_type,
          targetCastUrl: bounty.target_cast_url
        }, { status: 400 });
      }

      console.log(`✅ Auto-verification successful for ${bounty.bounty_type}`);

      // Create submission - AUTO-APPROVED
      const { data: submissionData, error: submissionError } = await supabaseAdmin
        .from('bounty_submissions')
        .insert({
          bounty_id: bountyId,
          ambassador_id: null,
          ambassador_fid: fid,
          proof_url: bounty.target_cast_url,
          proof_description: `Auto-verified ${bounty.bounty_type} by Mogul`,
          submission_notes: JSON.stringify(verificationResult.details),
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by_admin_fid: 0 // 0 = auto-verified by system
        })
        .select()
        .single();

      if (submissionError) {
        console.error('❌ Error creating submission:', submissionError);
        return NextResponse.json({
          success: false,
          error: 'Failed to create submission'
        }, { status: 500 });
      }

      submission = submissionData;
      console.log(`✅ Submission created: ${submission.id} (AUTO-APPROVED)`);

      // Create payout immediately for auto-approved
      payout = await createPayout(fid, submission.id, bounty.reward_tokens);
      
      // Increment completion counter
      await incrementBountyCompletions(bountyId, bounty.current_completions);

    } else if (isCustomBounty) {
      // === CUSTOM BOUNTY: Manual proof, pending review ===
      console.log(`📝 Creating custom bounty submission for FID ${fid} with proof: ${proofUrl}`);

      // Create submission - PENDING admin review
      const { data: submissionData, error: submissionError } = await supabaseAdmin
        .from('bounty_submissions')
        .insert({
          bounty_id: bountyId,
          ambassador_id: null,
          ambassador_fid: fid,
          proof_url: proofUrl,
          proof_description: proofDescription || 'Custom bounty submission',
          status: 'pending' // Requires admin review
        })
        .select()
        .single();

      if (submissionError) {
        console.error('❌ Error creating submission:', submissionError);
        return NextResponse.json({
          success: false,
          error: 'Failed to create submission'
        }, { status: 500 });
      }

      submission = submissionData;
      console.log(`✅ Custom bounty submission created: ${submission.id} (PENDING REVIEW)`);
    }

    // Return response
    const isApproved = submission.status === 'approved';
    
    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        bountyId: submission.bounty_id,
        status: submission.status,
        submittedAt: submission.submitted_at,
        payout: payout ? {
          id: payout.id,
          amountTokens: payout.amount_tokens,
          status: payout.status
        } : null,
        needsWallet: isApproved && !payout
      },
      message: isApproved
        ? (payout 
            ? `✅ Verified! Your ${bounty.reward_tokens.toLocaleString()} $mintedmerch tokens are ready to claim!`
            : `✅ Verified! Please add your wallet address in Settings to claim your ${bounty.reward_tokens.toLocaleString()} $mintedmerch tokens.`)
        : `📝 Submitted! Your proof is pending review. You'll earn ${bounty.reward_tokens.toLocaleString()} $mintedmerch tokens once approved.`
    });

  } catch (error) {
    console.error('❌ Error in mogul submit endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper: Create payout for approved submission
async function createPayout(fid, submissionId, rewardTokens) {
  try {
    // Get user's wallet address
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('primary_eth_address, custody_address, verified_eth_addresses')
      .eq('fid', fid)
      .single();

    const walletAddress = profile?.primary_eth_address || 
                          profile?.verified_eth_addresses?.[0] || 
                          profile?.custody_address;

    if (!walletAddress) {
      console.log('⚠️ User has no wallet address - payout can be created later');
      return null;
    }

    console.log(`💰 Creating payout for wallet: ${walletAddress}`);
    
    const deadline = getDefaultClaimDeadline();
    const amountInWei = (BigInt(rewardTokens) * BigInt(10 ** 18)).toString();
    
    // Generate claim signature
    const signatureData = await generateClaimSignature({
      wallet: walletAddress,
      amount: amountInWei,
      payoutId: submissionId,
      deadline
    });

    // Convert BigInt values for JSON
    const serializableReq = {
      ...signatureData.req,
      expirationTimestamp: signatureData.req.expirationTimestamp.toString(),
      contents: signatureData.req.contents.map(content => ({
        ...content,
        amount: content.amount.toString()
      }))
    };

    const claimDataJson = JSON.stringify({
      req: serializableReq,
      signature: signatureData.signature
    });

    // Create payout record
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('ambassador_payouts')
      .insert({
        bounty_submission_id: submissionId,
        ambassador_id: null,
        amount_tokens: rewardTokens,
        wallet_address: walletAddress,
        claim_signature: claimDataJson,
        claim_deadline: deadline.toISOString(),
        status: 'claimable'
      })
      .select()
      .single();

    if (payoutError) {
      console.error('❌ Error creating payout:', payoutError);
      return null;
    }

    console.log(`✅ Payout created: ${payout.id}`);
    return payout;

  } catch (error) {
    console.error('❌ Error in createPayout:', error);
    return null;
  }
}

// Helper: Increment bounty completion counter
async function incrementBountyCompletions(bountyId, currentCompletions) {
  const { error } = await supabaseAdmin
    .from('bounties')
    .update({ current_completions: currentCompletions + 1 })
    .eq('id', bountyId);

  if (error) {
    console.error('❌ Error updating bounty completion count:', error);
  } else {
    console.log(`📊 Bounty completion count updated: ${currentCompletions} → ${currentCompletions + 1}`);
  }
}
