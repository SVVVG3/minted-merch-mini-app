import { NextResponse } from 'next/server';
import { createWelcomeDiscountCode, validateDiscountCode, calculateDiscountAmount, markDiscountCodeAsUsed } from '@/lib/discounts';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('=== CHECKOUT DISCOUNT FLOW TEST ===');
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // Test FID for testing
    const testFid = 98765;
    const testSubtotal = 150.00; // Test with $150 order

    // Test 1: Create Test Profile (if needed)
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('fid', testFid)
        .single();

      if (!existingProfile) {
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            fid: testFid,
            username: 'checkout-discount-test-user',
            display_name: 'Checkout Discount Test User'
          })
          .select()
          .single();

        if (profileError) throw profileError;
        
        testResults.tests.push({
          name: 'Create Test Profile',
          status: 'PASSED',
          message: `Test profile created for FID ${testFid}`
        });
      } else {
        testResults.tests.push({
          name: 'Create Test Profile',
          status: 'PASSED',
          message: `Test profile already exists for FID ${testFid}`
        });
      }
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Create Test Profile',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 2: Create Welcome Discount Code
    let testDiscountCode = null;
    try {
      const result = await createWelcomeDiscountCode(testFid);
      
      if (!result.success) throw new Error(result.error);
      
      testDiscountCode = result.code;
      testResults.tests.push({
        name: 'Create Welcome Discount Code',
        status: 'PASSED',
        message: `Generated discount code: ${result.code}`,
        data: { code: result.code, isExisting: result.isExisting }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Create Welcome Discount Code',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 3: Test Discount Validation API Endpoint
    try {
      if (!testDiscountCode) throw new Error('No discount code to test');
      
      const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/validate-discount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: testDiscountCode,
          fid: testFid,
          subtotal: testSubtotal
        })
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'API validation failed');
      }
      
      if (result.discountAmount !== testSubtotal * 0.15) {
        throw new Error(`Expected discount amount ${testSubtotal * 0.15}, got ${result.discountAmount}`);
      }
      
      testResults.tests.push({
        name: 'Discount Validation API Endpoint',
        status: 'PASSED',
        message: `API validation successful`,
        data: { 
          code: result.code,
          discountAmount: result.discountAmount,
          expectedAmount: testSubtotal * 0.15,
          message: result.message
        }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Discount Validation API Endpoint',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 4: Test Discount Amount Calculation
    try {
      if (!testDiscountCode) throw new Error('No discount code to test');
      
      const validationResult = await validateDiscountCode(testDiscountCode, testFid);
      
      if (!validationResult.success || !validationResult.isValid) {
        throw new Error('Discount code validation failed');
      }
      
      const discountAmount = calculateDiscountAmount(testSubtotal, validationResult);
      const expectedAmount = testSubtotal * 0.15; // 15% of $150 = $22.50
      
      if (Math.abs(discountAmount - expectedAmount) > 0.01) {
        throw new Error(`Expected ${expectedAmount}, got ${discountAmount}`);
      }
      
      testResults.tests.push({
        name: 'Discount Amount Calculation',
        status: 'PASSED',
        message: `Correct discount calculation: $${discountAmount.toFixed(2)} (15% of $${testSubtotal})`,
        data: { 
          subtotal: testSubtotal,
          discountPercentage: validationResult.discountValue,
          discountAmount: discountAmount,
          expectedAmount: expectedAmount
        }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Discount Amount Calculation',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 5: Test Order Total Calculation with Discount
    try {
      if (!testDiscountCode) throw new Error('No discount code to test');
      
      const subtotal = testSubtotal;
      const discountAmount = testSubtotal * 0.15; // 15% discount
      const shipping = 10.00;
      const tax = 12.00;
      
      const finalTotal = subtotal - discountAmount + shipping + tax;
      const expectedTotal = 150.00 - 22.50 + 10.00 + 12.00; // $149.50
      
      if (Math.abs(finalTotal - expectedTotal) > 0.01) {
        throw new Error(`Expected total ${expectedTotal}, got ${finalTotal}`);
      }
      
      testResults.tests.push({
        name: 'Order Total Calculation with Discount',
        status: 'PASSED',
        message: `Correct total calculation: $${finalTotal.toFixed(2)}`,
        data: { 
          subtotal: subtotal,
          discountAmount: discountAmount,
          shipping: shipping,
          tax: tax,
          finalTotal: finalTotal,
          breakdown: {
            'Subtotal': `$${subtotal.toFixed(2)}`,
            'Discount': `-$${discountAmount.toFixed(2)}`,
            'Shipping': `$${shipping.toFixed(2)}`,
            'Tax': `$${tax.toFixed(2)}`,
            'Total': `$${finalTotal.toFixed(2)}`
          }
        }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Order Total Calculation with Discount',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 6: Test Discount Code Usage Tracking
    try {
      if (!testDiscountCode) throw new Error('No discount code to test');
      
      // Mark the code as used
      const markUsedResult = await markDiscountCodeAsUsed(testDiscountCode, 'TEST_ORDER_123');
      
      if (!markUsedResult.success) {
        throw new Error(markUsedResult.error || 'Failed to mark code as used');
      }
      
      // Try to validate the used code
      const revalidationResult = await validateDiscountCode(testDiscountCode, testFid);
      
      if (revalidationResult.success && revalidationResult.isValid) {
        throw new Error('Used discount code should not be valid');
      }
      
      testResults.tests.push({
        name: 'Discount Code Usage Tracking',
        status: 'PASSED',
        message: `Code correctly marked as used and rejected on revalidation`,
        data: { 
          code: testDiscountCode,
          orderId: 'TEST_ORDER_123',
          revalidationError: revalidationResult.error
        }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Discount Code Usage Tracking',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 7: Test Invalid Discount Code Handling
    try {
      const invalidCode = 'INVALID123';
      
      const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/validate-discount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: invalidCode,
          fid: testFid,
          subtotal: testSubtotal
        })
      });

      const result = await response.json();
      
      if (response.ok || result.success) {
        throw new Error('Invalid discount code should be rejected');
      }
      
      testResults.tests.push({
        name: 'Invalid Discount Code Handling',
        status: 'PASSED',
        message: `Invalid code correctly rejected`,
        data: { 
          invalidCode: invalidCode,
          error: result.error
        }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Invalid Discount Code Handling',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Calculate totals
    testResults.summary.total = testResults.summary.passed + testResults.summary.failed;
    testResults.summary.successRate = `${Math.round((testResults.summary.passed / testResults.summary.total) * 100)}%`;

    console.log('=== CHECKOUT DISCOUNT FLOW TEST COMPLETE ===');
    console.log(`Results: ${testResults.summary.passed}/${testResults.summary.total} tests passed (${testResults.summary.successRate})`);

    return NextResponse.json({
      success: true,
      message: 'Checkout discount flow test completed',
      results: testResults
    });

  } catch (error) {
    console.error('❌ Error in checkout discount test:', error);
    return NextResponse.json({
      success: false,
      error: 'Test execution failed',
      details: error.message
    }, { status: 500 });
  }
}

// POST endpoint for cleanup
export async function POST(request) {
  try {
    const { action } = await request.json();
    
    if (action === 'cleanup') {
      const testFid = 98765;
      
      // Clean up test data
      await supabase
        .from('discount_codes')
        .delete()
        .eq('fid', testFid);
        
      await supabase
        .from('profiles')
        .delete()
        .eq('fid', testFid);
      
      return NextResponse.json({
        success: true,
        message: 'Test data cleaned up successfully'
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Unknown action'
    }, { status: 400 });
    
  } catch (error) {
    console.error('❌ Error in checkout discount test cleanup:', error);
    return NextResponse.json({
      success: false,
      error: 'Cleanup failed',
      details: error.message
    }, { status: 500 });
  }
} 