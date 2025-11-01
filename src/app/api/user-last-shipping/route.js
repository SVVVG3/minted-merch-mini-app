import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // SECURITY FIX: Verify user can only access their own shipping data
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Return 401 or 403 error

    console.log('🔍 Fetching last shipping address for FID:', fid);

    // Get the most recent order with shipping address for this user (including archived orders)
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('shipping_address')
      .eq('fid', fid)
      .not('shipping_address', 'is', null)
      // Include archived orders since they contain the most complete shipping info
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - user has no previous orders
        console.log('📝 No previous shipping address found for FID:', fid);
        return NextResponse.json({
          shippingAddress: null,
          message: 'No previous shipping address found'
        });
      }
      
      console.error('❌ Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch shipping address from database' },
        { status: 500 }
      );
    }

    if (!order || !order.shipping_address) {
      console.log('📝 No shipping address found for FID:', fid);
      return NextResponse.json({
        shippingAddress: null,
        message: 'No previous shipping address found'
      });
    }

    console.log('✅ Found previous shipping address for FID:', fid);
    
    return NextResponse.json({
      shippingAddress: order.shipping_address,
      message: 'Previous shipping address found'
    });

  } catch (error) {
    console.error('❌ Error in user-last-shipping API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}