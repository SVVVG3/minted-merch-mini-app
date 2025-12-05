// API endpoint to get mogul profile and stats
// GET /api/mogul/profile
// SECURITY: Requires JWT authentication and 50M+ token balance

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { checkMogulStatus, getMogulProfile } from '@/lib/mogulHelpers';

export async function GET(request) {
  try {
    // SECURITY: Verify JWT authentication
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
    console.log(`👤 Fetching mogul profile for FID: ${fid}`);

    // SECURITY: Check if user is a Merch Mogul
    const { isMogul, tokenBalance } = await checkMogulStatus(fid);

    if (!isMogul) {
      return NextResponse.json({
        success: false,
        error: 'Merch Mogul status required (50M+ $mintedmerch tokens)',
        tokenBalance,
        requiredBalance: 50_000_000
      }, { status: 403 });
    }

    // Get mogul profile with stats
    const profile = await getMogulProfile(fid);

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: 'Profile not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile
    });

  } catch (error) {
    console.error('❌ Error in mogul profile endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

