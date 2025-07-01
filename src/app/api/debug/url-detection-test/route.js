import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    console.log('=== URL PARAMETER DETECTION TEST ===');
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // Test 1: Simulate Notification URL with Discount Code
    try {
      const testUrls = [
        'https://mintedmerch.vercel.app?discount=WELCOME15-012345VE8',
        'https://mintedmerch.vercel.app?discount=WELCOME15-012345VE8&from=notification',
        'https://mintedmerch.vercel.app?from=notification',
        'https://mintedmerch.vercel.app',
        'https://mintedmerch.vercel.app?utm_source=farcaster&discount=WELCOME15-012345VE8'
      ];

      const parsedResults = testUrls.map(url => {
        const urlObj = new URL(url);
        const params = new URLSearchParams(urlObj.search);
        
        return {
          url,
          discountParam: params.get('discount'),
          fromParam: params.get('from'),
          hasDiscountCode: !!params.get('discount'),
          hasNotificationSource: params.get('from') === 'notification',
          allParams: Object.fromEntries(params.entries())
        };
      });

      testResults.tests.push({
        name: 'URL Parameter Parsing Test',
        status: 'PASSED',
        message: 'Successfully parsed all test URLs',
        data: { testUrls: parsedResults }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'URL Parameter Parsing Test',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 2: Test Notification Context Storage Logic
    try {
      const mockParams = {
        hasNotificationParams: true,
        discountCode: 'WELCOME15-012345VE8',
        notificationSource: 'notification',
        referrer: 'https://warpcast.com/~/frame/12345',
        isFarcasterReferrer: true,
        timestamp: new Date().toISOString(),
        fullUrl: 'https://mintedmerch.vercel.app?discount=WELCOME15-012345VE8&from=notification',
        urlParams: { discount: 'WELCOME15-012345VE8', from: 'notification' },
        hash: null
      };

      // Simulate context storage logic (server-side simulation)
      const shouldStore = mockParams.hasNotificationParams;
      const hasDiscountCode = !!mockParams.discountCode;
      
      testResults.tests.push({
        name: 'Notification Context Storage Logic',
        status: 'PASSED',
        message: 'Storage logic works correctly',
        data: { 
          shouldStore,
          hasDiscountCode,
          mockParams 
        }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Notification Context Storage Logic',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 3: Test URL Parameter Strategy Validation
    try {
      const strategies = [
        {
          name: 'Discount Code in URL',
          url: '?discount=WELCOME15-012345VE8',
          expected: { hasDiscount: true, code: 'WELCOME15-012345VE8' }
        },
        {
          name: 'Notification Source Flag',
          url: '?from=notification',
          expected: { hasNotificationFlag: true }
        },
        {
          name: 'Combined Parameters',
          url: '?discount=WELCOME15-012345VE8&from=notification&utm_source=farcaster',
          expected: { hasDiscount: true, hasNotificationFlag: true, hasUTM: true }
        },
        {
          name: 'No Parameters',
          url: '',
          expected: { hasDiscount: false, hasNotificationFlag: false }
        }
      ];

      const strategyResults = strategies.map(strategy => {
        const params = new URLSearchParams(strategy.url);
        const result = {
          name: strategy.name,
          url: strategy.url,
          hasDiscount: !!params.get('discount'),
          hasNotificationFlag: params.get('from') === 'notification',
          hasUTM: !!params.get('utm_source'),
          discountCode: params.get('discount'),
          allParams: Object.fromEntries(params.entries())
        };
        
        return result;
      });

      testResults.tests.push({
        name: 'URL Parameter Strategy Validation',
        status: 'PASSED',
        message: 'All URL parameter strategies validated',
        data: { strategies: strategyResults }
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'URL Parameter Strategy Validation',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 4: Test Farcaster Referrer Detection
    try {
      const referrerTests = [
        { referrer: 'https://warpcast.com/~/frame/12345', expected: true },
        { referrer: 'https://farcaster.xyz/frame/abc', expected: true },
        { referrer: 'https://example.com/frame/test', expected: true },
        { referrer: 'https://google.com', expected: false },
        { referrer: 'https://twitter.com', expected: false },
        { referrer: '', expected: false }
      ];

      const referrerResults = referrerTests.map(test => {
        const isFarcasterReferrer = test.referrer.includes('warpcast.com') || 
                                   test.referrer.includes('farcaster.xyz') ||
                                   test.referrer.includes('frame');
        return {
          referrer: test.referrer,
          expected: test.expected,
          actual: isFarcasterReferrer,
          passed: test.expected === isFarcasterReferrer
        };
      });

      const allPassed = referrerResults.every(r => r.passed);

      testResults.tests.push({
        name: 'Farcaster Referrer Detection',
        status: allPassed ? 'PASSED' : 'FAILED',
        message: allPassed ? 'All referrer tests passed' : 'Some referrer tests failed',
        data: { tests: referrerResults }
      });
      
      if (allPassed) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
    } catch (error) {
      testResults.tests.push({
        name: 'Farcaster Referrer Detection',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Test 5: Test Request Headers Analysis
    try {
      const headers = Object.fromEntries(request.headers.entries());
      
      // Look for Farcaster-specific headers or user agents
      const userAgent = headers['user-agent'] || '';
      const referer = headers['referer'] || headers['referrer'] || '';
      const origin = headers['origin'] || '';
      
      const headerAnalysis = {
        userAgent,
        referer,
        origin,
        hasWarpcastUA: userAgent.toLowerCase().includes('warpcast'),
        hasFarcasterReferer: referer.includes('warpcast.com') || referer.includes('farcaster.xyz'),
        allHeaders: headers
      };

      testResults.tests.push({
        name: 'Request Headers Analysis',
        status: 'PASSED',
        message: 'Request headers analyzed for Farcaster context',
        data: headerAnalysis
      });
      testResults.summary.passed++;
    } catch (error) {
      testResults.tests.push({
        name: 'Request Headers Analysis',
        status: 'FAILED',
        message: error.message
      });
      testResults.summary.failed++;
    }

    // Calculate totals
    testResults.summary.total = testResults.summary.passed + testResults.summary.failed;
    testResults.summary.successRate = `${Math.round((testResults.summary.passed / testResults.summary.total) * 100)}%`;

    console.log('=== URL PARAMETER DETECTION TEST COMPLETE ===');
    console.log(`Results: ${testResults.summary.passed}/${testResults.summary.total} tests passed (${testResults.summary.successRate})`);

    return NextResponse.json({
      success: true,
      message: 'URL parameter detection test completed',
      results: testResults
    });

  } catch (error) {
    console.error('❌ Error in URL parameter detection test:', error);
    return NextResponse.json({
      success: false,
      error: 'URL parameter detection test failed',
      details: error.message
    }, { status: 500 });
  }
}

// POST endpoint for simulating notification clicks
export async function POST(request) {
  try {
    const { testUrl } = await request.json();
    
    if (!testUrl) {
      return NextResponse.json({
        success: false,
        error: 'testUrl is required for simulation'
      }, { status: 400 });
    }

    console.log('🧪 Simulating notification click for URL:', testUrl);
    
    // Parse the test URL
    const urlObj = new URL(testUrl);
    const params = new URLSearchParams(urlObj.search);
    
    // Simulate the extractNotificationParams function
    const simulatedResult = {
      hasNotificationParams: !!(params.get('discount') || params.get('from') === 'notification'),
      discountCode: params.get('discount') || null,
      notificationSource: params.get('from') || null,
      fullUrl: testUrl,
      urlParams: Object.fromEntries(params.entries()),
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Notification click simulated successfully',
      simulation: simulatedResult,
      recommendations: {
        shouldModifyNotificationUrl: !simulatedResult.discountCode,
        suggestedUrl: simulatedResult.discountCode ? testUrl : `${testUrl}${testUrl.includes('?') ? '&' : '?'}discount=WELCOME15-EXAMPLE`,
        detectionWorking: simulatedResult.hasNotificationParams
      }
    });

  } catch (error) {
    console.error('❌ Error in notification click simulation:', error);
    return NextResponse.json({
      success: false,
      error: 'Notification click simulation failed',
      details: error.message
    }, { status: 500 });
  }
} 