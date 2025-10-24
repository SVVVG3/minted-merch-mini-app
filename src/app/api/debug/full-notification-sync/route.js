import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hasNotificationTokenInNeynar } from '@/lib/neynar';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { batchSize = 25, maxBatches = 20, startOffset = 0 } = await request.json();

    console.log('🚀 Full Notification Sync Started');
    console.log(`📊 Batch size: ${batchSize}, Max batches: ${maxBatches}, Start offset: ${startOffset}`);
    
    // Get total user count first
    const { count: totalUsers, error: countError } = await supabase
      .from('profiles')
      .select('fid', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`👥 Total users in database: ${totalUsers}`);

    const results = [];
    const summary = {
      totalProcessed: 0,
      totalEnabled: 0,
      totalDisabled: 0,
      newlyEnabled: 0,
      newlyDisabled: 0,
      errors: 0,
      batches: []
    };

    // Process users in batches
    for (let batch = 0; batch < maxBatches; batch++) {
      const offset = startOffset + (batch * batchSize);
      
      if (offset >= totalUsers) {
        console.log(`✅ Reached end of users at offset ${offset}`);
        break;
      }

      console.log(`📦 Processing batch ${batch + 1}/${maxBatches} (offset: ${offset}, limit: ${batchSize})`);

      // Get batch of users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('fid, username, has_notifications, notification_status_updated_at, notification_status_source')
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (profilesError) {
        console.error(`❌ Error fetching batch ${batch + 1}:`, profilesError);
        summary.errors++;
        continue;
      }

      const batchResults = [];
      let batchEnabled = 0;
      let batchNewlyEnabled = 0;
      let batchNewlyDisabled = 0;

      // Process each user in the batch
      for (const profile of profiles) {
        try {
          console.log(`🔍 Checking FID ${profile.fid} (${profile.username})...`);
          
          const hasNotifications = await hasNotificationTokenInNeynar(profile.fid);
          const statusChanged = profile.has_notifications !== hasNotifications;

          // Update database - preserve farcaster_event source
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              has_notifications: hasNotifications,
              notification_status_updated_at: new Date().toISOString(),
              notification_status_source: profile.notification_status_source === 'farcaster_event' ? 'farcaster_event' : 'full_sync'
            })
            .eq('fid', profile.fid);

          const result = {
            fid: profile.fid,
            username: profile.username,
            previousStatus: profile.has_notifications,
            currentStatus: hasNotifications,
            statusChanged,
            updated: !updateError,
            error: updateError?.message
          };

          batchResults.push(result);
          summary.totalProcessed++;

          if (hasNotifications) {
            batchEnabled++;
            summary.totalEnabled++;
            if (!profile.has_notifications) {
              batchNewlyEnabled++;
              summary.newlyEnabled++;
              console.log(`🔔 ${profile.username} (${profile.fid}): NEWLY ENABLED notifications`);
            }
          } else {
            summary.totalDisabled++;
            if (profile.has_notifications) {
              batchNewlyDisabled++;
              summary.newlyDisabled++;
              console.log(`🔕 ${profile.username} (${profile.fid}): NEWLY DISABLED notifications`);
            }
          }

          if (updateError) {
            summary.errors++;
            console.error(`❌ Update failed for FID ${profile.fid}:`, updateError);
          }

        } catch (error) {
          console.error(`❌ Error processing FID ${profile.fid}:`, error);
          batchResults.push({
            fid: profile.fid,
            username: profile.username,
            error: error.message
          });
          summary.errors++;
        }

        // Small delay to avoid overwhelming Neynar API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const batchSummary = {
        batchNumber: batch + 1,
        processed: profiles.length,
        enabled: batchEnabled,
        newlyEnabled: batchNewlyEnabled,
        newlyDisabled: batchNewlyDisabled,
        offset: offset
      };

      summary.batches.push(batchSummary);
      results.push(...batchResults);

      console.log(`✅ Batch ${batch + 1} complete: ${profiles.length} processed, ${batchEnabled} enabled, ${batchNewlyEnabled} newly enabled`);

      // Longer delay between batches
      if (batch < maxBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Final summary
    const finalSummary = {
      ...summary,
      totalUsers,
      completionPercentage: Math.round((summary.totalProcessed / totalUsers) * 100),
      enabledPercentage: summary.totalProcessed > 0 ? Math.round((summary.totalEnabled / summary.totalProcessed) * 100) : 0,
      estimatedTotalEnabled: Math.round((summary.totalEnabled / summary.totalProcessed) * totalUsers)
    };

    console.log('🎉 Full Sync Complete!');
    console.log(`📊 Processed: ${summary.totalProcessed}/${totalUsers} users (${finalSummary.completionPercentage}%)`);
    console.log(`🔔 Found ${summary.totalEnabled} enabled (${finalSummary.enabledPercentage}% of processed)`);
    console.log(`⬆️ Newly enabled: ${summary.newlyEnabled}`);
    console.log(`⬇️ Newly disabled: ${summary.newlyDisabled}`);
    console.log(`🎯 Estimated total enabled users: ${finalSummary.estimatedTotalEnabled}`);

    return NextResponse.json({
      success: true,
      message: `Full sync processed ${summary.totalProcessed} users`,
      summary: finalSummary,
      detailedResults: results.slice(0, 100), // Limit detailed results to prevent huge responses
      hasMoreResults: results.length > 100,
      totalResultsAvailable: results.length
    });

  } catch (error) {
    console.error('❌ Error in full notification sync:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
});

// GET endpoint for status and instructions
export async function GET() {
  try {
    // Get current stats
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('fid', { count: 'exact', head: true });

    const { count: enabledUsers } = await supabase
      .from('profiles')
      .select('fid', { count: 'exact', head: true })
      .eq('has_notifications', true);

    return NextResponse.json({
      message: 'Full Notification Sync Endpoint',
      currentStats: {
        totalUsers,
        enabledUsers,
        enabledPercentage: totalUsers > 0 ? Math.round((enabledUsers / totalUsers) * 100) : 0
      },
      usage: {
        'POST {}': 'Run full sync with default settings (25 users/batch, 20 batches max)',
        'POST {batchSize: 50}': 'Custom batch size',
        'POST {maxBatches: 10}': 'Limit number of batches',
        'POST {startOffset: 100}': 'Start from specific user offset'
      },
      recommendations: {
        conservative: 'batchSize: 20, maxBatches: 10 (200 users)',
        moderate: 'batchSize: 25, maxBatches: 20 (500 users)',  
        aggressive: 'batchSize: 50, maxBatches: 30 (1500 users)'
      },
      estimatedTime: {
        '200 users': '~5 minutes',
        '500 users': '~12 minutes',
        '1000 users': '~25 minutes'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 