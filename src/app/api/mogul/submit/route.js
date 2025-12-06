// API endpoint for Merch Moguls to submit interaction bounties
// POST /api/mogul/submit
// SECURITY: Requires JWT authentication and 50M+ token balance
// Only allows interaction bounty types with auto-verification

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkMogulStatus, getMogulSubmissionCount } from '@/lib/mogulHelpers';
import { checkMogulSubmissionRateLimit } from '@/lib/rateLimiter';
import { verifyFarcasterBounty } from '@/lib/farcasterBountyVerification';
import { generateClaimSignature, getDefaultClaimDeadline } from '@/lib/claimSignatureService';

// Interaction bounty types
const INTERACTION_BOUNTY_TYPES = ['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_engagement'];

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
    const { bountyId } = body;

    if (!bountyId) {
      return NextResponse.json({
        success: false,
        error: 'Bounty ID is required'
      }, { status: 400 });
    }

    console.log(`📝 Processing mogul bounty submission for FID ${fid}, Bounty: ${bountyId}`);

    // SECURITY: Check if user is a Merch Mogul (50M+ tokens)
    const { isMogul, tokenBalance } = await checkMogulStatus(fid);

    if (!isMogul) {
      return NextResponse.json({
        success: false,
        error: 'Merch Mogul status required (50M+ $mintedmerch tokens)',
        tokenBalance,
        requiredBalance: 50_000_000
      }, { status: 403 });
    }

    // SECURITY: Rate limiting - prevent submission spam
    // Limit: 20 submissions per hour per mogul
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

    // Get bounty details
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

    // SECURITY: Only allow interaction bounty types for moguls
    if (!INTERACTION_BOUNTY_TYPES.includes(bounty.bounty_type)) {
      return NextResponse.json({
        success: false,
        error: 'Only interaction bounties are available for Merch Moguls'
      }, { status: 400 });
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

    // Check mogul's submission count for this bounty
    const mogulSubmissions = await getMogulSubmissionCount(fid, bountyId);

    if (bounty.max_submissions_per_ambassador !== null) {
      if (mogulSubmissions >= bounty.max_submissions_per_ambassador) {
        return NextResponse.json({
          success: false,
          error: `You have reached the submission limit for this bounty`
        }, { status: 400 });
      }
    }

    // AUTO-VERIFICATION for interaction bounties
    console.log(`🎯 Auto-verifying ${bounty.bounty_type} bounty for mogul FID ${fid}`);

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

    // Create submission - set ambassador_id to null for moguls, use ambassador_fid
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('bounty_submissions')
      .insert({
        bounty_id: bountyId,
        ambassador_id: null, // No ambassador_id for moguls
        ambassador_fid: fid, // Use FID to track mogul submissions
        proof_url: bounty.target_cast_url,
        proof_description: `Auto-verified ${bounty.bounty_type} by Merch Mogul`,
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

    console.log(`✅ Mogul submission created: ${submission.id} (AUTO-APPROVED)`);

    // CREATE PAYOUT
    let payout = null;
    
    // Get mogul's wallet address from profiles table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('primary_eth_address')
      .eq('fid', fid)
      .single();

    const walletAddress = profile?.primary_eth_address;

    if (!walletAddress) {
      console.log('⚠️ Mogul has no primary wallet address - payout can be created later');
    } else {
      console.log(`💰 Creating payout for mogul wallet: ${walletAddress}`);
      
      const deadline = getDefaultClaimDeadline();
      const amountInWei = (BigInt(bounty.reward_tokens) * BigInt(10 ** 18)).toString();
      
      // Generate claim signature
      const signatureData = await generateClaimSignature({
        wallet: walletAddress,
        amount: amountInWei,
        payoutId: submission.id,
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
      const { data: payoutData, error: payoutError } = await supabaseAdmin
        .from('ambassador_payouts')
        .insert({
          bounty_submission_id: submission.id,
          ambassador_id: null, // No ambassador_id for moguls
          amount_tokens: bounty.reward_tokens,
          wallet_address: walletAddress,
          claim_signature: claimDataJson,
          claim_deadline: deadline.toISOString(),
          status: 'claimable'
        })
        .select()
        .single();

      if (payoutError) {
        console.error('❌ Error creating payout:', payoutError);
      } else {
        payout = payoutData;
        console.log(`✅ Mogul payout created: ${payout.id}`);
      }
    }

    // INCREMENT BOUNTY COMPLETION COUNTER
    const { error: updateError } = await supabaseAdmin
      .from('bounties')
      .update({ 
        current_completions: bounty.current_completions + 1 
      })
      .eq('id', bountyId);

    if (updateError) {
      console.error('❌ Error updating bounty completion count:', updateError);
    } else {
      console.log(`📊 Bounty completion count updated: ${bounty.current_completions} → ${bounty.current_completions + 1}`);
    }

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
        needsWallet: !payout
      },
      message: payout 
        ? `✅ Verified! Your ${bounty.reward_tokens.toLocaleString()} $mintedmerch tokens are ready to claim!`
        : `✅ Verified! Please add your wallet address in Settings to claim your ${bounty.reward_tokens.toLocaleString()} $mintedmerch tokens.`
    });

  } catch (error) {
    console.error('❌ Error in mogul submit endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

