import { NextResponse } from 'next/server';
import { formatPSTTime } from '@/lib/timezone';

// Force dynamic rendering to prevent caching issues with cron jobs
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const timestamp = formatPSTTime();
    
    console.log('🧪 TEST CRON JOB EXECUTED:', timestamp);
    
    // Check for CRON_SECRET authorization (required by Vercel cron jobs)
    const authHeader = request.headers.get('authorization');
    const forceRun = request.headers.get('X-Force-Run') === 'true';
    
    // Skip auth check for manual testing
    if (!forceRun) {
      if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.log('❌ Unauthorized test cron job request - missing or invalid CRON_SECRET');
        return NextResponse.json({
          success: false,
          error: 'Unauthorized - Invalid CRON_SECRET'
        }, { status: 401 });
      }
      console.log('✅ Test cron CRON_SECRET authorization verified');
    }
    
    // Log cron job execution for debugging
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app'}/api/debug/cron-health-check?job=test-cron`, {
        method: 'POST'
      });
    } catch (logError) {
      console.log('Failed to log test cron execution:', logError.message);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test cron job executed successfully',
      timestamp: timestamp,
      note: 'This is a test endpoint to verify cron jobs are working'
    });
    
  } catch (error) {
    console.error('Error in test cron job:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const timestamp = formatPSTTime();
    
    // Check for CRON_SECRET authorization (Vercel cron jobs use GET requests)
    const authHeader = request.headers.get('authorization');
    const forceRun = request.headers.get('X-Force-Run') === 'true';
    
    // If this is a cron job request (has auth header), execute the test
    if (authHeader && !forceRun) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.log('❌ Unauthorized test cron job GET request - invalid CRON_SECRET');
        return NextResponse.json({
          success: false,
          error: 'Unauthorized - Invalid CRON_SECRET'
        }, { status: 401 });
      }
      
      console.log('✅ Test cron CRON_SECRET authorization verified for GET request');
      console.log('🧪 TEST CRON JOB EXECUTED via GET:', timestamp);
      
      // Log cron job execution for debugging
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app'}/api/debug/cron-health-check?job=test-cron`, {
          method: 'POST'
        });
      } catch (logError) {
        console.log('Failed to log test cron execution:', logError.message);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Test cron job executed successfully via GET',
        timestamp: timestamp,
        note: 'This is a test endpoint to verify cron jobs are working'
      });
    }

    // Default response for non-cron requests
    return NextResponse.json({
      success: true,
      message: 'Test cron job endpoint',
      currentTime: formatPSTTime(),
      note: 'This endpoint is used to test if cron jobs are working'
    });
  } catch (error) {
    console.error('Error in test cron job GET:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 