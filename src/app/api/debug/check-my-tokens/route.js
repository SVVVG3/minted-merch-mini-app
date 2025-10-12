import { NextResponse } from 'next/server';
import { checkUserNotificationStatus } from '@/lib/neynar';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID parameter is required'
      }, { status: 400 });
    }

    console.log(`🔍 Checking notification tokens for FID ${fid}...`);

    // Get the raw token data from Neynar
    const tokenStatus = await checkUserNotificationStatus(parseInt(fid));

    // Return all the details so we can see what's in Neynar
    return NextResponse.json({
      success: true,
      fid: parseInt(fid),
      summary: {
        hasAnyNotifications: tokenStatus.hasNotifications,
        hasFarcasterNotifications: tokenStatus.hasFarcasterNotifications,
        hasBaseNotifications: tokenStatus.hasBaseNotifications,
        totalActiveTokens: tokenStatus.tokenCount,
        farcasterTokenCount: tokenStatus.farcasterTokenCount,
        baseTokenCount: tokenStatus.baseTokenCount
      },
      allTokens: tokenStatus.allTokens?.map(token => ({
        fid: token.fid,
        status: token.status,
        client: token.client || 'UNKNOWN',
        created_at: token.created_at,
        // Don't expose the actual token for security
        hasToken: !!token.token
      })) || [],
      activeTokens: tokenStatus.tokens?.map(token => ({
        fid: token.fid,
        status: token.status,
        client: token.client || 'UNKNOWN',
        created_at: token.created_at
      })) || [],
      error: tokenStatus.error || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error checking tokens:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

