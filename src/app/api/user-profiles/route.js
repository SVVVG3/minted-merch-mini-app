import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { setUserContext } from '@/lib/auth';
import { fetchBulkUserProfiles } from '@/lib/neynar';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    console.log('Getting profile for FID:', fid);

    // 🔒 SECURITY: Set user context for RLS policies
    await setUserContext(fid);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('fid', fid)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in user-profiles API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { fids } = await request.json();
    
    if (!fids || !Array.isArray(fids) || fids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'FIDs array is required'
      }, { status: 400 });
    }

    // Limit to 100 users max per request
    const limitedFids = fids.slice(0, 100);
    
    const result = await fetchBulkUserProfiles(limitedFids);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in user-profiles API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 