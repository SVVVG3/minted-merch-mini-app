import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateDiscountCode, markDiscountCodeAsUsed } from '@/lib/discounts';

export async function GET() {
  const testResults = {
    timestamp: new Date().toISOString(),
    summary: { passed: 0, failed: 0, total: 0 },
    tests: []
  };

  let testSharedCode = null;
  let testUserSpecificCode = null;
  const testFid1 = 466111; // First test user
  const testFid2 = 466112; // Second test user
  const testOrderId1 = 'TEST_ORDER_SHARED_1';
  const testOrderId2 = 'TEST_ORDER_SHARED_2';

  console.log('=== SHARED DISCOUNT CODE SYSTEM TEST ===');

  // Test 1: Create a shared discount code
  try {
    const { data: sharedCode, error } = await supabase
      .from('discount_codes')
      .insert({
        code: 'PROMO50SHARED',
        discount_type: 'percentage',
        discount_value: 50,
        code_type: 'promotional',
        is_shared_code: true, // Mark as shared
        fid: null, // No owner for shared codes
        max_uses_total: 5, // Total usage limit
        max_uses_per_user: 1, // Each user can use once
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        discount_description: 'Test shared 50% discount code'
      })
      .select()
      .single();

    if (error) throw error;

    testSharedCode = sharedCode.code;
    testResults.tests.push({
      name: 'Create Shared Discount Code',
      status: 'PASSED',
      message: `Created shared code: ${testSharedCode}`,
      data: { code: testSharedCode, isShared: sharedCode.is_shared_code }
    });
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.push({
      name: 'Create Shared Discount Code',
      status: 'FAILED',
      message: error.message
    });
    testResults.summary.failed++;
  }

  // Test 2: Create a user-specific discount code for comparison
  try {
    const { data: userCode, error } = await supabase
      .from('discount_codes')
      .insert({
        code: 'WELCOME15USER',
        discount_type: 'percentage',
        discount_value: 15,
        code_type: 'welcome',
        is_shared_code: false, // User-specific
        fid: testFid1, // Owned by testFid1
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    testUserSpecificCode = userCode.code;
    testResults.tests.push({
      name: 'Create User-Specific Discount Code',
      status: 'PASSED',
      message: `Created user-specific code: ${testUserSpecificCode}`,
      data: { code: testUserSpecificCode, isShared: userCode.is_shared_code }
    });
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.push({
      name: 'Create User-Specific Discount Code',
      status: 'FAILED',
      message: error.message
    });
    testResults.summary.failed++;
  }

  // Test 3: Validate shared code for first user
  try {
    if (!testSharedCode) throw new Error('No shared code to test');

    const result = await validateDiscountCode(testSharedCode, testFid1);

    if (!result.success || !result.isValid) {
      throw new Error(result.error || 'Shared code should be valid for first user');
    }

    testResults.tests.push({
      name: 'Validate Shared Code (User 1)',
      status: 'PASSED',
      message: `Shared code valid for first user`,
      data: { 
        isShared: result.isSharedCode,
        discountValue: result.discountValue
      }
    });
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.push({
      name: 'Validate Shared Code (User 1)',
      status: 'FAILED',
      message: error.message
    });
    testResults.summary.failed++;
  }

  // Test 4: Validate shared code for second user
  try {
    if (!testSharedCode) throw new Error('No shared code to test');

    const result = await validateDiscountCode(testSharedCode, testFid2);

    if (!result.success || !result.isValid) {
      throw new Error(result.error || 'Shared code should be valid for second user');
    }

    testResults.tests.push({
      name: 'Validate Shared Code (User 2)',
      status: 'PASSED',
      message: `Shared code valid for second user`,
      data: { 
        isShared: result.isSharedCode,
        discountValue: result.discountValue
      }
    });
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.push({
      name: 'Validate Shared Code (User 2)',
      status: 'FAILED',
      message: error.message
    });
    testResults.summary.failed++;
  }

  // Test 5: User 1 uses the shared code
  try {
    if (!testSharedCode) throw new Error('No shared code to test');

    const result = await markDiscountCodeAsUsed(
      testSharedCode, 
      testOrderId1, 
      testFid1, 
      25.00, // 50% of $50
      50.00  // Original subtotal
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to mark shared code as used');
    }

    testResults.tests.push({
      name: 'User 1 Uses Shared Code',
      status: 'PASSED',
      message: `User 1 successfully used shared code`,
      data: { 
        orderId: testOrderId1,
        discountAmount: 25.00,
        hasUsageRecord: !!result.usageRecord
      }
    });
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.push({
      name: 'User 1 Uses Shared Code',
      status: 'FAILED',
      message: error.message
    });
    testResults.summary.failed++;
  }

  // Test 6: User 1 tries to use the same shared code again (should fail)
  try {
    if (!testSharedCode) throw new Error('No shared code to test');

    const result = await validateDiscountCode(testSharedCode, testFid1);

    if (result.success && result.isValid) {
      throw new Error('User 1 should not be able to use the shared code again');
    }

    if (!result.error || !result.error.includes('already used')) {
      throw new Error(`Expected 'already used' error, got: ${result.error}`);
    }

    testResults.tests.push({
      name: 'User 1 Reuse Attempt (Should Fail)',
      status: 'PASSED',
      message: `User 1 correctly blocked from reusing shared code`,
      data: { error: result.error }
    });
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.push({
      name: 'User 1 Reuse Attempt (Should Fail)',
      status: 'FAILED',
      message: error.message
    });
    testResults.summary.failed++;
  }

  // Test 7: User 2 can still use the shared code
  try {
    if (!testSharedCode) throw new Error('No shared code to test');

    const validationResult = await validateDiscountCode(testSharedCode, testFid2);

    if (!validationResult.success || !validationResult.isValid) {
      throw new Error(validationResult.error || 'User 2 should still be able to use the shared code');
    }

    // User 2 uses the code
    const usageResult = await markDiscountCodeAsUsed(
      testSharedCode, 
      testOrderId2, 
      testFid2, 
      37.50, // 50% of $75
      75.00  // Original subtotal
    );

    if (!usageResult.success) {
      throw new Error(usageResult.error || 'User 2 failed to use shared code');
    }

    testResults.tests.push({
      name: 'User 2 Uses Shared Code',
      status: 'PASSED',
      message: `User 2 successfully used shared code after User 1`,
      data: { 
        orderId: testOrderId2,
        discountAmount: 37.50,
        hasUsageRecord: !!usageResult.usageRecord
      }
    });
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.push({
      name: 'User 2 Uses Shared Code',
      status: 'FAILED',
      message: error.message
    });
    testResults.summary.failed++;
  }

  // Test 8: Test user-specific code cross-user validation
  try {
    if (!testUserSpecificCode) throw new Error('No user-specific code to test');

    const result = await validateDiscountCode(testUserSpecificCode, testFid2);

    if (result.success && result.isValid) {
      throw new Error('User 2 should not be able to use User 1\'s welcome code');
    }

    if (!result.error || !result.error.includes('not valid for your account')) {
      throw new Error(`Expected 'not valid for your account' error, got: ${result.error}`);
    }

    testResults.tests.push({
      name: 'User-Specific Code Cross-User Block',
      status: 'PASSED',
      message: `User-specific code correctly blocked for wrong user`,
      data: { error: result.error }
    });
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.push({
      name: 'User-Specific Code Cross-User Block',
      status: 'FAILED',
      message: error.message
    });
    testResults.summary.failed++;
  }

  // Test 9: Check usage tracking table
  try {
    if (!testSharedCode) throw new Error('No shared code to check');

    // Get the discount code ID
    const { data: discountCodeData, error: fetchError } = await supabase
      .from('discount_codes')
      .select('id')
      .eq('code', testSharedCode)
      .single();

    if (fetchError) throw fetchError;

    // Check usage records
    const { data: usageRecords, error: usageError } = await supabase
      .from('discount_code_usage')
      .select('*')
      .eq('discount_code_id', discountCodeData.id);

    if (usageError) throw usageError;

    if (!usageRecords || usageRecords.length !== 2) {
      throw new Error(`Expected 2 usage records, found ${usageRecords ? usageRecords.length : 0}`);
    }

    const user1Record = usageRecords.find(r => r.fid === testFid1);
    const user2Record = usageRecords.find(r => r.fid === testFid2);

    if (!user1Record || !user2Record) {
      throw new Error('Missing usage records for test users');
    }

    testResults.tests.push({
      name: 'Usage Tracking Verification',
      status: 'PASSED',
      message: `Found ${usageRecords.length} usage records as expected`,
      data: { 
        totalRecords: usageRecords.length,
        user1Amount: user1Record.discount_amount,
        user2Amount: user2Record.discount_amount
      }
    });
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.push({
      name: 'Usage Tracking Verification',
      status: 'FAILED',
      message: error.message
    });
    testResults.summary.failed++;
  }

  // Cleanup: Remove test codes
  try {
    if (testSharedCode) {
      await supabase.from('discount_codes').delete().eq('code', testSharedCode);
    }
    if (testUserSpecificCode) {
      await supabase.from('discount_codes').delete().eq('code', testUserSpecificCode);
    }
    
    testResults.tests.push({
      name: 'Test Cleanup',
      status: 'PASSED',
      message: 'Test discount codes cleaned up successfully'
    });
    testResults.summary.passed++;
  } catch (error) {
    testResults.tests.push({
      name: 'Test Cleanup',
      status: 'FAILED',
      message: error.message
    });
    testResults.summary.failed++;
  }

  // Calculate totals
  testResults.summary.total = testResults.summary.passed + testResults.summary.failed;
  testResults.summary.successRate = `${Math.round((testResults.summary.passed / testResults.summary.total) * 100)}%`;

  console.log('=== SHARED DISCOUNT CODE TEST COMPLETE ===');
  console.log(`Results: ${testResults.summary.passed}/${testResults.summary.total} passed (${testResults.summary.successRate})`);

  return NextResponse.json(testResults, { status: 200 });
} 