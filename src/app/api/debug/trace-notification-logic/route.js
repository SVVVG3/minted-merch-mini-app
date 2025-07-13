import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '../../../../lib/supabase.js';
import { getCurrentCheckInDay } from '../../../../lib/timezone.js';

export async function GET(request) {
  try {
    console.log('🔍 Tracing notification logic step by step...');
    
    const adminClient = supabaseAdmin || supabase;
    const currentCheckInDay = getCurrentCheckInDay();
    
    // Step 1: Get all users with notifications enabled
    const { data: profilesData, error: profilesError } = await adminClient
      .from('profiles')
      .select('fid, username, has_notifications')
      .eq('has_notifications', true)
      .limit(10); // Limit for debugging
    
    console.log('Step 1 - Profiles with notifications:', profilesData?.length || 0);
    
    if (profilesError) {
      console.error('Profiles error:', profilesError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch profiles',
        details: profilesError
      }, { status: 500 });
    }
    
    if (!profilesData || profilesData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with notifications enabled found',
        step1_profiles: 0,
        currentCheckInDay
      });
    }
    
    const userFids = profilesData.map(p => p.fid);
    
    // Step 2: Get leaderboard data for these users
    const { data: leaderboardData, error: leaderboardError } = await adminClient
      .from('user_leaderboard')
      .select('user_fid, last_checkin_date, checkin_streak, total_points')
      .in('user_fid', userFids);
    
    console.log('Step 2 - Leaderboard entries:', leaderboardData?.length || 0);
    
    if (leaderboardError) {
      console.error('Leaderboard error:', leaderboardError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch leaderboard data',
        details: leaderboardError
      }, { status: 500 });
    }
    
    // Step 3: Analyze each user
    const analysis = profilesData.map(profile => {
      const userLeaderboard = leaderboardData?.find(lb => lb.user_fid === profile.fid);
      const needsReminder = !userLeaderboard || userLeaderboard.last_checkin_date !== currentCheckInDay;
      
      return {
        fid: profile.fid,
        username: profile.username,
        hasLeaderboardEntry: !!userLeaderboard,
        lastCheckinDate: userLeaderboard?.last_checkin_date || null,
        currentCheckInDay,
        needsReminder,
        reason: !userLeaderboard ? 'no_leaderboard_entry' : 
                userLeaderboard.last_checkin_date !== currentCheckInDay ? 'not_checked_in_today' : 
                'already_checked_in'
      };
    });
    
    const usersNeedingReminders = analysis.filter(a => a.needsReminder);
    
    return NextResponse.json({
      success: true,
      message: 'Notification logic trace complete',
      currentCheckInDay,
      step1_profiles: profilesData.length,
      step2_leaderboard: leaderboardData?.length || 0,
      step3_analysis: {
        totalAnalyzed: analysis.length,
        needingReminders: usersNeedingReminders.length,
        alreadyCheckedIn: analysis.length - usersNeedingReminders.length
      },
      detailedAnalysis: analysis,
      summary: {
        profilesWithNotifications: profilesData.length,
        leaderboardEntries: leaderboardData?.length || 0,
        finalUsersNeedingReminders: usersNeedingReminders.map(u => u.fid)
      }
    });
    
  } catch (error) {
    console.error('❌ Error tracing notification logic:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 