// API endpoint to submit bounty proof
// POST /api/ambassador/submit
// Allows ambassadors to submit proof for bounty completion

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAmbassadorStatus, validateProofUrl, getAmbassadorSubmissionCount } from '@/lib/ambassadorHelpers';
import { checkSubmissionRateLimit } from '@/lib/rateLimiter';

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

    if (!proofUrl) {
      return NextResponse.json({
        success: false,
        error: 'Proof URL is required'
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

    // Validate proof URL
    const urlValidation = await validateProofUrl(proofUrl);
    if (!urlValidation.valid) {
      return NextResponse.json({
        success: false,
        error: urlValidation.error
      }, { status: 400 });
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

    // Create submission
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('bounty_submissions')
      .insert({
        bounty_id: bountyId,
        ambassador_id: ambassadorId,
        proof_url: proofUrl,
        proof_description: proofDescription || null,
        submission_notes: submissionNotes || null,
        status: 'pending'
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

    console.log(`✅ Submission created successfully:`, submission.id);

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        bountyId: submission.bounty_id,
        status: submission.status,
        submittedAt: submission.submitted_at,
        proofPlatform: urlValidation.platform
      },
      message: 'Submission created successfully and is pending review'
    });

  } catch (error) {
    console.error('❌ Error in submit endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

