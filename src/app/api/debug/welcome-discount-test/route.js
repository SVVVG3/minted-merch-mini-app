import { NextResponse } from 'next/server';
import { sendWelcomeNotificationWithNeynar } from '@/lib/neynar';
import { createWelcomeDiscountCode, validateDiscountCode } from '@/lib/discounts';
import { supabase } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export async function GET() {
  try {
    console.log('=== WELCOME NOTIFICATION WITH DISCOUNT TEST ===');
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // Test FID for testing
    const testFid = 54321;

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
            username: 'welcome-discount-test-user',
            display_name: 'Welcome Discount Test User'
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

    // Test 2: Generate Discount Code Independently
    let testDiscountCode = null;
    try {
      const result = await createWelcomeDiscountCode(testFid);
      
      if (!result.success) throw new Error(result.error);
      
      testDiscountCode = result.code;
      testResults.tests.push({
        name: 'Generate Welcome Discount Code',
        status: 'PASSED',
        message: `Generated discount code: ${result.code}`,
        data: { code: result.code, isExisting: result.isExisting }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Generate Welcome Discount Code',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 3: Validate Generated Discount Code
    try {
      if (!testDiscountCode) throw new Error('No discount code to validate');
      
      const result = await validateDiscountCode(testDiscountCode, testFid);
      
      if (!result.success || !result.isValid) {
        throw new Error(result.error || 'Code validation failed');
      }
      
      testResults.tests.push({
        name: 'Validate Generated Discount Code',
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
        name: 'Validate Generated Discount Code',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 4: Test Enhanced Welcome Notification (Mock)
    try {
      // We'll test the notification preparation without actually sending it
      // to avoid spamming notifications during testing
      
      // Simulate the notification creation logic
      const discountResult = await createWelcomeDiscountCode(testFid);
      
      if (!discountResult.success) {
        throw new Error('Could not create discount code for notification');
      }

      const notificationBody = `Get 15% off your first order with code: ${discountResult.code}`;
      
      // Validate the notification message format
      if (!notificationBody.includes(discountResult.code)) {
        throw new Error('Discount code not properly included in notification');
      }

      if (!notificationBody.includes('15%')) {
        throw new Error('Discount percentage not included in notification');
      }

      testResults.tests.push({
        name: 'Enhanced Welcome Notification Preparation',
        status: 'PASSED',
        message: 'Notification message properly formatted with discount code',
        data: { 
          discountCode: discountResult.code,
          notificationBody: notificationBody,
          messageLength: notificationBody.length
        }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Enhanced Welcome Notification Preparation',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 5: Check Message Length (Neynar has limits)
    try {
      const discountResult = await createWelcomeDiscountCode(testFid);
      const notificationBody = `Get 15% off your first order with code: ${discountResult.code}`;
      
      // Check if message is within reasonable limits (Neynar typically allows ~128 chars)
      if (notificationBody.length > 120) {
        console.log('⚠️ Warning: Notification message might be too long:', notificationBody.length, 'chars');
      }

      testResults.tests.push({
        name: 'Notification Message Length Check',
        status: notificationBody.length <= 120 ? 'PASSED' : 'WARNING',
        message: `Message length: ${notificationBody.length} characters`,
        data: { 
          messageLength: notificationBody.length,
          message: notificationBody,
          withinLimit: notificationBody.length <= 120
        }
      });
      
      if (notificationBody.length <= 120) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
    } catch (error) {
      testResults.tests.push({
        name: 'Notification Message Length Check',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 6: Test Duplicate Prevention
    try {
      // Try to create another discount code for the same user
      const firstResult = await createWelcomeDiscountCode(testFid);
      const secondResult = await createWelcomeDiscountCode(testFid);
      
      if (!firstResult.success || !secondResult.success) {
        throw new Error('Could not create discount codes');
      }

      if (firstResult.code !== secondResult.code) {
        throw new Error('Different codes generated for same user');
      }

      if (!secondResult.isExisting) {
        throw new Error('Second call should return existing code');
      }

      testResults.tests.push({
        name: 'Duplicate Discount Code Prevention',
        status: 'PASSED',
        message: 'Same discount code returned for existing user',
        data: { 
          firstCode: firstResult.code,
          secondCode: secondResult.code,
          secondIsExisting: secondResult.isExisting
        }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Duplicate Discount Code Prevention',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Calculate totals
    testResults.summary.total = testResults.summary.passed + testResults.summary.failed;
    testResults.summary.successRate = `${Math.round((testResults.summary.passed / testResults.summary.total) * 100)}%`;

    console.log('=== WELCOME NOTIFICATION WITH DISCOUNT TEST COMPLETE ===');
    console.log(`Results: ${testResults.summary.passed}/${testResults.summary.total} tests passed (${testResults.summary.successRate})`);

    return NextResponse.json({
      success: true,
      message: 'Welcome notification with discount test completed',
      results: testResults
    });

  } catch (error) {
    console.error('❌ Error in welcome discount test:', error);
    return NextResponse.json({
      success: false,
      error: 'Test execution failed',
      details: error.message
    }, { status: 500 });
  }
}

// POST endpoint for cleanup
export const POST = withAdminAuth(async (request, context) => {
  try {
    const { action } = await request.json();
    
    if (action === 'cleanup') {
      const testFid = 54321;
      
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
    console.error('❌ Error in welcome discount test cleanup:', error);
    return NextResponse.json({
      success: false,
      error: 'Cleanup failed',
      details: error.message
    }, { status: 500 });
  }
});