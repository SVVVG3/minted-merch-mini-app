import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { 
  checkBankrClubMembership, 
  lookupUserByXUsername, 
  checkCombinedBankrMembership,
  testBankrAPI,
  getRateLimitStatus
} from '@/lib/bankrAPI';

export async function GET() {
  return NextResponse.json({
    endpoint: 'Bankr API Test',
    description: 'Test Bankr Club membership checking and API integration',
    usage: {
      'GET': 'Show this help message',
      'POST': 'Run API tests with optional test parameters'
    },
    availableActions: [
      'test_api_connection',
      'test_farcaster_lookup',
      'test_x_lookup',
      'test_combined_lookup',
      'test_rate_limiting',
      'check_rate_status'
    ],
    example_request: {
      action: 'test_farcaster_lookup',
      farcaster_username: 'vitalik.eth',
      x_username: 'VitalikButerin'
    },
    timestamp: new Date().toISOString()
  });
}

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { action, farcaster_username, x_username, test_invalid = false } = await request.json();
    
    console.log('🔧 Bankr API Test - Action:', action);
    
    const results = {
      timestamp: new Date().toISOString(),
      action: action,
      success: false,
      data: null,
      error: null
    };

    switch (action) {
      case 'check_rate_status':
        results.data = {
          rateLimitStatus: getRateLimitStatus(),
          description: 'Current rate limiting status for this session'
        };
        results.success = true;
        break;

      case 'test_api_connection':
        console.log('🧪 Testing basic API connection...');
        results.data = await testBankrAPI({
          testFarcasterUsername: farcaster_username || 'vitalik.eth',
          testXUsername: x_username || 'VitalikButerin'
        });
        results.success = true;
        break;

      case 'test_farcaster_lookup':
        if (!farcaster_username) {
          results.error = 'farcaster_username is required for this test';
          break;
        }
        
        console.log(`🎯 Testing Farcaster lookup: ${farcaster_username}`);
        results.data = await checkBankrClubMembership(farcaster_username);
        results.success = true;
        break;

      case 'test_x_lookup':
        if (!x_username) {
          results.error = 'x_username is required for this test';
          break;
        }
        
        console.log(`🐦 Testing X lookup: ${x_username}`);
        results.data = await lookupUserByXUsername(x_username);
        results.success = true;
        break;

      case 'test_combined_lookup':
        if (!farcaster_username && !x_username) {
          results.error = 'At least one of farcaster_username or x_username is required';
          break;
        }
        
        console.log(`🔍 Testing combined lookup: FC=${farcaster_username || 'none'}, X=${x_username || 'none'}`);
        results.data = await checkCombinedBankrMembership(farcaster_username, x_username);
        results.success = true;
        break;

      case 'test_rate_limiting':
        console.log('⏱️  Testing rate limiting behavior...');
        const rateLimitTests = [];
        
        // Make multiple requests quickly to test rate limiting
        for (let i = 0; i < 5; i++) {
          try {
            const testResult = await checkBankrClubMembership('test-user-' + i);
            rateLimitTests.push({
              request: i + 1,
              success: testResult.success,
              found: testResult.found,
              rateLimitStatus: getRateLimitStatus()
            });
          } catch (error) {
            rateLimitTests.push({
              request: i + 1,
              success: false,
              error: error.message,
              rateLimitStatus: getRateLimitStatus()
            });
          }
        }
        
        results.data = {
          rateLimitTests,
          finalRateLimitStatus: getRateLimitStatus()
        };
        results.success = true;
        break;

      case 'test_comprehensive':
        console.log('🚀 Running comprehensive Bankr API test suite...');
        
        const comprehensiveTests = {
          rateLimitStatus: getRateLimitStatus(),
          tests: {}
        };

        // Test 1: Valid Farcaster username
        if (farcaster_username) {
          console.log('🧪 Test 1: Valid Farcaster username');
          comprehensiveTests.tests.farcaster = await checkBankrClubMembership(farcaster_username);
        }

        // Test 2: Valid X username
        if (x_username) {
          console.log('🧪 Test 2: Valid X username');
          comprehensiveTests.tests.x = await lookupUserByXUsername(x_username);
        }

        // Test 3: Combined lookup
        if (farcaster_username || x_username) {
          console.log('🧪 Test 3: Combined lookup');
          comprehensiveTests.tests.combined = await checkCombinedBankrMembership(farcaster_username, x_username);
        }

        // Test 4: Invalid username
        console.log('🧪 Test 4: Invalid username');
        comprehensiveTests.tests.invalid = await checkBankrClubMembership('this-should-not-exist-12345');

        // Test 5: Edge cases
        console.log('🧪 Test 5: Edge cases');
        comprehensiveTests.tests.edgeCases = {
          emptyUsername: await checkBankrClubMembership('').catch(e => ({ success: false, error: e.message })),
          nullUsername: await checkBankrClubMembership(null).catch(e => ({ success: false, error: e.message })),
          specialCharacters: await checkBankrClubMembership('user@#$%').catch(e => ({ success: false, error: e.message }))
        };

        comprehensiveTests.finalRateLimitStatus = getRateLimitStatus();
        results.data = comprehensiveTests;
        results.success = true;
        break;

      default:
        results.error = `Unknown action: ${action}. Available actions: check_rate_status, test_api_connection, test_farcaster_lookup, test_x_lookup, test_combined_lookup, test_rate_limiting, test_comprehensive`;
        break;
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('Bankr API test error:', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

// Helper function to run a quick test
export async function runQuickTest() {
  console.log('🏃‍♂️ Running quick Bankr API test...');
  
  try {
    const testResult = await testBankrAPI({
      testFarcasterUsername: 'vitalik.eth'
    });
    
    console.log('✅ Quick test completed:', testResult.success);
    return testResult;
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return { success: false, error: error.message };
  }
} 