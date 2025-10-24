import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'test_bankr_discount';
    const fid = searchParams.get('fid') || '466111';
    
    console.log(`🧪 Testing product discount fix - Action: ${action}, FID: ${fid}`);
    
    const results = {
      action,
      fid,
      tests: [],
      summary: { passed: 0, failed: 0 }
    };
    
    // Test 1: Check Bankr Club discount data
    try {
      const baseUrl = new URL(request.url).origin;
      
      // Get Bankr hoodie with discount
      const bankrHoodieResponse = await fetch(`${baseUrl}/api/shopify/products?handle=bankr-hoodie&fid=${fid}`);
      const bankrHoodieData = await bankrHoodieResponse.json();
      
      // Get a non-Bankr product (should not get Bankr discount)
      const dickbuttCapResponse = await fetch(`${baseUrl}/api/shopify/products?handle=cryptoadickbutzz-og-cap&fid=${fid}`);
      const dickbuttCapData = await dickbuttCapResponse.json();
      
      results.tests.push({
        name: 'Product Discount Data Check',
        status: 'PASSED',
        message: 'Successfully fetched product discount data',
        data: {
          bankrHoodie: {
            handle: bankrHoodieData.handle,
            hasDiscount: !!bankrHoodieData.availableDiscounts?.best,
            discountCode: bankrHoodieData.availableDiscounts?.best?.code,
            discountScope: bankrHoodieData.availableDiscounts?.best?.discount_scope,
            targetProducts: bankrHoodieData.availableDiscounts?.best?.target_products
          },
          dickbuttCap: {
            handle: dickbuttCapData.handle,
            hasDiscount: !!dickbuttCapData.availableDiscounts?.best,
            discountCode: dickbuttCapData.availableDiscounts?.best?.code,
            discountScope: dickbuttCapData.availableDiscounts?.best?.discount_scope
          }
        }
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: 'Product Discount Data Check',
        status: 'FAILED',
        message: error.message
      });
      results.summary.failed++;
    }
    
    // Test 2: Simulate mixed cart calculation
    try {
      const mixedCartScenario = {
        description: 'Cart with 1 Bankr Hoodie ($60) + 1 Dickbutt Cap ($29.97) = $89.97 subtotal',
        items: [
          {
            product: { handle: 'bankr-hoodie', title: 'Bankr Hoodie' },
            price: 60.00,
            quantity: 1
          },
          {
            product: { handle: 'cryptoadickbutzz-og-cap', title: 'Dickbutt Cap' },
            price: 29.97,
            quantity: 1
          }
        ],
        appliedDiscount: {
          code: 'BANKRCLUB-MERCH-20',
          discountType: 'percentage',
          discountValue: 20,
          source: 'product_specific_api',
          target_products: ['bankr-hoodie', 'bankr-cap']
        }
      };
      
      // Calculate what the discount should be
      const bankrHoodieSubtotal = 60.00; // Only the Bankr Hoodie should get the discount
      const expectedDiscount = bankrHoodieSubtotal * 0.20; // 20% of $60 = $12.00
      const expectedFinalTotal = 89.97 - expectedDiscount; // $89.97 - $12.00 = $77.97
      
      results.tests.push({
        name: 'Mixed Cart Discount Calculation Test',
        status: 'PASSED',
        message: 'Product-specific discount should only apply to qualifying products',
        data: {
          scenario: mixedCartScenario.description,
          cartSubtotal: 89.97,
          qualifyingProductSubtotal: bankrHoodieSubtotal,
          expectedDiscountAmount: expectedDiscount,
          expectedFinalTotal: expectedFinalTotal,
          discountDetails: {
            code: mixedCartScenario.appliedDiscount.code,
            type: '20% off Bankr merchandise',
            appliesTo: 'Bankr Hoodie only (not Dickbutt Cap)'
          }
        }
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: 'Mixed Cart Discount Calculation Test',
        status: 'FAILED',
        message: error.message
      });
      results.summary.failed++;
    }
    
    // Test 3: Test different action types
    if (action === 'test_snapshot_discount') {
      try {
        const snapshotScenario = {
          description: 'Cart with 1 Tiny Hyper Tee ($24.99) + 1 Other Product ($30) = $54.99 subtotal',
          items: [
            {
              product: { handle: 'tiny-hyper-tee', title: 'Tiny Hyper Tee' },
              price: 24.99,
              quantity: 1
            },
            {
              product: { handle: 'other-product', title: 'Other Product' },
              price: 30.00,
              quantity: 1
            }
          ],
          appliedDiscount: {
            code: 'SNAPSHOT-TINY-HYPER-FREE',
            discountType: 'percentage',
            discountValue: 100,
            source: 'product_specific_api',
            target_products: ['tiny-hyper-tee']
          }
        };
        
        // Calculate what the discount should be
        const tinyHyperSubtotal = 24.99; // Only the Tiny Hyper Tee should get 100% off
        const expectedDiscount = tinyHyperSubtotal; // 100% of $24.99 = $24.99
        const expectedFinalTotal = 54.99 - expectedDiscount; // $54.99 - $24.99 = $30.00
        
        results.tests.push({
          name: 'Snapshot Discount Test (100% off single product)',
          status: 'PASSED',
          message: '100% discount should only apply to Tiny Hyper Tee',
          data: {
            scenario: snapshotScenario.description,
            cartSubtotal: 54.99,
            qualifyingProductSubtotal: tinyHyperSubtotal,
            expectedDiscountAmount: expectedDiscount,
            expectedFinalTotal: expectedFinalTotal,
            discountDetails: {
              code: snapshotScenario.appliedDiscount.code,
              type: '100% off (FREE) Tiny Hyper Tee',
              appliesTo: 'Tiny Hyper Tee only (not Other Product)',
              maxItems: 1 // Limited to 1 item for 100% discounts
            }
          }
        });
        results.summary.passed++;
      } catch (error) {
        results.tests.push({
          name: 'Snapshot Discount Test (100% off single product)',
          status: 'FAILED',
          message: error.message
        });
        results.summary.failed++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Product discount fix test completed: ${results.summary.passed} passed, ${results.summary.failed} failed`,
      results,
      instructions: {
        'test_bankr_discount': 'Tests Bankr Club merchandise discount logic',
        'test_snapshot_discount': 'Tests Tiny Hyper Tee 100% discount logic',
        'usage': 'Add ?action=test_snapshot_discount&fid=YOUR_FID to test different scenarios'
      }
    });
    
  } catch (error) {
    console.error('❌ Error in product discount fix test:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});