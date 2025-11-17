// API route to fetch user wallet data (server-side only)
// This avoids importing Node.js packages in the browser

import { NextResponse } from 'next/server';
import { fetchUserWalletData, fetchUserWalletDataFromDatabase } from '@/lib/walletUtils';
import { setUserContext } from '@/lib/auth';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const includeTokenBalance = searchParams.get('includeTokenBalance') === 'true';

    console.log('Getting wallet data for FID:', fid, 'includeTokenBalance:', includeTokenBalance);

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    // 🔒 SECURITY FIX: Verify authenticated user can only access their own wallet data
    // Wallet addresses are PII and must be protected
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Returns 401 or 403 error if auth fails

    console.log(`✅ User FID ${authenticatedFid} authorized to access their wallet data`);

    // 🔒 SECURITY: Set user context for RLS policies
    await setUserContext(parseInt(fid));

    // Fetch comprehensive wallet data from database (includes Bankr addresses)
    const walletData = await fetchUserWalletDataFromDatabase(parseInt(fid));

    if (!walletData) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch wallet data',
        walletData: null
      });
    }

    return NextResponse.json({
      success: true,
      walletData,
      fid: parseInt(fid)
    });

  } catch (error) {
    console.error('❌ Error in user-wallet-data API:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 