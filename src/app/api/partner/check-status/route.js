import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyFarcasterUser } from '@/lib/auth';

export async function GET(request) {
  try {
    // Get FID from query params
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }

    // Verify the user is authenticated
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authResult = await verifyFarcasterUser(token);

    if (!authResult.authenticated) {
      return NextResponse.json({
        success: false,
        error: 'Invalid session'
      }, { status: 401 });
    }

    // Make sure the authenticated user is checking their own status
    if (authResult.fid !== parseInt(fid)) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 403 });
    }

    // Check if user is a partner
    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .select('id, is_active, partner_type')
      .eq('fid', fid)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking partner status:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to check partner status'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      isPartner: !!partner,
      partnerType: partner?.partner_type || null
    });

  } catch (error) {
    console.error('Error in partner check-status:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

