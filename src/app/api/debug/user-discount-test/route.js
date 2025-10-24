import { NextResponse } from 'next/server';
import { getUserAvailableDiscounts, getBestAvailableDiscount, hasDiscountOfType } from '@/lib/discounts';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const testFid = searchParams.get('fid') || 297728; // Default test FID
    
    console.log('=== USER DISCOUNT LOOKUP TEST ===');
    console.log('Testing with FID:', testFid);

    const testResults = {
      timestamp: new Date().toISOString(),
      testFid: parseInt(testFid),
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // Test 1: Get all available discount codes
    try {
      const allDiscountsResult = await getUserAvailableDiscounts(parseInt(testFid), false);
      
      testResults.tests.push({
        name: 'Get All Available Discounts',
        status: allDiscountsResult.success ? 'PASSED' : 'FAILED',
        message: allDiscountsResult.success 
          ? `Found ${allDiscountsResult.summary.usable} usable codes` 
          : allDiscountsResult.error,
        data: {
          success: allDiscountsResult.success,
          summary: allDiscountsResult.summary,
          usableCodes: allDiscountsResult.categorized?.usable || [],
          error: allDiscountsResult.error
        }
      });

      if (allDiscountsResult.success) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
      testResults.summary.total++;

    } catch (error) {
      testResults.tests.push({
        name: 'Get All Available Discounts',
        status: 'ERROR',
        message: error.message,
        data: { error: error.message }
      });
      testResults.summary.failed++;
      testResults.summary.total++;
    }

    // Test 2: Get best available discount
    try {
      const bestDiscountResult = await getBestAvailableDiscount(parseInt(testFid), 'any'); // Debug: show all discounts
      
      testResults.tests.push({
        name: 'Get Best Available Discount',
        status: bestDiscountResult.success ? 'PASSED' : 'FAILED',
        message: bestDiscountResult.success 
          ? `Best discount: ${bestDiscountResult.discountCode?.code || 'None'}` 
          : bestDiscountResult.error,
        data: {
          success: bestDiscountResult.success,
          discountCode: bestDiscountResult.discountCode,
          alternativeCodes: bestDiscountResult.alternativeCodes,
          error: bestDiscountResult.error
        }
      });

      if (bestDiscountResult.success) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
      testResults.summary.total++;

    } catch (error) {
      testResults.tests.push({
        name: 'Get Best Available Discount',
        status: 'ERROR',
        message: error.message,
        data: { error: error.message }
      });
      testResults.summary.failed++;
      testResults.summary.total++;
    }

    // Test 3: Check for welcome discount
    try {
      const welcomeDiscountResult = await hasDiscountOfType(parseInt(testFid), 'welcome');
      
      testResults.tests.push({
        name: 'Check Welcome Discount Status',
        status: welcomeDiscountResult.success ? 'PASSED' : 'FAILED',
        message: welcomeDiscountResult.success 
          ? `Has welcome discount: ${welcomeDiscountResult.hasDiscount} (${welcomeDiscountResult.count} codes)` 
          : welcomeDiscountResult.error,
        data: {
          success: welcomeDiscountResult.success,
          hasDiscount: welcomeDiscountResult.hasDiscount,
          count: welcomeDiscountResult.count,
          codes: welcomeDiscountResult.codes,
          error: welcomeDiscountResult.error
        }
      });

      if (welcomeDiscountResult.success) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
      testResults.summary.total++;

    } catch (error) {
      testResults.tests.push({
        name: 'Check Welcome Discount Status',
        status: 'ERROR',
        message: error.message,
        data: { error: error.message }
      });
      testResults.summary.failed++;
      testResults.summary.total++;
    }

    // Test 4: User Discount API Endpoint Test
    try {
      const apiResponse = await fetch(`${request.url.split('/api/debug/user-discount-test')[0]}/api/user-discounts?fid=${testFid}&mode=best&scope=any`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const apiResult = await apiResponse.json();
      
      testResults.tests.push({
        name: 'User Discount API Endpoint',
        status: apiResponse.ok && apiResult.success ? 'PASSED' : 'FAILED',
        message: apiResponse.ok && apiResult.success 
          ? `API returned best discount: ${apiResult.discountCode?.code || 'None'}` 
          : `API error: ${apiResult.error || 'Unknown error'}`,
        data: {
          status: apiResponse.status,
          success: apiResult.success,
          mode: apiResult.mode,
          discountCode: apiResult.discountCode,
          error: apiResult.error
        }
      });

      if (apiResponse.ok && apiResult.success) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
      testResults.summary.total++;

    } catch (error) {
      testResults.tests.push({
        name: 'User Discount API Endpoint',
        status: 'ERROR',
        message: error.message,
        data: { error: error.message }
      });
      testResults.summary.failed++;
      testResults.summary.total++;
    }

    // Calculate success rate
    testResults.summary.successRate = testResults.summary.total > 0 
      ? `${Math.round((testResults.summary.passed / testResults.summary.total) * 100)}%`
      : '0%';

    return NextResponse.json({
      success: true,
      message: 'User discount lookup test completed',
      results: testResults
    });

  } catch (error) {
    console.error('❌ Error in user discount test:', error);
    return NextResponse.json({
      success: false,
      error: 'Test execution failed',
      details: error.message
    }, { status: 500 });
  }
});

// POST endpoint for testing specific scenarios
export const POST = withAdminAuth(async (request, context) => {
  try {
    const { fid, scenario, discountCode } = await request.json();

    console.log('=== USER DISCOUNT SCENARIO TEST ===');
    console.log('FID:', fid);
    console.log('Scenario:', scenario);

    if (!fid || !scenario) {
      return NextResponse.json({
        success: false,
        error: 'FID and scenario are required'
      }, { status: 400 });
    }

    const testFid = parseInt(fid);
    let testResult = {};

    switch (scenario) {
      case 'simulate_notification_click':
        // Simulate the complete flow when user clicks notification
        testResult = {
          scenario: 'notification_click',
          urlParam: `?discount=${discountCode || 'WELCOME15-012345VE8'}&from=notification`,
          expectedFlow: [
            '1. User clicks notification with discount URL',
            '2. HomePage detects URL parameters',
            '3. Stores notification context in session',
            '4. User registration completes',
            '5. loadUserDiscounts() checks both URL and database',
            '6. Priority given to URL discount over database',
            '7. Active discount stored for cart integration'
          ],
          recommendedUrl: `https://mintedmerch.vercel.app?discount=${discountCode || 'WELCOME15-012345VE8'}&from=notification`
        };
        break;

      case 'check_user_without_notification':
        // Check user who opens app without notification
        const userDiscounts = await getUserAvailableDiscounts(testFid, false);
        testResult = {
          scenario: 'direct_app_open',
          userDiscounts: userDiscounts,
          expectedFlow: [
            '1. User opens app directly (no URL parameters)',
            '2. HomePage does not detect notification params',
            '3. User registration completes',
            '4. loadUserDiscounts() checks database only',
            '5. Best available discount loaded if exists',
            '6. No URL priority, uses database priority'
          ]
        };
        break;

      case 'test_cart_integration':
        // Test how discount would integrate with cart
        const bestDiscount = await getBestAvailableDiscount(testFid, 'any'); // Debug: show all discounts
        testResult = {
          scenario: 'cart_integration',
          bestDiscount: bestDiscount,
          sessionStorageData: {
            code: bestDiscount.discountCode?.code,
            source: 'user_account',
            displayText: bestDiscount.discountCode?.displayText || 'Discount available',
            timestamp: new Date().toISOString()
          },
          expectedFlow: [
            '1. Active discount identified in HomePage',
            '2. Discount stored in sessionStorage',
            '3. Cart component reads from sessionStorage',
            '4. Auto-populates discount field',
            '5. User sees pre-filled discount in cart'
          ]
        };
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown scenario. Use: simulate_notification_click, check_user_without_notification, or test_cart_integration'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `User discount scenario test: ${scenario}`,
      test: testResult
    });

  } catch (error) {
    console.error('❌ Error in user discount scenario test:', error);
    return NextResponse.json({
      success: false,
      error: 'Scenario test failed',
      details: error.message
    }, { status: 500 });
  }
});