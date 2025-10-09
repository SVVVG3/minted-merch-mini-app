// Test script to verify the chat eligibility calculation fix
// This script tests the fix for the double conversion bug

const testFid = 466111; // SVVVG3 from the admin dashboard

async function testChatEligibilityFix() {
  try {
    console.log(`🧪 Testing chat eligibility fix for FID ${testFid}...`);
    
    // Test the individual balance update endpoint
    const response = await fetch('http://localhost:3000/api/admin/update-individual-balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fid: testFid })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Test Results:');
      console.log(`   Username: ${result.username}`);
      console.log(`   Token Balance: ${result.tokenBalance.toLocaleString()} tokens`);
      console.log(`   Eligible: ${result.eligible ? 'YES' : 'NO'}`);
      console.log(`   Required: ${result.requiredBalance.toLocaleString()} tokens`);
      console.log(`   Wallet Count: ${result.walletCount}`);
      console.log(`   Duration: ${result.duration}ms`);
      
      // Check if the fix worked
      if (result.tokenBalance > 0 && result.tokenBalance >= result.requiredBalance) {
        console.log('🎉 SUCCESS: Fix appears to be working! User shows correct token balance and eligibility.');
      } else if (result.tokenBalance === 0) {
        console.log('⚠️  WARNING: User still shows 0 tokens. This could be:');
        console.log('   1. User actually has 0 tokens');
        console.log('   2. Wallet addresses not found');
        console.log('   3. Blockchain API issue');
        console.log('   4. Fix not applied yet (need to refresh admin dashboard)');
      } else {
        console.log('ℹ️  INFO: User has tokens but below threshold. This is expected behavior.');
      }
    } else {
      console.error('❌ Test failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run the test
testChatEligibilityFix();
