import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hasNotificationTokenInNeynar } from '@/lib/neynar';

export async function POST(request) {
  try {
    const { fid, syncAll } = await request.json();

    console.log('🔄 Notification Status Sync Started');
    
    if (syncAll) {
      // Sync all users (use carefully in production)
      console.log('⚠️ Syncing ALL users - this may take a while...');
      
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('fid, username, has_notifications, notification_status_updated_at')
        .order('created_at', { ascending: false })
        .limit(50); // Limit to prevent timeout
      
      if (error) {
        throw error;
      }

      const results = [];
      for (const profile of profiles) {
        try {
          const hasNotifications = await hasNotificationTokenInNeynar(profile.fid);
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              has_notifications: hasNotifications,
              notification_status_updated_at: new Date().toISOString()
            })
            .eq('fid', profile.fid);

          results.push({
            fid: profile.fid,
            username: profile.username,
            previousStatus: profile.has_notifications,
            currentStatus: hasNotifications,
            updated: !updateError,
            error: updateError?.message
          });

          console.log(`Updated FID ${profile.fid} (${profile.username}): ${profile.has_notifications} → ${hasNotifications}`);
          
        } catch (error) {
          console.error(`Error syncing FID ${profile.fid}:`, error);
          results.push({
            fid: profile.fid,
            username: profile.username,
            error: error.message
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Synced ${results.length} users`,
        results
      });

    } else if (fid) {
      // Sync specific user
      console.log(`🎯 Syncing specific user: FID ${fid}`);
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('fid, username, has_notifications, welcome_notification_sent')
        .eq('fid', fid)
        .single();
      
      if (profileError) {
        throw profileError;
      }

      const hasNotifications = await hasNotificationTokenInNeynar(fid);
      console.log(`Current notification status for FID ${fid}: ${hasNotifications}`);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          has_notifications: hasNotifications,
          notification_status_updated_at: new Date().toISOString()
        })
        .eq('fid', fid);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        fid,
        username: profile.username,
        previousStatus: profile.has_notifications,
        currentStatus: hasNotifications,
        welcomeNotificationSent: profile.welcome_notification_sent,
        message: `Updated notification status for ${profile.username || fid}`
      });

    } else {
      return NextResponse.json({ 
        error: 'Either fid or syncAll=true is required' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in notification status sync:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// GET endpoint for testing
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');

  if (fid) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('fid, username, has_notifications, notification_status_updated_at, welcome_notification_sent')
        .eq('fid', fid)
        .single();

      if (error) throw error;

      const currentStatus = await hasNotificationTokenInNeynar(fid);

      return NextResponse.json({
        profile,
        currentNeynarStatus: currentStatus,
        statusMatch: profile.has_notifications === currentStatus,
        needsSync: profile.has_notifications !== currentStatus
      });

    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    message: 'Notification Status Sync Endpoint',
    usage: {
      'GET with ?fid=123': 'Check specific user status',
      'POST with {fid: 123}': 'Sync specific user',
      'POST with {syncAll: true}': 'Sync all users (limited to 50)'
    },
    examples: {
      madyak: 'GET /api/debug/notification-status-sync?fid=14369',
      syncMadyak: 'POST /api/debug/notification-status-sync {"fid": 14369}'
    }
  });
} 