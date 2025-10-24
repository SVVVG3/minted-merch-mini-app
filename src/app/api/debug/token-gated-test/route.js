import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  checkTokenGatedEligibility, 
  getEligibleAutoApplyDiscounts,
  createExampleTokenGatedDiscounts 
} from '@/lib/tokenGating';
import { fetchUserWalletData } from '@/lib/walletUtils';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
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
        
      case 'create_fren_discount':
        results.tests.fren_discount = await createFrenTrunksDiscount();
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
        
      case 'test_zapper':
        results.tests.zapper = await testZapperIntegration(testFid);
        break;
        
      case 'full_test':
        results.tests.setup = await setupExampleDiscounts();
        results.tests.discounts = await listTokenGatedDiscounts();
        results.tests.eligibility = await testUserEligibility(testFid);
        results.tests.auto_apply = await testAutoApplyDiscounts(testFid);
        results.tests.zapper = await testZapperIntegration(testFid);
        break;
        
      case 'get_fren_product_id':
        results.tests.fren_product_id = await getFrenTrunksProductId();
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
});

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
      zapper_integration: {
        api_key_configured: !!process.env.ZAPPER_API_KEY,
        status: process.env.ZAPPER_API_KEY ? 'enabled' : 'using mock data'
      },
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

export const POST = withAdminAuth(async (request, context) => {
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
});

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
 * Create Fren Trunks 50% discount for specific NFT collection
 */
async function createFrenTrunksDiscount() {
  try {
    console.log('🏊 Creating Fren Trunks NFT discount using new products table...');

    // First, ensure Fren Trunks is in our products table
    console.log('📦 Syncing Fren Trunks product to products table...');
    
    // Sync directly using Shopify API instead of internal fetch
    const { getProductByHandle } = await import('@/lib/shopify');
    const shopifyProduct = await getProductByHandle('fren-trunks');
    
    if (!shopifyProduct) {
      return {
        success: false,
        error: 'Could not find Fren Trunks product in Shopify'
      };
    }

    // Check if product exists in our products table
    const { data: existingProduct, error: checkError } = await supabase
      .from('products')
      .select('*')
      .eq('handle', 'fren-trunks')
      .single();

    let frenTrunksProduct;

    if (checkError && checkError.code === 'PGRST116') {
      // Product doesn't exist, create it
      console.log('📦 Creating Fren Trunks in products table...');
      
      const productData = {
        handle: shopifyProduct.handle,
        shopify_id: shopifyProduct.id.split('/').pop(), // Extract numeric ID
        shopify_graphql_id: shopifyProduct.id,
        title: shopifyProduct.title,
        description: shopifyProduct.description,
        product_type: shopifyProduct.productType,
        vendor: shopifyProduct.vendor,
        status: shopifyProduct.status?.toLowerCase() || 'active',
        tags: shopifyProduct.tags || [],
        price_min: parseFloat(shopifyProduct.priceRange?.minVariantPrice?.amount || 0),
        price_max: parseFloat(shopifyProduct.priceRange?.maxVariantPrice?.amount || 0),
        variant_count: shopifyProduct.variants?.edges?.length || 0,
        image_url: shopifyProduct.featuredImage?.url,
        synced_at: new Date().toISOString()
      };

      const { data: newProduct, error: insertError } = await supabase
        .from('products')
        .insert(productData)
        .select('*')
        .single();

      if (insertError) {
        console.error('❌ Failed to create product in products table:', insertError);
        return {
          success: false,
          error: `Failed to create product: ${insertError.message}`
        };
      }

      frenTrunksProduct = newProduct;
      console.log('✅ Created Fren Trunks in products table');
    } else if (checkError) {
      console.error('❌ Error checking for existing product:', checkError);
      return {
        success: false,
        error: `Database error: ${checkError.message}`
      };
    } else {
      // Product exists, use it
      frenTrunksProduct = existingProduct;
      console.log('✅ Found existing Fren Trunks in products table');
    }
    console.log('✅ Fren Trunks synced to products table:', {
      id: frenTrunksProduct.id,
      handle: frenTrunksProduct.handle,
      title: frenTrunksProduct.title,
      shopify_id: frenTrunksProduct.shopify_id
    });

    // Check if discount already exists and delete it
    const { data: existingDiscount } = await supabase
      .from('discount_codes')
      .select('id, code')
      .eq('code', 'FRENWHALE50')
      .single();

    if (existingDiscount) {
      console.log('🗑️ Deleting existing FRENWHALE50 discount...');
      await supabase
        .from('discount_codes')
        .delete()
        .eq('id', existingDiscount.id);
    }

    // Create discount using new products table approach
    const discountData = {
      code: 'FRENWHALE50',
      discount_type: 'percentage',
      discount_value: 50,
      discount_scope: 'product',
      target_product_ids: [frenTrunksProduct.id], // NEW: Use Supabase products table ID
      target_products: [frenTrunksProduct.shopify_graphql_id], // LEGACY: Keep for backward compatibility
      gating_type: 'nft_holding',
      contract_addresses: ['0x123b30E25973FeCd8354dd5f41Cc45A3065eF88C'], // The contract user specified
      required_balance: 1, // Need at least 1 NFT
      chain_ids: [1], // Ethereum mainnet
      auto_apply: true,
      priority_level: 12, // High priority
      max_uses_total: 1000, // Limit total uses
      max_uses_per_user: 1, // One use per user
      discount_description: '50% off Fren Trunks for NFT holders',
      campaign_id: 'fren_nft_holders_2025',
      code_type: 'promotional',
      fid: 466111, // Created by you
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days
    };

    console.log('🆕 Creating discount with new products table data:', {
      code: discountData.code,
      target_product_ids: discountData.target_product_ids,
      target_products: discountData.target_products,
      discount_scope: discountData.discount_scope
    });

    const { data, error } = await supabase
      .from('discount_codes')
      .insert(discountData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating Fren Trunks discount:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }

    console.log('✅ Created Fren Trunks discount:', data.code);

    return {
      success: true,
      discount: data,
      message: `Created ${data.code}: 50% off Fren Trunks for NFT collection 0x123b30E25973FeCd8354dd5f41Cc45A3065eF88C holders`,
      details: {
        product_targeted: 'Fren Trunks',
        supabase_product_id: frenTrunksProduct.id,
        shopify_product_id: frenTrunksProduct.shopify_id,
        contract_address: '0x123b30E25973FeCd8354dd5f41Cc45A3065eF88C',
        discount_value: '50%',
        expires_in_days: 60,
        uses_new_products_table: true
      }
    };

  } catch (error) {
    console.error('❌ Error in createFrenTrunksDiscount:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test Zapper API integration directly
 */
async function testZapperIntegration(fid) {
  try {
    console.log('🌐 Testing Zapper API integration for FID:', fid);

    // Get user wallet data
    const walletData = await fetchUserWalletData(fid);
    const userWalletAddresses = walletData?.all_wallet_addresses || [];

    if (userWalletAddresses.length === 0) {
      return {
        success: false,
        error: 'No wallet addresses found for user',
        fid,
        zapper_status: process.env.ZAPPER_API_KEY ? 'enabled' : 'disabled'
      };
    }

    const results = {
      success: true,
      fid,
      wallet_addresses: userWalletAddresses,
      zapper_api_key_configured: !!process.env.ZAPPER_API_KEY,
      tests: {}
    };

    try {
      // Import blockchain API functions
      const { 
        checkNftHoldingsWithZapper, 
        checkTokenHoldingsWithZapper,
        getPortfolioSummaryWithZapper 
      } = await import('@/lib/blockchainAPI.js');

      // Test NFT holdings check with known collections
      console.log('Testing NFT holdings...');
      const nftTest = await checkNftHoldingsWithZapper(
        userWalletAddresses, 
        ['0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03'], // Nouns contract
        [1], // Ethereum mainnet
        1
      );

      results.tests.nft_holdings = {
        success: true,
        test_contract: '0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03', // Nouns
        result: nftTest,
        using_mock_data: !process.env.ZAPPER_API_KEY
      };

      // Test token holdings check 
      console.log('Testing token holdings...');
      const tokenTest = await checkTokenHoldingsWithZapper(
        userWalletAddresses,
        ['0xA0b86a33E6417ba04e3E0F0a09ce5CF46c39748A'], // Example token
        [1],
        1000
      );

      results.tests.token_holdings = {
        success: true,
        test_contract: '0xA0b86a33E6417ba04e3E0F0a09ce5CF46c39748A',
        result: tokenTest,
        using_mock_data: !process.env.ZAPPER_API_KEY
      };

      // Test portfolio summary
      console.log('Testing portfolio summary...');
      const portfolioTest = await getPortfolioSummaryWithZapper(
        userWalletAddresses,
        [1, 8453] // Ethereum + Base
      );

      results.tests.portfolio_summary = {
        success: true,
        result: portfolioTest,
        using_mock_data: !process.env.ZAPPER_API_KEY
      };

    } catch (zapperError) {
      console.error('Zapper API test error:', zapperError);
      results.tests.error = {
        message: zapperError.message,
        stack: zapperError.stack
      };
    }

    return results;

  } catch (error) {
    console.error('Error testing Zapper integration:', error);
    return {
      success: false,
      error: error.message,
      zapper_status: process.env.ZAPPER_API_KEY ? 'enabled' : 'disabled'
    };
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

// NEW: Get Fren Trunks product ID for debugging
async function getFrenTrunksProductId() {
  try {
    const shopifyApiUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN}/api/2024-07/graphql.json`;
    
    // Fetch Fren Trunks product data
    const query = `
      query getProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          handle
          legacyResourceId
        }
      }
    `;
    
    const variables = { handle: 'fren-trunks' };
    
    const response = await fetch(shopifyApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN
      },
      body: JSON.stringify({ query, variables })
    });
    
    const result = await response.json();
    
    return {
      success: true,
      product: result.data?.productByHandle,
      graphql_id: result.data?.productByHandle?.id,
      legacy_id: result.data?.productByHandle?.legacyResourceId,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
} 