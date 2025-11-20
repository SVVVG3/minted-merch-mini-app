// Debug endpoint to check notification eligibility for a specific user
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentCheckInDay } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return Response.json({
        error: 'Missing fid parameter'
      }, { status: 400 });
    }

    const currentCheckInDay = getCurrentCheckInDay();
    
    // Get user's profile data
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('fid, has_notifications, last_daily_reminder_sent_date, last_evening_reminder_sent_date')
      .eq('fid', fid)
      .single();

    if (profileError) {
      return Response.json({
        error: 'Profile not found',
        details: profileError
      }, { status: 404 });
    }

    // Get user's leaderboard data
    const { data: leaderboard, error: leaderboardError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('user_fid, last_checkin_date, checkin_streak, total_points')
      .eq('user_fid', fid)
      .single();

    // Check eligibility
    const hasNotificationsEnabled = profile.has_notifications === true;
    const alreadySentDailyReminderToday = profile.last_daily_reminder_sent_date === currentCheckInDay;
    const hasCheckedInToday = leaderboard?.last_checkin_date === currentCheckInDay;
    
    const isEligibleForDailyReminder = 
      hasNotificationsEnabled && 
      !alreadySentDailyReminderToday && 
      !hasCheckedInToday;

    return Response.json({
      fid: parseInt(fid),
      currentCheckInDay,
      profile: {
        has_notifications: profile.has_notifications,
        last_daily_reminder_sent_date: profile.last_daily_reminder_sent_date,
        last_evening_reminder_sent_date: profile.last_evening_reminder_sent_date,
      },
      leaderboard: leaderboard ? {
        last_checkin_date: leaderboard.last_checkin_date,
        checkin_streak: leaderboard.checkin_streak,
        total_points: leaderboard.total_points,
      } : null,
      eligibility: {
        hasNotificationsEnabled,
        alreadySentDailyReminderToday,
        hasCheckedInToday,
        isEligibleForDailyReminder,
      },
      reasons: {
        whyNotEligible: !isEligibleForDailyReminder ? [
          !hasNotificationsEnabled && 'has_notifications is false in database',
          alreadySentDailyReminderToday && 'already sent daily reminder today',
          hasCheckedInToday && 'already checked in today',
        ].filter(Boolean) : []
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in debug-eligibility:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
}

