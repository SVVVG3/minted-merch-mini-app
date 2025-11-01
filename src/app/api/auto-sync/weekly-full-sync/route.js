import { NextResponse } from 'next/server';

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
      console.warn(`🚫 Unauthorized weekly-sync attempt from IP: ${clientIp}`);
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'This endpoint requires valid cron authentication'
        },
        { status: 401 }
      );
    }
    
    console.log('✅ CRON_SECRET verified - proceeding with weekly full sync');
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
        'Authorization': `Bearer ${cronSecret}` // Pass cron secret to nested call
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