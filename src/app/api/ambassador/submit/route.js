// API endpoint to submit bounty proof
// POST /api/ambassador/submit
// Allows ambassadors to submit proof for bounty completion

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAmbassadorStatus, validateProofUrl, getAmbassadorSubmissionCount } from '@/lib/ambassadorHelpers';
import { checkSubmissionRateLimit } from '@/lib/rateLimiter';
import { verifyFarcasterBounty } from '@/lib/farcasterBountyVerification';
import { sendPayoutReadyNotification } from '@/lib/ambassadorNotifications';
import { generateClaimSignature, getDefaultClaimDeadline } from '@/lib/claimSignatureService';

export async function POST(request) {
  try {
    // Verify authentication
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
    const { bountyId, proofUrl, proofDescription, submissionNotes } = body;

    if (!bountyId) {
      return NextResponse.json({
        success: false,
        error: 'Bounty ID is required'
      }, { status: 400 });
    }

    console.log(`📝 Processing bounty submission for FID ${fid}, Bounty: ${bountyId}`);

    // Check if user is an ambassador
    const { isAmbassador, ambassadorId } = await checkAmbassadorStatus(fid);

    if (!isAmbassador) {
      return NextResponse.json({
        success: false,
        error: 'User is not an active ambassador'
      }, { status: 403 });
    }

    // SECURITY: Rate limiting - prevent submission spam
    // Limit: 10 submissions per hour per ambassador
    const rateLimit = await checkSubmissionRateLimit(ambassadorId, 10, 60);
    
    if (!rateLimit.allowed) {
      console.warn(`⚠️ Rate limit exceeded for ambassador ${ambassadorId} (${rateLimit.attempts} attempts in last hour)`);
      
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please wait before submitting again.',
        details: {
          attemptsRemaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
          message: `You have submitted ${rateLimit.attempts} times in the last hour. Maximum is 10 submissions per hour.`
        }
      }, { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimit.resetAt - new Date()) / 1000).toString(),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toISOString()
        }
      });
    }

    console.log(`✅ Rate limit check passed: ${rateLimit.remaining} submissions remaining`);

    // Get bounty details first to determine if it's a Farcaster engagement bounty
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

    // Check ambassador's submission count for this bounty
    const ambassadorSubmissions = await getAmbassadorSubmissionCount(ambassadorId, bountyId);

    // Check per-ambassador submission limit
    if (bounty.max_submissions_per_ambassador !== null) {
      if (ambassadorSubmissions >= bounty.max_submissions_per_ambassador) {
        return NextResponse.json({
          success: false,
          error: `You have reached the submission limit for this bounty (${bounty.max_submissions_per_ambassador} submission${bounty.max_submissions_per_ambassador > 1 ? 's' : ''})`
        }, { status: 400 });
      }
    }

    // FARCASTER ENGAGEMENT BOUNTY AUTO-VERIFICATION
    const isFarcasterBounty = ['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_like_recast', 'farcaster_engagement'].includes(bounty.bounty_type);
    let autoVerified = false;
    let verificationDetails = null;

    if (isFarcasterBounty) {
      console.log(`🎯 Auto-verifying ${bounty.bounty_type} bounty for FID ${fid}`);

      // Verify the Farcaster engagement
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

      autoVerified = true;
      verificationDetails = verificationResult.details;
      console.log(`✅ Auto-verification successful for ${bounty.bounty_type}`);

    } else {
      // For custom bounties, require proof URL
      if (!proofUrl) {
        return NextResponse.json({
          success: false,
          error: 'Proof URL is required for custom bounties'
        }, { status: 400 });
      }

      // Validate proof URL for custom bounties
      const urlValidation = await validateProofUrl(proofUrl);
      if (!urlValidation.valid) {
        return NextResponse.json({
          success: false,
          error: urlValidation.error
        }, { status: 400 });
      }
    }

    // Create submission with appropriate status
    const { data: submission, error: submissionError} = await supabaseAdmin
      .from('bounty_submissions')
      .insert({
        bounty_id: bountyId,
        ambassador_id: ambassadorId,
        ambassador_fid: fid,
        proof_url: proofUrl || bounty.target_cast_url, // Use cast URL if no proof URL
        proof_description: proofDescription || (autoVerified ? `Auto-verified ${bounty.bounty_type}` : null),
        submission_notes: submissionNotes || (autoVerified ? JSON.stringify(verificationDetails) : null),
        status: autoVerified ? 'approved' : 'pending',
        reviewed_at: autoVerified ? new Date().toISOString() : null,
        reviewed_by_admin_fid: autoVerified ? 0 : null // 0 = auto-verified by system
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

    console.log(`✅ Submission created: ${submission.id} (${autoVerified ? 'AUTO-APPROVED' : 'PENDING'})`);

    // AUTO-CREATE PAYOUT FOR VERIFIED FARCASTER BOUNTIES
    let payout = null;
    if (autoVerified) {
      console.log(`💰 Creating auto-payout for verified submission...`);

      // Get ambassador wallet address from profiles table
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('primary_eth_address, verified_eth_addresses')
        .eq('fid', fid)
        .single();

      const walletAddress = profile?.primary_eth_address;

      if (!walletAddress) {
        console.log('⚠️ Ambassador has no primary wallet address - skipping payout creation');
        console.log('💡 Payout can be created later when wallet is added');
        // Don't fail - submission is already approved, payout can be created later
      } else {
        console.log(`💰 Using wallet address: ${walletAddress}`);
        
        // Use default claim deadline (30 days - same as manual approvals)
        const deadline = getDefaultClaimDeadline();
        console.log(`⏰ Setting claim deadline: ${deadline.toISOString()} (30 days)`);
        
        // Convert token amount to wei (multiply by 10^18 for 18 decimals)
        const amountInWei = (BigInt(bounty.reward_tokens) * BigInt(10 ** 18)).toString();
        
        // Generate Thirdweb SDK airdrop signature
        const signatureData = await generateClaimSignature({
          wallet: walletAddress,
          amount: amountInWei,
          payoutId: submission.id,
          deadline
        });

        console.log(`✍️ Thirdweb SDK signature generated for auto-verified bounty:`, {
          uid: signatureData.req.uid.slice(0, 10) + '...',
          tokenAddress: signatureData.req.tokenAddress,
          expirationTimestamp: signatureData.req.expirationTimestamp.toString(),
          recipient: signatureData.req.contents[0].recipient,
          amount: signatureData.req.contents[0].amount.toString(),
          signatureLength: signatureData.signature.length
        });

        // Convert BigInt values to strings for JSON serialization
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

      // Create payout record with Thirdweb signature
      const { data: payoutData, error: payoutError } = await supabaseAdmin
        .from('ambassador_payouts')
        .insert({
          bounty_submission_id: submission.id,
          ambassador_id: ambassadorId,
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
          console.log(`✅ Payout created: ${payout.id}`);

          // Send notification
          try {
            await sendPayoutReadyNotification(fid, {
              ...payout,
              amountTokens: bounty.reward_tokens
            });
          } catch (notifError) {
            console.error('⚠️ Failed to send payout notification:', notifError);
          }
        }
      } // end of wallet address check

      // UPDATE AMBASSADOR STATS for auto-approved submissions
      const { data: currentAmbassador } = await supabaseAdmin
        .from('ambassadors')
        .select('total_earned_tokens, total_bounties_completed')
        .eq('id', ambassadorId)
        .single();

      const newTotalEarned = (currentAmbassador?.total_earned_tokens || 0) + bounty.reward_tokens;
      const newTotalCompleted = (currentAmbassador?.total_bounties_completed || 0) + 1;

      const { error: ambassadorUpdateError } = await supabaseAdmin
        .from('ambassadors')
        .update({
          total_earned_tokens: newTotalEarned,
          total_bounties_completed: newTotalCompleted,
          updated_at: new Date().toISOString()
        })
        .eq('id', ambassadorId);

      if (ambassadorUpdateError) {
        console.error('❌ Error updating ambassador stats:', ambassadorUpdateError);
        // Don't fail the whole request - submission and payout are already created
      } else {
        console.log(`📊 Ambassador stats updated: earned ${currentAmbassador?.total_earned_tokens || 0} → ${newTotalEarned}, completed ${currentAmbassador?.total_bounties_completed || 0} → ${newTotalCompleted}`);
      }

      // INCREMENT BOUNTY COMPLETION COUNTER for auto-approved submissions
      const { error: updateError } = await supabaseAdmin
        .from('bounties')
        .update({ 
          current_completions: bounty.current_completions + 1 
        })
        .eq('id', bountyId);

      if (updateError) {
        console.error('❌ Error updating bounty completion count:', updateError);
        // Don't fail the whole request - submission and payout are already created
      } else {
        console.log(`📊 Bounty completion count updated: ${bounty.current_completions} → ${bounty.current_completions + 1}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        bountyId: submission.bounty_id,
        status: submission.status,
        submittedAt: submission.submitted_at,
        autoVerified,
        payout: payout ? {
          id: payout.id,
          amountTokens: payout.amount_tokens,
          status: payout.status
        } : null,
        needsWallet: autoVerified && !payout // Flag if wallet needed
      },
      message: autoVerified 
        ? (payout 
            ? `✅ Verified! Your ${bounty.reward_tokens.toLocaleString()} $mintedmerch tokens are ready to claim!`
            : `✅ Verified! Please add your wallet address in Settings to claim your ${bounty.reward_tokens.toLocaleString()} $mintedmerch tokens.`
          )
        : 'Submission created successfully and is pending review'
    });

  } catch (error) {
    console.error('❌ Error in submit endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

