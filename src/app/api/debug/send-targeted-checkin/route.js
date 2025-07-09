import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendCheckInReminder, createCheckInReminderMessage } from '@/lib/notifications';
import { canCheckInToday } from '@/lib/points';
import { formatPSTTime } from '@/lib/timezone';

export async function POST(request) {
  try {
    const { 
      targetGroup = 'unchecked', 
      specificFids = null,
      minPoints = null,
      maxPoints = null,
      minStreak = null,
      includeNewUsers = false,
      testMode = false
    } = await request.json();

    console.log('🎯 Targeted check-in notification request:', {
      targetGroup,
      specificFids: specificFids?.length || 'none',
      testMode
    });

    let targetUsers = [];

    if (specificFids && Array.isArray(specificFids)) {
      // Target specific FIDs
      console.log(`🎯 Targeting specific FIDs: ${specificFids.join(', ')}`);
      
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('fid, username, has_notifications')
        .in('fid', specificFids)
        .eq('has_notifications', true);

      if (error) throw error;
      targetUsers = profiles;
      
    } else if (targetGroup === 'newly_enabled') {
      // Target users whose notification status was recently updated
      console.log('🆕 Targeting newly enabled notification users...');
      
      const recentCutoff = new Date();
      recentCutoff.setHours(recentCutoff.getHours() - 24); // Last 24 hours
      
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('fid, username, has_notifications, notification_status_updated_at')
        .eq('has_notifications', true)
        .gte('notification_status_updated_at', recentCutoff.toISOString());

      if (error) throw error;
      targetUsers = profiles;
      
    } else if (targetGroup === 'high_streak') {
      // Target users with high streaks who haven't checked in
      console.log('🔥 Targeting high-streak users...');
      
      const { data: leaderboard, error: lbError } = await supabase
        .from('user_leaderboard')
        .select('user_fid, checkin_streak, total_points')
        .gte('checkin_streak', minStreak || 5);

      if (lbError) throw lbError;

      const fids = leaderboard.map(lb => lb.user_fid);
      
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('fid, username, has_notifications')
        .in('fid', fids)
        .eq('has_notifications', true);

      if (error) throw error;
      targetUsers = profiles;
      
    } else {
      // Default: all users with notifications who haven't checked in today
      console.log('📅 Targeting all users who haven\'t checked in today...');
      
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('fid, username, has_notifications')
        .eq('has_notifications', true);

      if (error) throw error;
      targetUsers = profiles;
    }

    // Filter out users who have already checked in today
    const eligibleUsers = [];
    for (const user of targetUsers) {
      const canCheckin = await canCheckInToday(user.fid);
      if (canCheckin) {
        eligibleUsers.push(user);
      }
    }

    console.log(`📊 Found ${targetUsers.length} potential users, ${eligibleUsers.length} eligible for check-in`);

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible users found for targeted notifications',
        targetGroup,
        totalFound: targetUsers.length,
        eligible: 0,
        timestamp: formatPSTTime()
      });
    }

    if (testMode) {
      // Test mode: return what would be sent without actually sending
      console.log('🧪 Test mode: generating sample messages...');
      
      const sampleMessages = await Promise.all(
        eligibleUsers.slice(0, 3).map(async (user) => {
          const message = await createCheckInReminderMessage(user.fid);
          return {
            fid: user.fid,
            username: user.username,
            message
          };
        })
      );

      return NextResponse.json({
        success: true,
        testMode: true,
        message: `Would send notifications to ${eligibleUsers.length} users`,
        targetGroup,
        eligibleUsers: eligibleUsers.length,
        sampleMessages,
        timestamp: formatPSTTime()
      });
    }

    // Send notifications to all eligible users
    console.log(`📤 Sending targeted check-in notifications to ${eligibleUsers.length} users...`);

    const results = await Promise.allSettled(
      eligibleUsers.map(user => sendCheckInReminder(user.fid))
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failureCount = results.length - successCount;

    console.log(`📊 Targeted notification results:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   📱 Total: ${results.length}`);

    return NextResponse.json({
      success: true,
      message: `Targeted check-in notifications sent to ${successCount}/${eligibleUsers.length} users`,
      targetGroup,
      stats: {
        totalEligible: eligibleUsers.length,
        successCount,
        failureCount,
        successRate: Math.round((successCount / eligibleUsers.length) * 100)
      },
      timestamp: formatPSTTime(),
      results: results.slice(0, 20).map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    });

  } catch (error) {
    console.error('❌ Error in targeted check-in notifications:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('fid', { count: 'exact', head: true });

    const { count: enabledUsers } = await supabase
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .eq('has_notifications', true);

    return NextResponse.json({
      message: 'Targeted Check-in Notification Endpoint',
      currentStats: {
        totalUsers,
        enabledUsers,
        enabledPercentage: totalUsers > 0 ? Math.round((enabledUsers / totalUsers) * 100) : 0
      },
      targetGroups: {
        'unchecked': 'All users who haven\'t checked in today (default)',
        'newly_enabled': 'Users whose notifications were recently enabled',
        'high_streak': 'Users with high check-in streaks',
        'specific': 'Target specific FIDs'
      },
      examples: {
        'All unchecked': 'POST {}',
        'Test mode': 'POST {"testMode": true}',
        'Newly enabled': 'POST {"targetGroup": "newly_enabled"}',
        'High streak': 'POST {"targetGroup": "high_streak", "minStreak": 7}',
        'Specific users': 'POST {"specificFids": [123, 456, 789]}'
      },
      timestamp: formatPSTTime()
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 