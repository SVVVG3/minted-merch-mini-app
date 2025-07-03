import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid') || '466111';
    const supabaseId = searchParams.get('supabaseId') || '31'; // Tiny Hyper Tee
    const walletAddress = searchParams.get('wallet') || '0x380d89b06a1a596a2c4f788daaabc2dcc6493888';

    console.log('🧪 Testing product token-gating logic');
    console.log('FID:', fid);
    console.log('Supabase Product ID:', supabaseId);
    console.log('Wallet Address:', walletAddress);

    const results = {
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      env: process.env.NODE_ENV,
      testSteps: []
    };

    // Step 1: Test wallet data fetch
    try {
      const walletUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/user-wallet-data?fid=${fid}`;
      console.log('🔍 Testing wallet data fetch:', walletUrl);
      
      const walletResponse = await fetch(walletUrl);
      const walletData = await walletResponse.json();
      
      results.testSteps.push({
        step: 'wallet_data_fetch',
        success: walletData.success,
        url: walletUrl,
        data: walletData,
        addresses: walletData.walletData?.all_wallet_addresses || []
      });

      // Step 2: Test token-gating eligibility
      if (walletData.success && walletData.walletData?.all_wallet_addresses?.length > 0) {
        const tokenGatingUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/check-token-gated-eligibility`;
        console.log('🔍 Testing token-gating eligibility:', tokenGatingUrl);
        
        const tokenGatingResponse = await fetch(tokenGatingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fid: parseInt(fid),
            walletAddresses: walletData.walletData.all_wallet_addresses,
            scope: 'all',
            productIds: [parseInt(supabaseId)]
          })
        });
        
        const tokenGatingResult = await tokenGatingResponse.json();
        
        results.testSteps.push({
          step: 'token_gating_eligibility',
          success: tokenGatingResult.success,
          url: tokenGatingUrl,
          data: tokenGatingResult,
          eligibleDiscounts: tokenGatingResult.eligibleDiscounts || []
        });

        // Step 3: Test product-specific filtering
        if (tokenGatingResult.success && tokenGatingResult.eligibleDiscounts?.length > 0) {
          const productSpecificTokenDiscount = tokenGatingResult.eligibleDiscounts.find(d => 
            d.target_product_ids && d.target_product_ids.includes(parseInt(supabaseId))
          );
          
          const siteWideTokenDiscount = tokenGatingResult.eligibleDiscounts.find(d => 
            d.discount_scope === 'site_wide'
          );
          
          results.testSteps.push({
            step: 'discount_filtering',
            success: true,
            productSpecificFound: !!productSpecificTokenDiscount,
            siteWideFound: !!siteWideTokenDiscount,
            productSpecificDiscount: productSpecificTokenDiscount,
            siteWideDiscount: siteWideTokenDiscount,
            selectedDiscount: productSpecificTokenDiscount || siteWideTokenDiscount
          });
        }
      }
    } catch (error) {
      results.testSteps.push({
        step: 'error',
        error: error.message,
        stack: error.stack
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('❌ Error in product token-gating test:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 