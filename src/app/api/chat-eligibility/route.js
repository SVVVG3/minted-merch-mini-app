import { NextResponse } from 'next/server';
import { checkChatEligibility, generateChatInvitation } from '@/lib/chatEligibility';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

export async function POST(request) {
  try {
    const { action, fid, walletAddresses } = await request.json();

    if (!fid || !walletAddresses || !Array.isArray(walletAddresses)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: fid and walletAddresses'
      }, { status: 400 });
    }

    // PHASE 2 SECURITY: Verify user can only check/generate for their own FID
    // Prevents unauthorized chat invitation generation
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Return 401 or 403 error

    switch (action) {
      case 'check':
        const eligibility = await checkChatEligibility(walletAddresses, fid);
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

    // 🔒 SECURITY FIX: Call function directly instead of HTTP to avoid auth issues
    // Server-side calls don't have JWT tokens, so we import the function directly
    const { fetchUserWalletDataFromDatabase } = await import('@/lib/walletUtils');
    const walletData = await fetchUserWalletDataFromDatabase(parseInt(fid));

    if (!walletData) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch user wallet data'
      }, { status: 400 });
    }

    // Check eligibility
    const eligibility = await checkChatEligibility(walletData.all_wallet_addresses || [], parseInt(fid));
    
    return NextResponse.json({
      success: true,
      fid: parseInt(fid),
      eligibility,
      walletCount: walletData.all_wallet_addresses?.length || 0
    });

  } catch (error) {
    console.error('❌ Chat eligibility GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
