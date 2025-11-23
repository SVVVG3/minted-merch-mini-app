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
    
    // OPTIMIZATION: Read from database instead of calling Neynar API
    // We already have all user profile data stored locally!
    console.log(`🔍 Fetching ${limitedFids.length} user profiles from DATABASE (not Neynar)`);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('fid, username, display_name, pfp_url, bio')
      .in('fid', limitedFids);
    
    if (error) {
      console.error('Error fetching profiles from database:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
    
    // Format response to match Neynar's structure for compatibility
    const userMap = {};
    (data || []).forEach(user => {
      userMap[user.fid] = {
        fid: user.fid,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.pfp_url, // Match Neynar's field name
        bio: user.bio || ''
      };
    });
    
    console.log(`✅ Fetched ${data?.length || 0} profiles from database (0 Neynar API calls)`);

    // Return users object keyed by FID for leaderboard compatibility
    return NextResponse.json({
      success: true,
      users: userMap,
      count: Object.keys(userMap).length
    });
    
  } catch (error) {
    console.error('Error in user-profiles API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 