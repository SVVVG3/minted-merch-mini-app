import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('📅 Weekly full sync initiated by cron job');
    
    // Call the main auto-sync endpoint with full sync parameters
    const autoSyncUrl = new URL('/api/auto-sync/notification-status', request.url);
    
    const fullSyncParams = {
      forceFullSync: true,
      maxUsers: 500,
      batchSize: 50,
      dryRun: false
    };
    
    const response = await fetch(autoSyncUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fullSyncParams)
    });
    
    const result = await response.json();
    
    console.log('📊 Weekly full sync completed:', {
      success: result.success,
      changes: result.summary?.newlyEnabled + result.summary?.newlyDisabled || 0,
      processed: result.summary?.totalProcessed || 0
    });
    
    return NextResponse.json({
      success: true,
      message: 'Weekly full sync completed',
      autoSyncResult: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in weekly full sync:', error);
    return NextResponse.json({ 
      error: error.message,
      message: 'Weekly full sync failed'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Weekly Full Sync Endpoint',
    description: 'Runs comprehensive notification status sync every Sunday',
    schedule: 'Sundays at 6:00 AM PDT (13:00 UTC)',
    features: [
      'Full sync of all notification-enabled users',
      'Comprehensive drift detection',
      'Higher user limits for thorough coverage'
    ]
  });
} 