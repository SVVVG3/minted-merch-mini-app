import { NextResponse } from 'next/server';
import { neynarClient } from '@/lib/neynar';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID parameter is required'
      }, { status: 400 });
    }

    console.log(`🔍 Checking RAW notification tokens for FID ${fid}...`);

    // Get RAW token data directly from Neynar SDK
    const response = await neynarClient.fetchNotificationTokens({
      fids: fid.toString(),
      limit: 100
    });

    console.log('RAW Neynar response:', JSON.stringify(response, null, 2));

    const tokens = response.notification_tokens || [];
    const userTokens = tokens.filter(token => token.fid === parseInt(fid));
    const activeTokens = userTokens.filter(token => token.status === 'enabled');

    // Return ALL fields from the token object so we can see everything
    return NextResponse.json({
      success: true,
      fid: parseInt(fid),
      summary: {
        totalTokens: userTokens.length,
        activeTokens: activeTokens.length,
        disabledTokens: userTokens.length - activeTokens.length
      },
      allTokensRaw: userTokens.map(token => ({
        ...token,
        // Mask the actual token value for security
        token: token.token ? `${token.token.substring(0, 10)}...` : null
      })),
      activeTokensRaw: activeTokens.map(token => ({
        ...token,
        // Mask the actual token value for security
        token: token.token ? `${token.token.substring(0, 10)}...` : null
      })),
      rawResponseKeys: Object.keys(response),
      firstTokenKeys: userTokens.length > 0 ? Object.keys(userTokens[0]) : [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error checking tokens:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

