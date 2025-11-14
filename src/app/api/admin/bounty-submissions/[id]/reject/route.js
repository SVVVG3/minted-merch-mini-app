// Admin API - Reject Bounty Submission
// PUT: Reject submission with admin notes

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSubmissionRejectedNotification } from '@/lib/ambassadorNotifications';

// PUT /api/admin/bounty-submissions/[id]/reject - Reject submission
export const PUT = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;
    const { adminNotes } = await request.json();
    const adminFid = request.adminAuth?.fid; // Get admin FID from auth token if available

    if (!adminNotes || adminNotes.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Admin notes are required when rejecting a submission'
      }, { status: 400 });
    }

    console.log(`❌ Admin rejecting submission ${id}...`);

    // Get submission with bounty and ambassador details
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('bounty_submissions')
      .select(`
        id, 
        status,
        ambassador_fid,
        bounty_id,
        bounties (
          id,
          title
        ),
        ambassadors (
          fid,
          profiles (
            username
          )
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !submission) {
      console.error('❌ Submission not found:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Submission not found'
      }, { status: 404 });
    }

    // Check if already approved (can't reject approved submissions)
    if (submission.status === 'approved') {
      return NextResponse.json({
        success: false,
        error: 'Cannot reject an approved submission'
      }, { status: 400 });
    }

    // Update submission status to rejected
    const { error: updateError } = await supabaseAdmin
      .from('bounty_submissions')
      .update({
        status: 'rejected',
        admin_notes: adminNotes.trim(),
        reviewed_by_admin_fid: adminFid || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ Error rejecting submission:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to reject submission'
      }, { status: 500 });
    }

    console.log(`✅ Submission rejected successfully with notes`);

    // Send rejection notification to ambassador
    try {
      const ambassadorFid = submission.ambassador_fid;
      const submissionData = {
        bounty: submission.bounties,
        bountyTitle: submission.bounties?.title
      };
      
      console.log(`🔔 Sending rejection notification to ambassador FID: ${ambassadorFid}`);
      const notificationResult = await sendSubmissionRejectedNotification(
        ambassadorFid, 
        submissionData, 
        adminNotes
      );

      if (notificationResult.success) {
        console.log(`✅ Rejection notification sent successfully`);
      } else if (notificationResult.skipped) {
        console.log(`⏭️ Notification skipped: ${notificationResult.reason}`);
      } else {
        console.error(`⚠️ Failed to send rejection notification:`, notificationResult.error);
        // Don't fail the whole request if notification fails
      }
    } catch (notificationError) {
      console.error('⚠️ Error sending rejection notification:', notificationError);
      // Don't fail the whole request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Submission rejected successfully'
    });

  } catch (error) {
    console.error('❌ Error in PUT /api/admin/bounty-submissions/[id]/reject:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

