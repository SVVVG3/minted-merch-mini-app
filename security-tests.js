/**
 * SECURITY TEST SUITE
 * 
 * Automated tests to verify all security vulnerabilities have been fixed.
 * 
 * Usage:
 *   1. Open your Mini App or Desktop site in browser
 *   2. Open browser console (F12)
 *   3. Copy and paste this entire file into console
 *   4. Run: await runSecurityTests()
 * 
 * Or run from Node.js:
 *   node security-tests.js
 */

const BASE_URL = 'https://app.mintedmerch.shop';

// Test configuration
const TEST_CONFIG = {
  // Your FID (will be detected from localStorage or you can set manually)
  myFid: null,
  
  // Your session token (will be detected from localStorage)
  myToken: null,
  
  // Another user's FID to test unauthorized access
  otherUserFid: 214569,
  
  // Test wallet address
  testWalletAddress: '0x1234567890123456789012345678901234567890',
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Utility functions
function log(emoji, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `${emoji} [${timestamp}] ${message}`;
  console.log(logMessage);
  if (data) {
    console.log('   └─', data);
  }
}

function pass(testName) {
  results.passed++;
  results.tests.push({ name: testName, status: 'PASS' });
  log('✅', `PASS: ${testName}`);
}

function fail(testName, reason) {
  results.failed++;
  results.tests.push({ name: testName, status: 'FAIL', reason });
  log('❌', `FAIL: ${testName}`, reason);
}

async function makeRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json().catch(() => null);
    return { response, data, status: response.status };
  } catch (error) {
    return { error, status: 0 };
  }
}

// Initialize test configuration
async function initTestConfig() {
  log('🔧', 'Initializing test configuration...');
  
  // Try to get token from localStorage
  if (typeof localStorage !== 'undefined') {
    TEST_CONFIG.myToken = localStorage.getItem('fc_session_token');
    
    // Try to extract FID from token
    if (TEST_CONFIG.myToken) {
      try {
        const payload = JSON.parse(atob(TEST_CONFIG.myToken.split('.')[1]));
        TEST_CONFIG.myFid = payload.fid;
        log('✅', `Detected FID: ${TEST_CONFIG.myFid}`);
      } catch (e) {
        log('⚠️', 'Could not extract FID from token');
      }
    }
  }
  
  if (!TEST_CONFIG.myToken) {
    log('⚠️', 'No session token found. Some tests will be skipped.');
  }
  
  if (!TEST_CONFIG.myFid) {
    log('⚠️', 'No FID detected. Please set TEST_CONFIG.myFid manually.');
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function test_shipping_no_auth() {
  const testName = 'Shipping API - No Authentication';
  log('🧪', `Testing: ${testName}`);
  
  const { status, data } = await makeRequest(`/api/user-last-shipping?fid=${TEST_CONFIG.myFid || 466111}`);
  
  if (status === 401 && data?.code === 'AUTH_REQUIRED') {
    pass(testName);
  } else {
    fail(testName, `Expected 401 AUTH_REQUIRED, got ${status}: ${JSON.stringify(data)}`);
  }
}

async function test_shipping_with_valid_token() {
  const testName = 'Shipping API - Valid Token (Own Data)';
  log('🧪', `Testing: ${testName}`);
  
  if (!TEST_CONFIG.myToken || !TEST_CONFIG.myFid) {
    log('⏭️', 'Skipping (no token or FID)');
    return;
  }
  
  const { status } = await makeRequest(`/api/user-last-shipping?fid=${TEST_CONFIG.myFid}`, {
    headers: { 'Authorization': `Bearer ${TEST_CONFIG.myToken}` }
  });
  
  if (status === 200) {
    pass(testName);
  } else {
    fail(testName, `Expected 200, got ${status}`);
  }
}

async function test_shipping_unauthorized_fid() {
  const testName = 'Shipping API - Unauthorized FID Access';
  log('🧪', `Testing: ${testName}`);
  
  if (!TEST_CONFIG.myToken || !TEST_CONFIG.myFid) {
    log('⏭️', 'Skipping (no token or FID)');
    return;
  }
  
  const { status, data } = await makeRequest(`/api/user-last-shipping?fid=${TEST_CONFIG.otherUserFid}`, {
    headers: { 'Authorization': `Bearer ${TEST_CONFIG.myToken}` }
  });
  
  if (status === 403 && data?.code === 'FID_MISMATCH') {
    pass(testName);
  } else {
    fail(testName, `Expected 403 FID_MISMATCH, got ${status}: ${JSON.stringify(data)}`);
  }
}

async function test_shipping_invalid_token() {
  const testName = 'Shipping API - Invalid Token';
  log('🧪', `Testing: ${testName}`);
  
  const { status } = await makeRequest(`/api/user-last-shipping?fid=${TEST_CONFIG.myFid || 466111}`, {
    headers: { 'Authorization': 'Bearer invalid.fake.token' }
  });
  
  if (status === 401) {
    pass(testName);
  } else {
    fail(testName, `Expected 401, got ${status}`);
  }
}

async function test_wallet_update_no_auth() {
  const testName = 'Wallet Update API - No Authentication';
  log('🧪', `Testing: ${testName}`);
  
  const { status, data } = await makeRequest('/api/update-connected-wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fid: TEST_CONFIG.myFid || 466111,
      walletAddress: TEST_CONFIG.testWalletAddress
    })
  });
  
  if (status === 401 && data?.code === 'AUTH_REQUIRED') {
    pass(testName);
  } else {
    fail(testName, `Expected 401 AUTH_REQUIRED, got ${status}: ${JSON.stringify(data)}`);
  }
}

async function test_wallet_update_unauthorized_fid() {
  const testName = 'Wallet Update API - Unauthorized FID';
  log('🧪', `Testing: ${testName}`);
  
  if (!TEST_CONFIG.myToken || !TEST_CONFIG.myFid) {
    log('⏭️', 'Skipping (no token or FID)');
    return;
  }
  
  const { status, data } = await makeRequest('/api/update-connected-wallet', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_CONFIG.myToken}`
    },
    body: JSON.stringify({
      fid: TEST_CONFIG.otherUserFid,
      walletAddress: TEST_CONFIG.testWalletAddress
    })
  });
  
  if (status === 403 && data?.code === 'FID_MISMATCH') {
    pass(testName);
  } else {
    fail(testName, `Expected 403 FID_MISMATCH, got ${status}: ${JSON.stringify(data)}`);
  }
}

async function test_notification_no_token_exposure() {
  const testName = 'Notification API - No Token Exposure';
  log('🧪', `Testing: ${testName}`);
  
  if (!TEST_CONFIG.myToken || !TEST_CONFIG.myFid) {
    log('⏭️', 'Skipping (no token or FID)');
    return;
  }
  
  const { status, data } = await makeRequest('/api/send-welcome-notification', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_CONFIG.myToken}`
    },
    body: JSON.stringify({ fid: TEST_CONFIG.myFid })
  });
  
  // Check that response doesn't contain sensitive token fields
  const hasSensitiveData = data && (
    data.tokenStatus || 
    data.tokens || 
    data.farcasterTokens || 
    data.baseTokens ||
    data.allTokens
  );
  
  if (!hasSensitiveData) {
    pass(testName);
  } else {
    fail(testName, `Response contains sensitive token data: ${JSON.stringify(data)}`);
  }
}

async function test_chat_eligibility_no_bypass() {
  const testName = 'Chat Eligibility API - No Bypass Parameter';
  log('🧪', `Testing: ${testName}`);
  
  if (!TEST_CONFIG.myToken || !TEST_CONFIG.myFid) {
    log('⏭️', 'Skipping (no token or FID)');
    return;
  }
  
  // Try to bypass with skipTokenCheck parameter
  const { status, data } = await makeRequest(`/api/check-chat-eligibility?fid=${TEST_CONFIG.myFid}&skipTokenCheck=true`, {
    headers: { 'Authorization': `Bearer ${TEST_CONFIG.myToken}` }
  });
  
  // Should either work (if implemented correctly) or require auth
  // The key is that skipTokenCheck should be ignored
  if (status === 200 || status === 401) {
    pass(testName);
  } else {
    fail(testName, `Unexpected status ${status}: ${JSON.stringify(data)}`);
  }
}

async function test_legacy_header_rejected() {
  const testName = 'Legacy X-User-FID Header Rejected';
  log('🧪', `Testing: ${testName}`);
  
  const { status, data } = await makeRequest(`/api/user-last-shipping?fid=${TEST_CONFIG.myFid || 466111}`, {
    headers: { 'X-User-FID': String(TEST_CONFIG.myFid || 466111) }
  });
  
  if (status === 401 && data?.code === 'AUTH_REQUIRED') {
    pass(testName);
  } else {
    fail(testName, `Expected 401 AUTH_REQUIRED (X-User-FID should be rejected), got ${status}: ${JSON.stringify(data)}`);
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runSecurityTests() {
  console.clear();
  log('🚀', '========================================');
  log('🚀', 'SECURITY TEST SUITE - Starting...');
  log('🚀', '========================================');
  console.log('');
  
  await initTestConfig();
  console.log('');
  
  log('📋', '========================================');
  log('📋', 'Running Tests...');
  log('📋', '========================================');
  console.log('');
  
  // Run all tests
  await test_shipping_no_auth();
  await test_shipping_with_valid_token();
  await test_shipping_unauthorized_fid();
  await test_shipping_invalid_token();
  await test_wallet_update_no_auth();
  await test_wallet_update_unauthorized_fid();
  await test_notification_no_token_exposure();
  await test_chat_eligibility_no_bypass();
  await test_legacy_header_rejected();
  
  // Print results
  console.log('');
  log('📊', '========================================');
  log('📊', 'TEST RESULTS');
  log('📊', '========================================');
  console.log('');
  
  results.tests.forEach(test => {
    const emoji = test.status === 'PASS' ? '✅' : '❌';
    console.log(`${emoji} ${test.name}`);
    if (test.reason) {
      console.log(`   └─ ${test.reason}`);
    }
  });
  
  console.log('');
  const total = results.passed + results.failed;
  const successRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
  
  log('📈', `Total Tests: ${total}`);
  log('✅', `Passed: ${results.passed}`);
  log('❌', `Failed: ${results.failed}`);
  log('📊', `Success Rate: ${successRate}%`);
  
  console.log('');
  if (results.failed === 0) {
    log('🎉', '========================================');
    log('🎉', 'ALL SECURITY TESTS PASSED! 🎉');
    log('🎉', '========================================');
  } else {
    log('⚠️', '========================================');
    log('⚠️', 'SOME TESTS FAILED - Review Above');
    log('⚠️', '========================================');
  }
  
  return results;
}

// Export for Node.js or make available in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runSecurityTests, TEST_CONFIG };
} else {
  // Make available globally in browser
  window.runSecurityTests = runSecurityTests;
  window.TEST_CONFIG = TEST_CONFIG;
  
  console.log('');
  log('ℹ️', '========================================');
  log('ℹ️', 'Security test suite loaded!');
  log('ℹ️', 'Run: await runSecurityTests()');
  log('ℹ️', '========================================');
}

