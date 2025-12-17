import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/farcaster/user?fid=<fid>
 * 
 * Fetch a user profile by FID from our database
 * Only returns users who have already used the app
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { success: false, error: 'FID is required' },
        { status: 400 }
      );
    }

    const fidNum = parseInt(fid);
    if (isNaN(fidNum) || fidNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid FID' },
        { status: 400 }
      );
    }

    // Check our profiles table
    const { data: profile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, pfp_url')
      .eq('fid', fidNum)
      .single();

    if (dbError || !profile) {
      return NextResponse.json(
        { success: false, error: 'User not found. They must open the app first.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        fid: profile.fid,
        username: profile.username,
        display_name: profile.display_name,
        pfp_url: profile.pfp_url
      }
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
