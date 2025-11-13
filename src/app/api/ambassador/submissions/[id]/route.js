// API endpoint to delete a bounty submission
// DELETE /api/ambassador/submissions/[id]
// Allows ambassadors to delete their rejected submissions

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAmbassadorStatus } from '@/lib/ambassadorHelpers';

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

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
    console.log(`🗑️ Ambassador FID ${fid} attempting to delete submission ${id}`);

    // Check if user is an ambassador
    const { isAmbassador, ambassadorId } = await checkAmbassadorStatus(fid);

    if (!isAmbassador) {
      return NextResponse.json({
        success: false,
        error: 'User is not an active ambassador'
      }, { status: 403 });
    }

    // Get the submission and verify ownership and status
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('bounty_submissions')
      .select('*')
      .eq('id', id)
      .eq('ambassador_id', ambassadorId)
      .single();

    if (fetchError || !submission) {
      console.error('❌ Submission not found or unauthorized:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Submission not found'
      }, { status: 404 });
    }

    // Only allow deletion of rejected submissions
    if (submission.status !== 'rejected') {
      return NextResponse.json({
        success: false,
        error: 'Can only delete rejected submissions'
      }, { status: 400 });
    }

    // Delete the submission
    const { error: deleteError } = await supabaseAdmin
      .from('bounty_submissions')
      .delete()
      .eq('id', id)
      .eq('ambassador_id', ambassadorId);

    if (deleteError) {
      console.error('❌ Error deleting submission:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete submission'
      }, { status: 500 });
    }

    console.log(`✅ Submission ${id} deleted successfully`);

    return NextResponse.json({
      success: true,
      message: 'Submission deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error in DELETE /api/ambassador/submissions/[id]:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

