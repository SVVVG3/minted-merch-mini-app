import { NextResponse } from 'next/server';
import { fetchBulkUserProfiles } from '@/lib/neynar';

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