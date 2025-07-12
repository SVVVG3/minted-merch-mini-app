import { NextResponse } from 'next/server';
import { formatPSTTime } from '@/lib/timezone';

// Simple in-memory store for cron job execution tracking
let cronExecutions = [];

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobType = searchParams.get('job') || 'unknown';
    
    console.log(`🤖 Cron job executed: ${jobType} at ${formatPSTTime()}`);
    
    // Log the execution
    cronExecutions.push({
      job: jobType,
      timestamp: formatPSTTime(),
      utcTime: new Date().toISOString()
    });
    
    // Keep only the last 20 executions
    if (cronExecutions.length > 20) {
      cronExecutions = cronExecutions.slice(-20);
    }
    
    return NextResponse.json({
      success: true,
      message: `Cron job ${jobType} executed`,
      timestamp: formatPSTTime()
    });
    
  } catch (error) {
    console.error('Error in cron health check:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    return NextResponse.json({
      success: true,
      message: 'Cron job execution history',
      executions: cronExecutions,
      currentTime: formatPSTTime(),
      totalExecutions: cronExecutions.length
    });
    
  } catch (error) {
    console.error('Error getting cron health check:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 