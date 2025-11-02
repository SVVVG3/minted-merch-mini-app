#!/usr/bin/env node
/**
 * Node.js runner for security tests
 * Usage: node run-security-tests.js
 */

const { runSecurityTests, TEST_CONFIG } = require('./security-tests.js');

// Polyfill fetch for Node.js if not available
if (typeof fetch === 'undefined') {
  global.fetch = async (url, options = {}) => {
    const https = require('https');
    const urlObj = new URL(url);
    
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            json: async () => JSON.parse(data),
            text: async () => data,
          });
        });
      });
      
      req.on('error', reject);
      
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  };
}

// Mock localStorage for Node.js (tests will skip token-based tests)
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

// Run the tests
console.log('🚀 Starting security tests...\n');

runSecurityTests()
  .then(results => {
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  });

