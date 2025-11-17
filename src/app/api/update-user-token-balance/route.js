import { NextResponse } from 'next/server';
import { refreshUserTokenBalance } from '@/lib/tokenBalanceCache';
import { fetchUserWalletData } from '@/lib/walletUtils';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

export async function POST(request) {
  try {
    const { fid } = await request.json();

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }

    // 🔒 SECURITY FIX: Verify user can only update their own token balance
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Returns 401 or 403 error if auth fails

    console.log(`🔄 Authenticated user FID ${fid} updating their token balance`);

    // Get user's wallet addresses
    let userWalletAddresses = [];
    try {
      const walletData = await fetchUserWalletData(fid);
      userWalletAddresses = walletData.walletAddresses || [];
      console.log(`📱 Found ${userWalletAddresses.length} wallet addresses for FID ${fid}`);
    } catch (error) {
      console.error(`❌ Failed to fetch wallet data for FID ${fid}:`, error);
      // Continue with empty wallet array - will set balance to 0
    }

    // Update/refresh the user's token balance
    const result = await refreshUserTokenBalance(fid, userWalletAddresses);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to update token balance'
      }, { status: 500 });
    }

    console.log(`✅ Updated token balance for FID ${fid}: ${result.balance} tokens (${result.fromCache ? 'cached' : 'fresh'})`);

    return NextResponse.json({
      success: true,
      balance: result.balance,
      fromCache: result.fromCache,
      updated_at: result.updated_at,
      message: `Token balance updated: ${result.balance} tokens`
    });

  } catch (error) {
    console.error('❌ Error updating user token balance:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
