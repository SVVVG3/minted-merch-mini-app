import { NextResponse } from 'next/server';
import { checkChatEligibility, generateChatInvitation } from '@/lib/chatEligibility';

export async function POST(request) {
  try {
    const { action, fid, walletAddresses } = await request.json();

    if (!fid || !walletAddresses || !Array.isArray(walletAddresses)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: fid and walletAddresses'
      }, { status: 400 });
    }

    switch (action) {
      case 'check':
        const eligibility = await checkChatEligibility(walletAddresses);
        return NextResponse.json({
          success: true,
          eligibility
        });

      case 'generate_invitation':
        const invitation = await generateChatInvitation(fid, walletAddresses);
        return NextResponse.json({
          success: true,
          invitation
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use "check" or "generate_invitation"'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Chat eligibility API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'Missing FID parameter'
      }, { status: 400 });
    }

    // Get user's wallet addresses from your existing API
    const walletResponse = await fetch(`${request.nextUrl.origin}/api/user-wallet-data?fid=${fid}`);
    const walletData = await walletResponse.json();

    if (!walletData.success) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch user wallet data'
      }, { status: 400 });
    }

    // Check eligibility
    const eligibility = await checkChatEligibility(walletData.walletAddresses || []);
    
    return NextResponse.json({
      success: true,
      fid: parseInt(fid),
      eligibility,
      walletCount: walletData.walletAddresses?.length || 0
    });

  } catch (error) {
    console.error('❌ Chat eligibility GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
