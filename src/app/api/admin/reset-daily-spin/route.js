// ADMIN ENDPOINT - Reset a user's daily spin for testing
// Allows testing the spin flow without waiting 24 hours
import { withAdminAuth } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(request) {
  // Admin auth already verified by withAdminAuth wrapper

  try {
    const { fid, userFid } = await request.json();
    
    // Accept either 'fid' or 'userFid' for backwards compatibility
    const targetFid = fid || userFid;

    if (!targetFid) {
      return NextResponse.json({ 
        success: false, 
        error: 'userFid is required' 
      }, { status: 400 });
    }

    console.log('🔧 ADMIN: Resetting daily spin for FID:', targetFid);

    // Get today's check-in day (PST)
    const { getCurrentCheckInDay } = await import('@/lib/timezone.js');
    const checkInDay = getCurrentCheckInDay();
    
    console.log('📅 Current check-in day:', checkInDay);

    // Delete today's check-in transaction(s) if any exist
    const { data: deletedTransactions, error: deleteError } = await supabaseAdmin
      .from('point_transactions')
      .delete()
      .eq('user_fid', targetFid)
      .eq('transaction_type', 'daily_checkin')
      .eq('reference_id', `checkin-${targetFid}-${checkInDay}`)
      .select();

    if (deleteError) {
      console.error('❌ Error deleting transactions:', deleteError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to delete transactions',
        details: deleteError.message
      }, { status: 500 });
    }

    const deletedCount = deletedTransactions?.length || 0;
    console.log(`🗑️ Deleted ${deletedCount} transaction(s) for today`);

    // Also check for any pending transactions from today and delete them
    const { data: pendingTransactions, error: pendingError } = await supabaseAdmin
      .from('point_transactions')
      .delete()
      .eq('user_fid', targetFid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .is('spin_confirmed_at', null)
      .select();

    const pendingCount = pendingTransactions?.length || 0;
    if (pendingCount > 0) {
      console.log(`🗑️ Also deleted ${pendingCount} pending transaction(s) from today`);
    }

    console.log('✅ ADMIN: Successfully reset daily spin for FID:', targetFid);
    
    return NextResponse.json({
      success: true,
      message: 'Daily spin reset successfully',
      data: {
        deletedTransactions: deletedCount,
        deletedPending: pendingCount,
        totalDeleted: deletedCount + pendingCount,
        checkInDay: checkInDay,
        note: 'User can now spin again today. Note: Smart contract state cannot be reset - if they already spun on-chain today, the contract will still reject.'
      }
    });

  } catch (error) {
    console.error('Error in reset-daily-spin:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

// Wrap with admin authentication
export const POST = withAdminAuth(handler);
