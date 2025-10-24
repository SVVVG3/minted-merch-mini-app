import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkTokenGatedEligibility } from '@/lib/tokenGating';
import { fetchUserWalletData } from '@/lib/walletUtils';
import { withAdminAuth } from '@/lib/adminAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET = withAdminAuth(async (request, context) => {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');
  const discountCode = searchParams.get('code');

  if (!fid) {
    return NextResponse.json({ success: false, error: 'Missing fid parameter' }, { status: 400 });
  }

  try {
    console.log('🔍 DEBUG: Checking discount eligibility for FID:', fid);
    
    // Get user's wallet addresses
    let userWalletAddresses = [];
    try {
      const walletData = await fetchUserWalletData(fid);
      userWalletAddresses = walletData?.all_wallet_addresses || [];
      console.log('📱 User has', userWalletAddresses.length, 'wallet addresses');
    } catch (error) {
      console.error('❌ Failed to fetch wallet data:', error);
    }

    // Get all auto-apply discounts
    const { data: autoApplyDiscounts, error: discountError } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .eq('auto_apply', true)
      .eq('is_used', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('priority_level', { ascending: false })
      .order('discount_value', { ascending: false });

    if (discountError) {
      console.error('Error fetching discounts:', discountError);
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    console.log(`Found ${autoApplyDiscounts.length} auto-apply discounts`);

    // Filter for specific discount if provided
    let discountsToCheck = autoApplyDiscounts;
    if (discountCode) {
      discountsToCheck = autoApplyDiscounts.filter(d => 
        d.code.toLowerCase().includes(discountCode.toLowerCase())
      );
      console.log(`Filtered to ${discountsToCheck.length} discounts matching "${discountCode}"`);
    }

    const results = [];

    for (const discount of discountsToCheck) {
      console.log(`\n🎫 Checking discount: ${discount.code}`);
      console.log('   - Type:', discount.gating_type);
      console.log('   - Scope:', discount.discount_scope);
      console.log('   - Value:', discount.discount_value);
      console.log('   - Priority:', discount.priority_level);
      console.log('   - Expires:', discount.expires_at);
      console.log('   - Max uses total:', discount.max_uses_total);
      console.log('   - Current uses:', discount.current_total_uses);
      console.log('   - Contract addresses:', discount.contract_addresses);
      console.log('   - Required balance:', discount.required_balance);

      // Check eligibility
      const eligibility = await checkTokenGatedEligibility(discount, fid, userWalletAddresses);
      
      results.push({
        code: discount.code,
        gating_type: discount.gating_type,
        discount_scope: discount.discount_scope,
        discount_value: discount.discount_value,
        priority_level: discount.priority_level,
        expires_at: discount.expires_at,
        max_uses_total: discount.max_uses_total,
        current_total_uses: discount.current_total_uses,
        contract_addresses: discount.contract_addresses,
        required_balance: discount.required_balance,
        eligibility: eligibility
      });

      console.log(`   - Eligible: ${eligibility.eligible}`);
      console.log(`   - Reason: ${eligibility.reason}`);
      if (eligibility.details) {
        console.log(`   - Details:`, eligibility.details);
      }
    }

    return NextResponse.json({
      success: true,
      fid: parseInt(fid),
      walletCount: userWalletAddresses.length,
      walletAddresses: userWalletAddresses,
      totalDiscounts: autoApplyDiscounts.length,
      checkedDiscounts: results.length,
      results: results
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});
