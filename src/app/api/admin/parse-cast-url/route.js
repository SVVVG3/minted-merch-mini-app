// API endpoint to parse Farcaster cast URLs
// POST /api/admin/parse-cast-url
// Admin-only endpoint to extract cast hash and author info from Farcaster URLs

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { parseCastUrl } from '@/lib/farcasterBountyVerification';

export const POST = withAdminAuth(async (request) => {
  try {
    const { castUrl } = await request.json();

    if (!castUrl) {
      return NextResponse.json({
        success: false,
        error: 'Cast URL is required'
      }, { status: 400 });
    }

    console.log(`🔍 Parsing cast URL: ${castUrl}`);

    // Parse the URL
    const castInfo = await parseCastUrl(castUrl);

    if (!castInfo) {
      return NextResponse.json({
        success: false,
        error: 'Invalid cast URL or cast not found'
      }, { status: 400 });
    }

    console.log(`✅ Successfully parsed cast:`, castInfo);

    return NextResponse.json({
      success: true,
      data: castInfo
    });

  } catch (error) {
    console.error('❌ Error parsing cast URL:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to parse cast URL'
    }, { status: 500 });
  }
});

