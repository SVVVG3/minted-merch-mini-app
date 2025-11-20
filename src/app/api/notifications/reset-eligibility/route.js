// Reset notification eligibility for a specific user (admin only)
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.authorized) {
      return Response.json({
        error: 'Unauthorized',
        message: authResult.message
      }, { status: 401 });
    }

    const body = await request.json();
    const { fid } = body;
    
    if (!fid) {
      return Response.json({
        error: 'Missing fid parameter'
      }, { status: 400 });
    }

    // Reset notification tracking dates
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        last_daily_reminder_sent_date: null,
        last_evening_reminder_sent_date: null,
        has_notifications: true, // Ensure notifications are enabled
      })
      .eq('fid', fid);

    if (updateError) {
      return Response.json({
        error: 'Failed to reset eligibility',
        details: updateError
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: `Reset notification eligibility for FID ${fid}`,
      fid: parseInt(fid),
      changes: {
        last_daily_reminder_sent_date: 'cleared',
        last_evening_reminder_sent_date: 'cleared',
        has_notifications: 'set to true',
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in reset-eligibility:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
}

