// API route to fetch user wallet data (server-side only)
// This avoids importing Node.js packages in the browser

import { NextResponse } from 'next/server';
import { fetchUserWalletData } from '@/lib/walletUtils';

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

    console.log('🔍 Fetching wallet data for FID:', fid);

    // Fetch wallet data using server-side function
    const walletData = await fetchUserWalletData(parseInt(fid));

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