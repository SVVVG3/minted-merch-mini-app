import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  checkTokenGatedEligibility, 
  getEligibleAutoApplyDiscounts,
  createExampleTokenGatedDiscounts 
} from '@/lib/tokenGating';
import { fetchUserWalletData } from '@/lib/walletUtils';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const testFid = parseInt(searchParams.get('fid')) || 466111;
    const action = searchParams.get('action') || 'test_eligibility';
    const discountCode = searchParams.get('code');

    console.log('🎫 Testing token-gated discounts - Action:', action, 'FID:', testFid);

    const results = {
      action,
      test_fid: testFid,
      timestamp: new Date().toISOString(),
      tests: {}
    };

    switch (action) {
      case 'setup_examples':
        results.tests.setup = await setupExampleDiscounts();
        break;
        
      case 'test_eligibility':
        results.tests.eligibility = await testUserEligibility(testFid, discountCode);
        break;
        
      case 'test_auto_apply':
        results.tests.auto_apply = await testAutoApplyDiscounts(testFid);
        break;
        
      case 'list_discounts':
        results.tests.discounts = await listTokenGatedDiscounts();
        break;
        
      case 'full_test':
        results.tests.setup = await setupExampleDiscounts();
        results.tests.discounts = await listTokenGatedDiscounts();
        results.tests.eligibility = await testUserEligibility(testFid);
        results.tests.auto_apply = await testAutoApplyDiscounts(testFid);
        break;
        
      default:
        results.error = `Unknown action: ${action}`;
    }

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('❌ Error in token-gated test:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

/**
 * Set up example token-gated discounts for testing
 */
async function setupExampleDiscounts() {
  try {
    console.log('🔧 Setting up example token-gated discounts...');
    
    await createExampleTokenGatedDiscounts();
    
    // List created discounts
    const { data: discounts, error } = await supabase
      .from('discount_codes')
      .select('code, gating_type, discount_value, auto_apply, priority_level')
      .in('code', ['NOUNS20', 'WHALETOKEN10', 'VIP50'])
      .order('priority_level', { ascending: false });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      created_discounts: discounts,
      count: discounts?.length || 0
    };

  } catch (error) {
    console.error('Error setting up examples:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test user eligibility for token-gated discounts
 */
async function testUserEligibility(fid, specificCode = null) {
  try {
    console.log('🔍 Testing user eligibility for FID:', fid);

    // Get user wallet data
    const walletData = await fetchUserWalletData(fid);
    const userWalletAddresses = walletData?.all_wallet_addresses || [];

    console.log('User wallet addresses:', userWalletAddresses);

    // Get discounts to test
    let query = supabase
      .from('discount_codes')
      .select('*')
      .neq('gating_type', 'none');

    if (specificCode) {
      query = query.eq('code', specificCode);
    } else {
      query = query.in('code', ['NOUNS20', 'WHALETOKEN10', 'VIP50']);
    }

    const { data: discounts, error } = await query;

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    if (!discounts || discounts.length === 0) {
      return {
        success: false,
        error: 'No token-gated discounts found to test'
      };
    }

    // Test each discount
    const eligibilityResults = [];
    
    for (const discount of discounts) {
      console.log(`Testing discount: ${discount.code} (${discount.gating_type})`);
      
      const eligibility = await checkTokenGatedEligibility(
        discount, 
        fid, 
        userWalletAddresses,
        {
          userAgent: 'Debug Test',
          ipAddress: '127.0.0.1'
        }
      );

      eligibilityResults.push({
        discount_code: discount.code,
        gating_type: discount.gating_type,
        discount_value: discount.discount_value,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        details: eligibility.details
      });
    }

    return {
      success: true,
      fid,
      wallet_count: userWalletAddresses.length,
      wallet_addresses: userWalletAddresses,
      tested_discounts: eligibilityResults.length,
      eligible_count: eligibilityResults.filter(r => r.eligible).length,
      results: eligibilityResults
    };

  } catch (error) {
    console.error('Error testing eligibility:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test auto-apply discount functionality
 */
async function testAutoApplyDiscounts(fid) {
  try {
    console.log('🎯 Testing auto-apply discounts for FID:', fid);

    // Get user wallet data
    const walletData = await fetchUserWalletData(fid);
    const userWalletAddresses = walletData?.all_wallet_addresses || [];

    // Test auto-apply discounts
    const eligibleDiscounts = await getEligibleAutoApplyDiscounts(
      fid, 
      userWalletAddresses, 
      'site_wide', 
      []
    );

    return {
      success: true,
      fid,
      wallet_count: userWalletAddresses.length,
      eligible_auto_apply_count: eligibleDiscounts.length,
      eligible_discounts: eligibleDiscounts.map(d => ({
        code: d.code,
        gating_type: d.gating_type,
        discount_value: d.discount_value,
        priority_level: d.priority_level,
        eligible: d.eligibility_details?.eligible,
        reason: d.eligibility_details?.reason
      })),
      recommended_discount: eligibleDiscounts.length > 0 ? {
        code: eligibleDiscounts[0].code,
        value: eligibleDiscounts[0].discount_value,
        type: eligibleDiscounts[0].discount_type
      } : null
    };

  } catch (error) {
    console.error('Error testing auto-apply:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List all token-gated discounts in the system
 */
async function listTokenGatedDiscounts() {
  try {
    console.log('📋 Listing all token-gated discounts...');

    const { data: discounts, error } = await supabase
      .from('discount_codes')
      .select(`
        code,
        discount_type,
        discount_value,
        discount_scope,
        gating_type,
        contract_addresses,
        whitelisted_fids,
        whitelisted_wallets,
        required_balance,
        auto_apply,
        priority_level,
        max_uses_total,
        current_total_uses,
        expires_at,
        created_at
      `)
      .neq('gating_type', 'none')
      .order('priority_level', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    const categorized = {
      nft_gated: discounts.filter(d => d.gating_type === 'nft_holding'),
      token_gated: discounts.filter(d => d.gating_type === 'token_balance'),
      fid_whitelisted: discounts.filter(d => d.gating_type === 'whitelist_fid'),
      wallet_whitelisted: discounts.filter(d => d.gating_type === 'whitelist_wallet'),
      combined_gating: discounts.filter(d => d.gating_type === 'combined'),
      auto_apply: discounts.filter(d => d.auto_apply),
      manual_only: discounts.filter(d => !d.auto_apply)
    };

    return {
      success: true,
      total_count: discounts.length,
      by_type: {
        nft_gated: categorized.nft_gated.length,
        token_gated: categorized.token_gated.length,
        fid_whitelisted: categorized.fid_whitelisted.length,
        wallet_whitelisted: categorized.wallet_whitelisted.length,
        combined_gating: categorized.combined_gating.length
      },
      by_behavior: {
        auto_apply: categorized.auto_apply.length,
        manual_only: categorized.manual_only.length
      },
      discounts: discounts
    };

  } catch (error) {
    console.error('Error listing discounts:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function POST(request) {
  try {
    const { action, fid, discount_data } = await request.json();

    console.log('🎫 POST request for token-gated test:', { action, fid });

    switch (action) {
      case 'create_discount':
        return await createCustomDiscount(discount_data, fid);
        
      case 'delete_test_discounts':
        return await deleteTestDiscounts();
        
      default:
        return NextResponse.json({ 
          error: `Unknown POST action: ${action}` 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in POST token-gated test:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

/**
 * Create a custom token-gated discount
 */
async function createCustomDiscount(discountData, fid) {
  try {
    const { data, error } = await supabase
      .from('discount_codes')
      .insert({
        ...discountData,
        fid: fid || 466111,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      created_discount: data
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Delete test discounts
 */
async function deleteTestDiscounts() {
  try {
    const { error } = await supabase
      .from('discount_codes')
      .delete()
      .in('code', ['NOUNS20', 'WHALETOKEN10', 'VIP50']);

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Test discounts deleted'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 