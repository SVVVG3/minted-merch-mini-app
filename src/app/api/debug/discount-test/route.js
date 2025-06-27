import { NextResponse } from 'next/server';
import { 
  createWelcomeDiscountCode, 
  validateDiscountCode, 
  calculateDiscountAmount,
  markDiscountCodeAsUsed,
  getUserDiscountCodes,
  hasUnusedWelcomeDiscount
} from '@/lib/discounts';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('=== DISCOUNT SYSTEM TEST ===');
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // Test FID for testing
    const testFid = 12345;
    const testOrderId = `TEST-${Date.now()}`;

    // Test 1: Database Connection
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      
      testResults.tests.push({
        name: 'Database Connection',
        status: 'PASSED',
        message: 'Successfully connected to Supabase'
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Database Connection',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 2: Discount Codes Table Schema
    try {
      const { data: schema, error } = await supabase
        .from('discount_codes')
        .select('*')
        .limit(0);
      
      if (error) throw error;
      
      testResults.tests.push({
        name: 'Discount Codes Table Schema',
        status: 'PASSED',
        message: 'discount_codes table exists and is accessible'
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Discount Codes Table Schema',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 3: Create Test Profile (if needed)
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
            username: 'discount-test-user',
            display_name: 'Discount Test User'
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

    // Test 4: Create Welcome Discount Code
    let testDiscountCode = null;
    try {
      const result = await createWelcomeDiscountCode(testFid);
      
      if (!result.success) throw new Error(result.error);
      
      testDiscountCode = result.code;
      testResults.tests.push({
        name: 'Create Welcome Discount Code',
        status: 'PASSED',
        message: `Created discount code: ${result.code}`,
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

    // Test 5: Validate Discount Code
    try {
      if (!testDiscountCode) throw new Error('No discount code to validate');
      
      const result = await validateDiscountCode(testDiscountCode, testFid);
      
      if (!result.success || !result.isValid) {
        throw new Error(result.error || 'Code validation failed');
      }
      
      testResults.tests.push({
        name: 'Validate Discount Code',
        status: 'PASSED',
        message: `Code ${testDiscountCode} is valid`,
        data: { 
          discountType: result.discountType, 
          discountValue: result.discountValue 
        }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Validate Discount Code',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 6: Calculate Discount Amount
    try {
      const subtotal = 100.00;
      const validationResult = await validateDiscountCode(testDiscountCode, testFid);
      const calculation = calculateDiscountAmount(subtotal, validationResult);
      
      if (calculation.error) throw new Error(calculation.error);
      
      const expectedDiscount = 15.00; // 15% of $100
      if (Math.abs(calculation.discountAmount - expectedDiscount) > 0.01) {
        throw new Error(`Expected discount $${expectedDiscount}, got $${calculation.discountAmount}`);
      }
      
      testResults.tests.push({
        name: 'Calculate Discount Amount',
        status: 'PASSED',
        message: `15% discount on $${subtotal} = $${calculation.discountAmount}`,
        data: calculation
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Calculate Discount Amount',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 7: Get User Discount Codes
    try {
      const result = await getUserDiscountCodes(testFid, false);
      
      if (!result.success) throw new Error(result.error);
      
      testResults.tests.push({
        name: 'Get User Discount Codes',
        status: 'PASSED',
        message: `Found ${result.discountCodes.length} unused discount codes`,
        data: { count: result.discountCodes.length }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Get User Discount Codes',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 8: Check Unused Welcome Discount
    try {
      const result = await hasUnusedWelcomeDiscount(testFid);
      
      if (!result.success) throw new Error(result.error);
      
      testResults.tests.push({
        name: 'Check Unused Welcome Discount',
        status: 'PASSED',
        message: `User has ${result.count} unused welcome discount(s)`,
        data: { hasUnusedWelcome: result.hasUnusedWelcome, count: result.count }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Check Unused Welcome Discount',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 9: Mark Discount Code as Used
    try {
      if (!testDiscountCode) throw new Error('No discount code to mark as used');
      
      const result = await markDiscountCodeAsUsed(testDiscountCode, testOrderId);
      
      if (!result.success) throw new Error(result.error);
      
      testResults.tests.push({
        name: 'Mark Discount Code as Used',
        status: 'PASSED',
        message: `Marked code ${testDiscountCode} as used for order ${testOrderId}`,
        data: { orderId: testOrderId }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Mark Discount Code as Used',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 10: Validate Used Code (Should Fail)
    try {
      if (!testDiscountCode) throw new Error('No discount code to test');
      
      const result = await validateDiscountCode(testDiscountCode, testFid);
      
      if (result.success && result.isValid) {
        throw new Error('Used code should not be valid');
      }
      
      testResults.tests.push({
        name: 'Validate Used Code (Should Fail)',
        status: 'PASSED',
        message: `Used code correctly rejected: ${result.error}`,
        data: { error: result.error }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Validate Used Code (Should Fail)',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Calculate totals
    testResults.summary.total = testResults.summary.passed + testResults.summary.failed;
    testResults.summary.successRate = `${Math.round((testResults.summary.passed / testResults.summary.total) * 100)}%`;

    console.log('=== DISCOUNT SYSTEM TEST COMPLETE ===');
    console.log(`Results: ${testResults.summary.passed}/${testResults.summary.total} tests passed (${testResults.summary.successRate})`);

    return NextResponse.json({
      success: true,
      message: 'Discount system test completed',
      results: testResults
    });

  } catch (error) {
    console.error('❌ Error in discount system test:', error);
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
      const testFid = 12345;
      
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
    console.error('❌ Error in discount test cleanup:', error);
    return NextResponse.json({
      success: false,
      error: 'Cleanup failed',
      details: error.message
    }, { status: 500 });
  }
} 