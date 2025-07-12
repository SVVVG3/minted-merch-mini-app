import { NextResponse } from 'next/server';

export async function GET(request) {
  return NextResponse.json({
    success: true,
    message: 'Farcaster Event Testing Endpoint',
    instructions: {
      purpose: 'Test if Farcaster Mini App client events are being tracked properly',
      events: [
        'notificationsEnabled - User enables notifications',
        'notificationsDisabled - User disables notifications', 
        'miniappAdded - User adds the Mini App',
        'miniappRemoved - User removes the Mini App'
      ],
      usage: [
        'Open this Mini App in Farcaster client',
        'Enable/disable notifications to trigger events',
        'Check if notification_status_source gets set to "farcaster_event"'
      ]
    },
    checkEvents: 'POST /api/debug/test-farcaster-events {"action": "check_recent_events"}',
    simulateEvent: 'POST /api/debug/test-farcaster-events {"action": "simulate", "fid": 123, "event": "notificationsEnabled"}',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request) {
  try {
    const { action, fid, event } = await request.json();
    
    if (action === 'simulate') {
      // Simulate a Farcaster event
      if (!fid || !event) {
        return NextResponse.json({
          success: false,
          error: 'fid and event are required for simulation'
        }, { status: 400 });
      }
      
      console.log(`🧪 Simulating Farcaster event: ${event} for FID ${fid}`);
      
      // Call the update-notification-status endpoint with farcaster_event source
      const enabled = event === 'notificationsEnabled' || event === 'miniappAdded';
      const source = event === 'miniappRemoved' ? 'miniapp_removed' : 'farcaster_event';
      
      const updateUrl = new URL('/api/update-notification-status', request.url);
      
      const response = await fetch(updateUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: fid,
          enabled: enabled,
          source: source
        })
      });
      
      const result = await response.json();
      
      return NextResponse.json({
        success: true,
        message: `Simulated ${event} event for FID ${fid}`,
        simulation: {
          event,
          fid,
          enabled,
          source,
          updateResult: result
        },
        timestamp: new Date().toISOString()
      });
      
    } else if (action === 'check_recent_events') {
      // Check for recent farcaster_event sources
      const { supabase } = await import('@/lib/supabase');
      
      const { data: recentEvents, error } = await supabase
        .from('profiles')
        .select('fid, username, has_notifications, notification_status_source, notification_status_updated_at')
        .eq('notification_status_source', 'farcaster_event')
        .order('notification_status_updated_at', { ascending: false })
        .limit(10);
      
      if (error) {
        throw error;
      }
      
      // Also check for any recent updates in the last hour
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const { data: recentUpdates, error: recentError } = await supabase
        .from('profiles')
        .select('fid, username, has_notifications, notification_status_source, notification_status_updated_at')
        .gte('notification_status_updated_at', oneHourAgo.toISOString())
        .order('notification_status_updated_at', { ascending: false })
        .limit(20);
      
      if (recentError) {
        throw recentError;
      }
      
      return NextResponse.json({
        success: true,
        message: 'Recent Farcaster event tracking analysis',
        farcasterEvents: recentEvents,
        recentUpdates: recentUpdates,
        analysis: {
          totalFarcasterEvents: recentEvents.length,
          recentUpdatesInLastHour: recentUpdates.length,
          sourcesInLastHour: recentUpdates.reduce((acc, user) => {
            acc[user.notification_status_source] = (acc[user.notification_status_source] || 0) + 1;
            return acc;
          }, {})
        },
        recommendations: recentEvents.length === 0 ? [
          'No farcaster_event sources found - the event listeners may not be working',
          'Try enabling/disabling notifications in the Farcaster client',
          'Check browser console for event listener setup logs'
        ] : [
          'Farcaster events are being tracked correctly!',
          'Event listeners are working properly'
        ],
        timestamp: new Date().toISOString()
      });
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use "simulate" or "check_recent_events"'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Error in test-farcaster-events:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 