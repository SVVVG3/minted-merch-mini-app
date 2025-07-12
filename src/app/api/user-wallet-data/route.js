// API route to fetch user wallet data (server-side only)
// This avoids importing Node.js packages in the browser

import { NextResponse } from 'next/server';
import { fetchUserWalletData } from '@/lib/walletUtils';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const includeTokenBalance = searchParams.get('includeTokenBalance') === 'true';

    console.log('Getting wallet data for FID:', fid, 'includeTokenBalance:', includeTokenBalance);

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    // 🔒 SECURITY: Set user context for RLS policies
    await supabase.rpc('set_config', {
      parameter: 'app.user_fid', 
      value: fid.toString()
    });

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