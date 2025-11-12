// API endpoint to get ambassador profile and stats
// GET /api/ambassador/profile
// Returns ambassador profile with earnings, completed bounties, and wallet address

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAmbassadorStatus, getAmbassadorWalletAddress } from '@/lib/ambassadorHelpers';

export async function GET(request) {
  try {
    // Verify authentication
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
        error: 'Invalid authentication token'
      }, { status: 401 });
    }

    const fid = authResult.fid;
    console.log(`📊 Fetching ambassador profile for FID: ${fid}`);

    // Check if user is an ambassador
    const { isAmbassador, ambassadorId } = await checkAmbassadorStatus(fid);

    if (!isAmbassador) {
      return NextResponse.json({
        success: false,
        error: 'User is not an active ambassador'
      }, { status: 403 });
    }

    // Get ambassador profile with profile data
    const { data: ambassador, error: ambassadorError } = await supabaseAdmin
      .from('ambassadors')
      .select(`
        id,
        fid,
        total_earned_tokens,
        total_bounties_completed,
        created_at,
        profiles (
          username,
          display_name,
          pfp_url
        )
      `)
      .eq('id', ambassadorId)
      .single();

    if (ambassadorError || !ambassador) {
      console.error('❌ Error fetching ambassador profile:', ambassadorError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch ambassador profile'
      }, { status: 500 });
    }

    // Get wallet address from profiles
    const walletAddress = await getAmbassadorWalletAddress(fid);

    // Get pending payouts count
    const { count: pendingPayouts, error: payoutsError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select('id', { count: 'exact', head: true })
      .eq('ambassador_id', ambassadorId)
      .eq('status', 'pending');

    const pendingPayoutsCount = payoutsError ? 0 : (pendingPayouts || 0);

    return NextResponse.json({
      success: true,
      data: {
        id: ambassador.id,
        fid: ambassador.fid,
        username: ambassador.profiles?.username || null,
        displayName: ambassador.profiles?.display_name || null,
        pfpUrl: ambassador.profiles?.pfp_url || null,
        totalEarnedTokens: ambassador.total_earned_tokens || 0,
        totalBountiesCompleted: ambassador.total_bounties_completed || 0,
        walletAddress: walletAddress,
        pendingPayouts: pendingPayoutsCount,
        joinedAt: ambassador.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error in ambassador profile endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

