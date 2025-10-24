import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/adminAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { fid } = await request.json();
    
    if (!fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'FID required' 
      }, { status: 400 });
    }

    console.log('🧹 Manual cleanup requested for FID:', fid);

    // Get current day start (8 AM PST/PDT)
    function getPSTDayStart() {
      const now = new Date();
      const pstOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
      const pstNow = new Date(now.getTime() - pstOffset);
      
      const year = pstNow.getUTCFullYear();
      const month = pstNow.getUTCMonth();
      const date = pstNow.getUTCDate();
      const hour = pstNow.getUTCHours();
      
      let dayStart = new Date(Date.UTC(year, month, date, 8, 0, 0, 0));
      
      if (hour < 8) {
        dayStart = new Date(Date.UTC(year, month, date - 1, 8, 0, 0, 0));
      }
      
      const utcDayStart = new Date(dayStart.getTime() + pstOffset);
      return Math.floor(utcDayStart.getTime() / 1000);
    }

    const dayStart = getPSTDayStart();

    // Find any pending spin reservations for today
    const { data: existingSpin, error: checkError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', new Date(dayStart * 1000).toISOString())
      .is('spin_confirmed_at', null)
      .not('spin_reserved_at', 'is', null)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking for existing spin:', checkError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error' 
      }, { status: 500 });
    }

    if (existingSpin) {
      console.log('🧹 Found pending reservation to clean up:', {
        id: existingSpin.id,
        reservedAt: existingSpin.spin_reserved_at,
        ageMinutes: Math.floor((Date.now() - new Date(existingSpin.spin_reserved_at).getTime()) / (60 * 1000))
      });

      // Delete the pending reservation
      const { error: deleteError } = await supabase
        .from('point_transactions')
        .delete()
        .eq('id', existingSpin.id);

      if (deleteError) {
        console.error('❌ Error deleting reservation:', deleteError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to cleanup reservation' 
        }, { status: 500 });
      }

      console.log('✅ Pending reservation cleaned up successfully');
      return NextResponse.json({ 
        success: true, 
        message: 'Pending reservation cleaned up',
        cleanedUp: existingSpin
      });
    } else {
      console.log('ℹ️ No pending reservations found for FID:', fid);
      return NextResponse.json({ 
        success: true, 
        message: 'No pending reservations found'
      });
    }

  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});
