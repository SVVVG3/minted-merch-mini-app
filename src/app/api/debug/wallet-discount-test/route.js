import { NextResponse } from 'next/server';
import { getEligibleAutoApplyDiscounts } from '@/lib/tokenGating';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const fid = parseInt(searchParams.get('fid')) || 466111;
    const walletAddress = searchParams.get('wallet') || '0x380d89b06a1a596a2c4f788daaabc2dcc6493888';
    const scope = searchParams.get('scope') || 'all';

    console.log('🧪 Testing wallet-gated discount eligibility');
    console.log('FID:', fid);
    console.log('Wallet:', walletAddress);
    console.log('Scope:', scope);

    // Test with the wallet address that should be eligible
    const userWalletAddresses = [
      walletAddress,
      '0x44d4c58efcbb44639d64420175cf519aa3191a86', // other addresses from the user
    ];

    const eligibleDiscounts = await getEligibleAutoApplyDiscounts(
      fid,
      userWalletAddresses,
      scope,
      []
    );

    console.log('✅ Eligible discounts found:', eligibleDiscounts.length);

    return NextResponse.json({
      success: true,
      test_params: {
        fid,
        wallet_address: walletAddress,
        scope,
        total_wallet_addresses: userWalletAddresses.length
      },
      eligible_discounts: eligibleDiscounts,
      eligible_count: eligibleDiscounts.length,
      found_snapshot_discount: eligibleDiscounts.some(d => d.code === 'SNAPSHOT-TINY-HYPER-FREE'),
      details: eligibleDiscounts.map(d => ({
        code: d.code,
        discount_type: d.discount_type,
        discount_value: d.discount_value,
        discount_scope: d.discount_scope,
        gating_type: d.gating_type,
        eligible: d.eligibility_details?.eligible,
        eligibility_reason: d.eligibility_details?.reason,
        matching_wallet: d.eligibility_details?.details?.matching_wallet
      }))
    });

  } catch (error) {
    console.error('❌ Error in wallet discount test:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});