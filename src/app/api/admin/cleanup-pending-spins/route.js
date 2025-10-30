import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    const supabase = getSupabaseAdmin();
    const { fid, reason = 'Cleanup pending transaction' } = await request.json();
    
    if (!fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing fid parameter' 
      }, { status: 400 });
    }

    console.log('🧹 Cleaning up pending spins for FID:', fid);

    // Find pending transactions for this user
    const { data: pendingTransactions, error: findError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .not('spin_reserved_at', 'is', null) // Has a spin reservation
      .is('spin_confirmed_at', null) // But not confirmed
      .is('spin_tx_hash', null) // And no transaction hash
      .order('created_at', { ascending: false });

    if (findError) {
      console.error('Error finding pending transactions:', findError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error finding transactions' 
      }, { status: 500 });
    }

    if (!pendingTransactions || pendingTransactions.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No pending transactions found for this user',
        cleaned: 0
      });
    }

    console.log('🔍 Found pending transactions:', pendingTransactions.map(t => ({
      id: t.id,
      created_at: t.created_at,
      spin_reserved_at: t.spin_reserved_at
    })));

    // Delete the pending transactions
    const transactionIds = pendingTransactions.map(t => t.id);
    const { error: deleteError } = await supabase
      .from('point_transactions')
      .delete()
      .in('id', transactionIds);

    if (deleteError) {
      console.error('Error deleting pending transactions:', deleteError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error deleting transactions' 
      }, { status: 500 });
    }

    console.log('✅ Successfully cleaned up pending transactions');

    return NextResponse.json({ 
      success: true, 
      message: `Cleaned up ${pendingTransactions.length} pending transaction(s)`,
      cleaned: pendingTransactions.length,
      cleanedTransactions: pendingTransactions.map(t => ({
        id: t.id,
        created_at: t.created_at,
        spin_reserved_at: t.spin_reserved_at,
        description: t.description
      })),
      reason
    });
    
  } catch (error) {
    console.error('❌ Cleanup API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
});

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing fid parameter' 
      }, { status: 400 });
    }

    // Just show what would be cleaned up
    const { data: pendingTransactions, error: findError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .not('spin_reserved_at', 'is', null) // Has a spin reservation
      .is('spin_confirmed_at', null) // But not confirmed
      .is('spin_tx_hash', null) // And no transaction hash
      .order('created_at', { ascending: false });

    if (findError) {
      console.error('Error finding pending transactions:', findError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      pendingTransactions: pendingTransactions || [],
      count: pendingTransactions ? pendingTransactions.length : 0,
      message: pendingTransactions && pendingTransactions.length > 0 ? 
        `Found ${pendingTransactions.length} pending transaction(s) that can be cleaned up` :
        'No pending transactions found for this user'
    });
    
  } catch (error) {
    console.error('❌ Cleanup API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
});
