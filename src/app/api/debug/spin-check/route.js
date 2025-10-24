import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/adminAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to get PST day start (8 AM PST/PDT) - SAME as spin-permit
function getPSTDayStart() {
  const now = new Date();
  
  // Create a date in PST timezone (UTC-8)
  // Note: In August, California is in PDT (UTC-7), but we'll use consistent UTC-8
  const pstOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
  const pstNow = new Date(now.getTime() - pstOffset);
  
  // Get today's date in PST
  const year = pstNow.getUTCFullYear();
  const month = pstNow.getUTCMonth();
  const date = pstNow.getUTCDate();
  const hour = pstNow.getUTCHours();
  
  // Create 8 AM PST today
  let dayStart = new Date(Date.UTC(year, month, date, 8, 0, 0, 0));
  
  // If it's before 8 AM PST, use yesterday's 8 AM PST
  if (hour < 8) {
    dayStart = new Date(Date.UTC(year, month, date - 1, 8, 0, 0, 0));
  }
  
  // Convert to UTC and return as Unix timestamp
  const utcDayStart = new Date(dayStart.getTime() + pstOffset);
  
  return {
    unixTimestamp: Math.floor(utcDayStart.getTime() / 1000),
    nowUTC: now.toISOString(),
    nowPST: pstNow.toISOString(),
    pstHour: hour,
    dayStartPST: dayStart.toISOString(),
    dayStartUTC: utcDayStart.toISOString()
  };
}

export const GET = withAdminAuth(async (request, context) => {
  try {
    const url = new URL(request.url);
    const fid = url.searchParams.get('fid') || '466111'; // Default to your FID
    
    const dayStartInfo = getPSTDayStart();
    const dayStart = dayStartInfo.unixTimestamp;
    
    // Check for existing spins
    const { data: existingSpins, error } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', new Date(dayStart * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    return NextResponse.json({
      success: true,
      debug: {
        fid: parseInt(fid),
        timezone: dayStartInfo,
        query: {
          table: 'point_transactions',
          filters: {
            user_fid: fid,
            transaction_type: 'daily_checkin',
            created_at_gte: new Date(dayStart * 1000).toISOString()
          }
        },
        existingSpins: existingSpins || [],
        existingSpinCount: existingSpins?.length || 0,
        wouldBlock: existingSpins && existingSpins.length > 0
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});
