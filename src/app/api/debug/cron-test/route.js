import { NextResponse } from 'next/server';
import { formatPSTTime } from '@/lib/timezone';

// Force dynamic rendering to prevent caching issues with cron jobs
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const timestamp = formatPSTTime();
    
    console.log('🧪 TEST CRON JOB EXECUTED:', timestamp);
    
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
  return NextResponse.json({
    success: true,
    message: 'Test cron job endpoint',
    currentTime: formatPSTTime(),
    note: 'This endpoint is used to test if cron jobs are working'
  });
} 