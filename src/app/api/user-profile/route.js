import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

export async function POST(request) {
  try {
    const { fid } = await request.json();

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }

    // 🔒 SECURITY FIX: Verify user can only access their own profile
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Returns 401 or 403 error if auth fails

    console.log(`✅ User FID ${authenticatedFid} authorized to access their profile`);

    // Get user profile with cached token balance and wallet addresses
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('fid, token_balance, token_balance_updated_at, all_wallet_addresses')
      .eq('fid', fid)
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Add GET endpoint for notification status checks (lightweight)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }

    // 🔒 SECURITY FIX: Verify user can only access their own profile
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Returns 401 or 403 error if auth fails

    // Get user profile with notification status only (very lightweight)
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('fid, has_notifications, notification_status_updated_at')
      .eq('fid', fid)
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile: profile
    });

  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
