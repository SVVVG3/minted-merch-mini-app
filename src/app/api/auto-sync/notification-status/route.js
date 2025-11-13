import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hasNotificationTokenInNeynar } from '@/lib/neynar';
import { formatPSTTime } from '@/lib/timezone';

export async function POST(request) {
  try {
    // SECURITY: Verify CRON_SECRET to prevent unauthorized access
    // This endpoint makes expensive API calls and should only be triggered by authorized cron jobs
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error('🚨 CRON_SECRET not configured in environment variables');
      return NextResponse.json(
        { error: 'Server misconfiguration: CRON_SECRET not set' },
        { status: 500 }
      );
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
      console.warn(`🚫 Unauthorized auto-sync attempt from IP: ${clientIp}`);
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'This endpoint requires valid cron authentication'
        },
        { status: 401 }
      );
    }
    
    console.log('✅ CRON_SECRET verified - proceeding with auto-sync');
    
    let body = {};
    
    // Handle cron job calls (which may not have a body)
    try {
      body = await request.json();
    } catch (error) {
      console.log('📅 Cron job call detected - using default settings');
      body = {};
    }
    
    const { 
      batchSize = 50, 
      maxUsers = 200, // Conservative default for daily cron
      forceFullSync = false,
      discoveryMode = false, // Check ALL users to find newly enabled notifications
      dryRun = false 
    } = body;

    console.log('🔄 Auto-sync notification status started');
    console.log(`📊 Settings: batchSize=${batchSize}, maxUsers=${maxUsers}, forceFullSync=${forceFullSync}, discoveryMode=${discoveryMode}, dryRun=${dryRun}`);

    // Determine which users to sync
    let usersToSync = [];
    
    if (forceFullSync) {
      if (discoveryMode) {
        // Discovery mode: check ALL users (including those with notifications disabled)
        // This helps find users who enabled notifications but the DB doesn't know yet
        console.log('🔍 Discovery mode: checking ALL users to find newly enabled notifications');
        
        const { data: allUsers, error } = await supabaseAdmin
          .from('profiles')
          .select('fid, username, has_notifications, notification_status_updated_at, notification_status_source')
          .order('created_at', { ascending: false })
          .limit(maxUsers);

        if (error) throw error;
        usersToSync = allUsers;
      } else {
        // Full sync: all users with notifications enabled
        console.log('🌍 Full sync mode: checking all notification-enabled users');
        
        const { data: allUsers, error } = await supabaseAdmin
          .from('profiles')
          .select('fid, username, has_notifications, notification_status_updated_at, notification_status_source')
          .eq('has_notifications', true)
          .order('created_at', { ascending: false })
          .limit(maxUsers);

        if (error) throw error;
        usersToSync = allUsers;
      }
      
    } else {
      // Smart sync: prioritize users who haven't been checked recently
      console.log('🎯 Smart sync mode: prioritizing stale users');
      
      const staleCutoff = new Date();
      staleCutoff.setDate(staleCutoff.getDate() - 7); // 7 days old
      
      // Get users with stale notification status or no status at all
      const { data: staleUsers, error: staleError } = await supabaseAdmin
        .from('profiles')
        .select('fid, username, has_notifications, notification_status_updated_at, notification_status_source')
        .eq('has_notifications', true)
        .or(`notification_status_updated_at.is.null,notification_status_updated_at.lt.${staleCutoff.toISOString()}`)
        .order('notification_status_updated_at', { ascending: true, nullsFirst: true })
        .limit(Math.floor(maxUsers * 0.7)); // 70% of quota for stale users

      if (staleError) throw staleError;
      
      // Also get some recently updated users for validation
      const { data: recentUsers, error: recentError } = await supabaseAdmin
        .from('profiles')
        .select('fid, username, has_notifications, notification_status_updated_at, notification_status_source')
        .eq('has_notifications', true)
        .not('notification_status_updated_at', 'is', null)
        .gte('notification_status_updated_at', staleCutoff.toISOString())
        .order('notification_status_updated_at', { ascending: false })
        .limit(Math.floor(maxUsers * 0.3)); // 30% for recent validation

      if (recentError) throw recentError;
      
      usersToSync = [...staleUsers, ...recentUsers];
      console.log(`📊 Found ${staleUsers.length} stale users, ${recentUsers.length} recent users to validate`);
    }

    if (usersToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users found for sync',
        timestamp: formatPSTTime()
      });
    }

    console.log(`🚀 Starting sync for ${usersToSync.length} users...`);

    const results = {
      totalProcessed: 0,
      newlyEnabled: 0,
      newlyDisabled: 0,
      unchanged: 0,
      errors: 0,
      changes: [],
      errorDetails: []
    };

    // Process users in batches to avoid overwhelming Neynar API
    for (let i = 0; i < usersToSync.length; i += batchSize) {
      const batch = usersToSync.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(usersToSync.length/batchSize)} (${batch.length} users)`);

      for (const user of batch) {
        try {
          results.totalProcessed++;
          
          // Check current notification status with Neynar
          const currentStatus = await hasNotificationTokenInNeynar(user.fid);
          const previousStatus = user.has_notifications;
          
          if (currentStatus !== previousStatus) {
            // Status changed - record the change
            const change = {
              fid: user.fid,
              username: user.username,
              previousStatus,
              currentStatus,
              changeType: currentStatus ? 'newly_enabled' : 'newly_disabled',
              timestamp: new Date().toISOString()
            };
            
            results.changes.push(change);
            
            if (currentStatus) {
              results.newlyEnabled++;
              console.log(`🔔 ${user.username} (${user.fid}): NEWLY ENABLED notifications`);
            } else {
              results.newlyDisabled++;
              console.log(`🔕 ${user.username} (${user.fid}): NEWLY DISABLED notifications`);
            }
            
            // Update database (unless in dry run mode)
            if (!dryRun) {
              const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({
                  has_notifications: currentStatus,
                  notification_status_updated_at: new Date().toISOString(),
                  // Only update source to cron_sync if it wasn't originally from a Farcaster event
                  notification_status_source: user.notification_status_source === 'farcaster_event' ? 'farcaster_event' : 'cron_sync'
                })
                .eq('fid', user.fid);

              if (updateError) {
                console.error(`❌ Failed to update ${user.fid}:`, updateError);
                results.errors++;
                results.errorDetails.push({
                  fid: user.fid,
                  error: updateError.message
                });
              }
            }
            
          } else {
            // No change - just update the timestamp, preserving original source
            results.unchanged++;
            
            if (!dryRun) {
              await supabaseAdmin
                .from('profiles')
                .update({
                  notification_status_updated_at: new Date().toISOString(),
                  // Preserve the original source, only set to cron_sync if it was unknown
                  notification_status_source: user.notification_status_source === 'farcaster_event' ? 'farcaster_event' : 
                                             user.notification_status_source === 'miniapp_removed' ? 'miniapp_removed' : 'cron_sync'
                })
                .eq('fid', user.fid);
            }
          }

        } catch (error) {
          console.error(`❌ Error processing ${user.fid} (${user.username}):`, error);
          results.errors++;
          results.errorDetails.push({
            fid: user.fid,
            username: user.username,
            error: error.message
          });
        }

        // Small delay to be nice to Neynar API
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // Longer delay between batches
      if (i + batchSize < usersToSync.length) {
        console.log('⏱️  Pausing between batches...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final summary
    const summary = {
      ...results,
      successRate: results.totalProcessed > 0 ? 
        Math.round(((results.totalProcessed - results.errors) / results.totalProcessed) * 100) : 0,
      changeRate: results.totalProcessed > 0 ? 
        Math.round(((results.newlyEnabled + results.newlyDisabled) / results.totalProcessed) * 100) : 0,
      timestamp: formatPSTTime(),
      dryRun,
      syncType: discoveryMode ? 'discovery' : (forceFullSync ? 'full' : 'smart')
    };

    console.log('🎉 Auto-sync complete!');
    console.log(`📊 Processed: ${results.totalProcessed} users`);
    console.log(`🔔 Newly enabled: ${results.newlyEnabled}`);
    console.log(`🔕 Newly disabled: ${results.newlyDisabled}`);
    console.log(`✅ Unchanged: ${results.unchanged}`);
    console.log(`❌ Errors: ${results.errors}`);
    console.log(`📈 Change rate: ${summary.changeRate}%`);

    return NextResponse.json({
      success: true,
      message: `Auto-sync completed: ${results.newlyEnabled + results.newlyDisabled} changes detected`,
      summary,
      recentChanges: results.changes.slice(0, 10), // Show recent changes
      hasMoreChanges: results.changes.length > 10
    });

  } catch (error) {
    console.error('❌ Error in auto-sync:', error);
    return NextResponse.json({ 
      error: error.message,
      timestamp: formatPSTTime()
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get sync statistics
    const { count: totalUsers } = await supabaseAdmin
      .from('profiles')
      .select('fid', { count: 'exact', head: true });

    const { count: enabledUsers } = await supabaseAdmin
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .eq('has_notifications', true);

    // Count stale users (not updated in 7 days)
    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - 7);

    const { count: staleUsers } = await supabaseAdmin
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .eq('has_notifications', true)
      .or(`notification_status_updated_at.is.null,notification_status_updated_at.lt.${staleCutoff.toISOString()}`);

    return NextResponse.json({
      message: 'Automated Notification Status Sync',
      currentStats: {
        totalUsers,
        enabledUsers,
        staleUsers,
        staleDays: 7,
        enabledPercentage: totalUsers > 0 ? Math.round((enabledUsers / totalUsers) * 100) : 0,
        stalePercentage: enabledUsers > 0 ? Math.round((staleUsers / enabledUsers) * 100) : 0
      },
      syncModes: {
        smart: 'Prioritizes stale users (recommended for daily use)',
        full: 'Checks all users with notifications enabled (recommended weekly)',
        discovery: 'Checks ALL users to find newly enabled notifications (run after finding gaps)'
      },
      examples: {
        'Smart sync': 'POST {"batchSize": 50, "maxUsers": 200}',
        'Full sync': 'POST {"forceFullSync": true, "maxUsers": 500}',
        'Discovery sync': 'POST {"forceFullSync": true, "discoveryMode": true, "maxUsers": 1000}',
        'Dry run': 'POST {"dryRun": true}',
        'Conservative': 'POST {"batchSize": 25, "maxUsers": 100}'
      },
      recommendations: {
        daily: 'Smart sync with 100-200 users',
        weekly: 'Full sync with 500+ users',
        batchSize: '25-50 users (to respect API limits)'
      },
      timestamp: formatPSTTime()
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 