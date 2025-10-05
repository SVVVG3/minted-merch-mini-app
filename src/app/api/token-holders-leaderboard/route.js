import { NextResponse } from 'next/server';
import { getTokenHoldersLeaderboard, getUserTokenHoldersPosition } from '@/lib/tokenBalanceCache';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const userFid = searchParams.get('userFid');

    console.log(`📊 Fetching token holders leaderboard (limit: ${limit}, userFid: ${userFid})`);

    const result = await getTokenHoldersLeaderboard(limit);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to fetch token holders leaderboard'
      }, { status: 500 });
    }

    // Get user position if userFid provided
    let userPosition = null;
    if (userFid) {
      const fid = parseInt(userFid);
      if (!isNaN(fid) && fid > 0) {
        userPosition = await getUserTokenHoldersPosition(fid);
      }
    }

    console.log(`✅ Retrieved ${result.leaderboard.length} token holders`);

    return NextResponse.json({
      success: true,
      leaderboard: result.leaderboard,
      userPosition: userPosition,
      total_holders: result.total_holders,
      limit,
      message: `Found ${result.total_holders} token holders`
    });

  } catch (error) {
    console.error('❌ Error fetching token holders leaderboard:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
