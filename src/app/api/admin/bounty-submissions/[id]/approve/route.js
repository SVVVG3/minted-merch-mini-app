// Admin API - Approve Bounty Submission
// PUT: Approve submission, create payout, update stats

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { getAmbassadorWalletAddress } from '@/lib/ambassadorHelpers';

// PUT /api/admin/bounty-submissions/[id]/approve - Approve submission
export const PUT = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;
    const { adminNotes } = await request.json();
    const adminFid = request.adminAuth?.fid; // Get admin FID from auth token if available

    console.log(`✅ Admin approving submission ${id}...`);

    // Get submission details
    const { data: submission, error: subError } = await supabaseAdmin
      .from('bounty_submissions')
      .select(`
        *,
        bounties (
          id,
          title,
          reward_tokens,
          max_completions,
          current_completions
        ),
        ambassadors!bounty_submissions_ambassador_id_fkey (
          id,
          fid,
          total_earned_tokens,
          total_bounties_completed,
          profiles (
            fid,
            username,
            primary_eth_address,
            verified_eth_addresses,
            custody_address
          )
        )
      `)
      .eq('id', id)
      .single();

    if (subError || !submission) {
      console.error('❌ Submission not found:', subError);
      return NextResponse.json({
        success: false,
        error: 'Submission not found'
      }, { status: 404 });
    }

    // Check if already approved
    if (submission.status === 'approved') {
      return NextResponse.json({
        success: false,
        error: 'Submission already approved'
      }, { status: 400 });
    }

    // Check if bounty has available slots
    const bounty = submission.bounties;
    if (bounty.current_completions >= bounty.max_completions) {
      return NextResponse.json({
        success: false,
        error: 'Bounty has reached maximum completions'
      }, { status: 400 });
    }

    // Get ambassador's wallet address
    const walletAddress = await getAmbassadorWalletAddress(submission.ambassadors.fid);

    if (!walletAddress) {
      console.warn(`⚠️ No wallet address found for ambassador FID ${submission.ambassadors.fid}`);
      // Still proceed but with warning - payout can be updated later
    }

    // Start transaction-like operations
    // 1. Update submission status
    const { error: updateError } = await supabaseAdmin
      .from('bounty_submissions')
      .update({
        status: 'approved',
        admin_notes: adminNotes || null,
        reviewed_by_admin_fid: adminFid || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ Error updating submission:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to approve submission'
      }, { status: 500 });
    }

    // 2. Create payout record
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('ambassador_payouts')
      .insert({
        ambassador_id: submission.ambassador_id,
        bounty_submission_id: id,
        amount_tokens: bounty.reward_tokens,
        wallet_address: walletAddress,
        status: 'pending',
        notes: `Payout for bounty: ${bounty.title}`
      })
      .select()
      .single();

    if (payoutError) {
      console.error('❌ Error creating payout:', payoutError);
      // Rollback submission approval
      await supabaseAdmin
        .from('bounty_submissions')
        .update({ status: 'pending', reviewed_at: null, reviewed_by_admin_fid: null })
        .eq('id', id);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to create payout record'
      }, { status: 500 });
    }

    // 3. Update ambassador stats
    const newTotalEarned = (submission.ambassadors.total_earned_tokens || 0) + bounty.reward_tokens;
    const newTotalCompleted = (submission.ambassadors.total_bounties_completed || 0) + 1;

    const { error: ambassadorError } = await supabaseAdmin
      .from('ambassadors')
      .update({
        total_earned_tokens: newTotalEarned,
        total_bounties_completed: newTotalCompleted,
        updated_at: new Date().toISOString()
      })
      .eq('id', submission.ambassador_id);

    if (ambassadorError) {
      console.error('❌ Error updating ambassador stats:', ambassadorError);
      // Continue anyway - stats can be recalculated
    }

    // 4. Increment bounty completion count
    const { error: bountyError } = await supabaseAdmin
      .from('bounties')
      .update({
        current_completions: bounty.current_completions + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', bounty.id);

    if (bountyError) {
      console.error('❌ Error updating bounty count:', bountyError);
      // Continue anyway
    }

    console.log(`✅ Submission approved successfully`);
    console.log(`💰 Payout created: ${bounty.reward_tokens} tokens to ${walletAddress || 'NO WALLET'}`);
    console.log(`📊 Ambassador stats updated: ${newTotalEarned} total earned, ${newTotalCompleted} completed`);

    return NextResponse.json({
      success: true,
      message: 'Submission approved successfully',
      payout,
      warning: walletAddress ? null : 'No wallet address found for ambassador. Payout created but needs wallet before distribution.'
    });

  } catch (error) {
    console.error('❌ Error in PUT /api/admin/bounty-submissions/[id]/approve:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

