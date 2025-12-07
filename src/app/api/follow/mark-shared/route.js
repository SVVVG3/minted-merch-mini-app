import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';

/**
 * POST /api/follow/mark-shared
 * 
 * Mark that the user has shared their follow reward claim
 */
export async function POST(request) {
  try {
    // Authenticate user
    const fid = await getAuthenticatedFid(request);
    if (!fid) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { castHash } = body;

    console.log(`📤 Marking follow reward as shared for FID ${fid}`);

    // Update the record
    const { data, error } = await supabaseAdmin
      .from('follow_rewards')
      .update({
        has_shared: true,
        shared_at: new Date().toISOString(),
        share_cast_hash: castHash || null,
        updated_at: new Date().toISOString()
      })
      .eq('user_fid', fid)
      .select()
      .single();

    if (error) {
      console.error('❌ Error marking shared:', error);
      return NextResponse.json(
        { error: 'Failed to mark as shared' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sharedAt: data.shared_at
    });

  } catch (error) {
    console.error('❌ Error marking follow reward shared:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

