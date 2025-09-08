// API route to check token-gated discount eligibility (server-side only)
// This avoids importing Node.js packages in the browser

import { NextResponse } from 'next/server';
import { getEligibleAutoApplyDiscounts } from '@/lib/tokenGating';
import { deduplicateRequest } from '@/lib/requestDeduplication';

export async function POST(request) {
  try {
    const body = await request.json();
    const { fid, walletAddresses, scope = 'site_wide', productIds = [], useCacheOnly = false } = body;

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }

    // walletAddresses is now optional - will be fetched internally if not provided
    let userWalletAddresses = walletAddresses;
    
    if (!userWalletAddresses || !Array.isArray(userWalletAddresses) || userWalletAddresses.length === 0) {
      console.log('📋 No wallet addresses provided, will fetch internally from user profile');
      userWalletAddresses = []; // Will be fetched by tokenGating.js
    }

    console.log('🎫 Checking token-gated eligibility for FID:', fid);
    console.log('Wallet addresses:', userWalletAddresses);
    console.log('Scope:', scope, 'Product IDs:', productIds);

    // Use request deduplication to prevent concurrent calls for same user
    // Include productIds in key to ensure different products get different results
    const productKey = productIds && productIds.length > 0 ? `-products-${productIds.sort().join(',')}` : '';
    const deduplicationKey = `token-eligibility-${fid}-${scope}${productKey}${useCacheOnly ? '-cache' : ''}`;
    const eligibleDiscounts = await deduplicateRequest(
      deduplicationKey,
      () => getEligibleAutoApplyDiscounts(fid, userWalletAddresses, scope, productIds, useCacheOnly),
      30000 // Cache for 30 seconds
    );

    console.log('🔍 DETAILED ELIGIBILITY RESULTS:');
    console.log('Total eligible discounts found:', eligibleDiscounts.length);
    
    if (eligibleDiscounts.length > 0) {
      console.log('🚨 RETURNING ELIGIBLE DISCOUNTS:');
      eligibleDiscounts.forEach((discount, index) => {
        console.log(`${index + 1}. ${discount.code}:`);
        console.log(`   - Type: ${discount.gating_type}`);
        console.log(`   - Required: ${discount.required_balance}`);
        console.log(`   - Contract: ${discount.contract_addresses}`);
        console.log(`   - Eligibility reason: ${discount.eligibility_details?.reason}`);
        console.log(`   - Token balance found: ${discount.eligibility_details?.details?.found_balance}`);
      });
    } else {
      console.log('✅ CORRECTLY RETURNING NO ELIGIBLE DISCOUNTS');
    }

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