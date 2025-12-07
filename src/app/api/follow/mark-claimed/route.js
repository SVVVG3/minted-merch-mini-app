import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';

/**
 * POST /api/follow/mark-claimed
 * 
 * Mark the follow reward as claimed after successful blockchain transaction
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
    const { transactionHash } = body;

    if (!transactionHash) {
      return NextResponse.json(
        { error: 'Transaction hash required' },
        { status: 400 }
      );
    }

    console.log(`✅ Marking follow reward as claimed for FID ${fid}, TX: ${transactionHash}`);

    // Update the record
    const { data, error } = await supabaseAdmin
      .from('follow_rewards')
      .update({
        has_claimed: true,
        claimed_at: new Date().toISOString(),
        claim_transaction_hash: transactionHash,
        updated_at: new Date().toISOString()
      })
      .eq('user_fid', fid)
      .select()
      .single();

    if (error) {
      console.error('❌ Error marking claimed:', error);
      return NextResponse.json(
        { error: 'Failed to mark as claimed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      claimedAt: data.claimed_at,
      transactionHash
    });

  } catch (error) {
    console.error('❌ Error marking follow reward claimed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

