import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchBulkUserProfiles } from '@/lib/neynar';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    console.log('Getting profile for FID:', fid);

    const { data, error } = await supabase
      .from('profiles')
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
    
    if (!result.success) {
      return NextResponse.json(result);
    }

    // Convert users object to array for admin dashboard compatibility
    const usersArray = Object.values(result.users || {});
    
    return NextResponse.json({
      success: true,
      data: usersArray,
      count: usersArray.length
    });
    
  } catch (error) {
    console.error('Error in user-profiles API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 