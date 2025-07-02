// API route to check token-gated discount eligibility (server-side only)
// This avoids importing Node.js packages in the browser

import { NextResponse } from 'next/server';
import { getEligibleAutoApplyDiscounts } from '@/lib/tokenGating';

export async function POST(request) {
  try {
    const body = await request.json();
    const { fid, walletAddresses, scope = 'site_wide', productIds = [] } = body;

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }

    if (!walletAddresses || !Array.isArray(walletAddresses)) {
      return NextResponse.json({
        success: false,
        error: 'walletAddresses array is required'
      }, { status: 400 });
    }

    console.log('🎫 Checking token-gated eligibility for FID:', fid);
    console.log('Wallet addresses:', walletAddresses);
    console.log('Scope:', scope, 'Product IDs:', productIds);

    // Check for eligible token-gated discounts using server-side function
    const eligibleDiscounts = await getEligibleAutoApplyDiscounts(
      fid, 
      walletAddresses, 
      scope, 
      productIds
    );

    console.log('Eligible token-gated discounts found:', eligibleDiscounts.length);

    return NextResponse.json({
      success: true,
      eligibleDiscounts,
      fid,
      walletAddressCount: walletAddresses.length,
      scope,
      productIds
    });

  } catch (error) {
    console.error('❌ Error in check-token-gated-eligibility API:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      eligibleDiscounts: []
    }, { status: 500 });
  }
} 