import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

/**
 * GET /api/profile?fid=123
 * 
 * Lightweight endpoint to fetch basic profile data including pfp_url
 * Used by useFarcaster to restore user profile after page reload
 */
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

    // 🔒 SECURITY: Verify user can only access their own profile
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Returns 401 or 403 error if auth fails

    // Get basic profile data including pfp_url
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, pfp_url, bio')
      .eq('fid', fid)
      .single();

    if (error) {
      // PGRST116 = "0 rows" - profile doesn't exist yet, not a real error
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          profile: null // User not registered yet, that's okay
        });
      }
      // Actual error
      console.error('Error fetching profile:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: profile
    });

  } catch (error) {
    console.error('❌ Error in /api/profile:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

