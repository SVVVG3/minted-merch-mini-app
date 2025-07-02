import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchUserWalletData, extractWalletDataFromNeynar } from '@/lib/walletUtils';
import { neynarClient, isNeynarAvailable } from '@/lib/neynar';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const testFid = parseInt(searchParams.get('fid')) || 466111; // Default to svvvg3.eth for testing
    const action = searchParams.get('action') || 'test_integration';

    console.log('🧪 Testing wallet integration for FID:', testFid, 'Action:', action);

    const results = {
      test_fid: testFid,
      action: action,
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Check if Neynar is available
    results.tests.neynar_available = {
      status: isNeynarAvailable(),
      message: isNeynarAvailable() ? 'Neynar client is available' : 'Neynar client not configured'
    };

    if (!isNeynarAvailable()) {
      return NextResponse.json({
        success: false,
        error: 'Neynar not available',
        results
      });
    }

    // Test 2: Fetch wallet data directly
    console.log('🔍 Test 2: Fetching wallet data...');
    const walletData = await fetchUserWalletData(testFid);
    results.tests.fetch_wallet_data = {
      status: !!walletData,
      data: walletData ? {
        custody_address: walletData.custody_address,
        eth_count: walletData.verified_eth_addresses?.length || 0,
        sol_count: walletData.verified_sol_addresses?.length || 0,
        total_addresses: walletData.all_wallet_addresses?.length || 0,
        primary_eth: walletData.primary_eth_address,
        primary_sol: walletData.primary_sol_address
      } : null,
      message: walletData ? 'Wallet data fetched successfully' : 'Failed to fetch wallet data'
    };

    // Test 3: Check existing user profile
    console.log('🔍 Test 3: Checking existing profile...');
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('fid', testFid)
      .single();

    results.tests.existing_profile = {
      status: !profileError,
      profile_exists: !!existingProfile,
      has_wallet_data: !!(existingProfile?.wallet_data_updated_at),
      wallet_address_count: existingProfile?.all_wallet_addresses?.length || 0,
      last_wallet_update: existingProfile?.wallet_data_updated_at,
      message: profileError ? `Profile not found: ${profileError.message}` : 'Profile found'
    };

    // Test 4: Test wallet data extraction from raw Neynar response
    if (walletData) {
      console.log('🔍 Test 4: Testing wallet data extraction...');
      
      // Get raw Neynar data
      const userResponse = await neynarClient.fetchBulkUsers({
        fids: [testFid]
      });

      if (userResponse.users && userResponse.users.length > 0) {
        const rawUser = userResponse.users[0];
        const extractedData = extractWalletDataFromNeynar(rawUser);

        results.tests.wallet_extraction = {
          status: !!extractedData,
          raw_user_data: {
            username: rawUser.username,
            display_name: rawUser.display_name,
            custody_address: rawUser.custody_address,
            verifications_count: rawUser.verifications?.length || 0,
            verified_eth_count: rawUser.verified_addresses?.eth_addresses?.length || 0,
            verified_sol_count: rawUser.verified_addresses?.sol_addresses?.length || 0
          },
          extracted_data: extractedData ? {
            custody_address: extractedData.custody_address,
            total_addresses: extractedData.all_wallet_addresses?.length || 0,
            primary_eth: extractedData.primary_eth_address,
            primary_sol: extractedData.primary_sol_address
          } : null,
          message: extractedData ? 'Wallet data extraction successful' : 'Wallet data extraction failed'
        };
      }
    }

    // Test 5: Conditional database update test
    if (action === 'update_db' && walletData) {
      console.log('🔍 Test 5: Testing database update...');
      
      const updateData = {
        fid: testFid,
        custody_address: walletData.custody_address,
        verified_eth_addresses: walletData.verified_eth_addresses,
        verified_sol_addresses: walletData.verified_sol_addresses,
        primary_eth_address: walletData.primary_eth_address,
        primary_sol_address: walletData.primary_sol_address,
        all_wallet_addresses: walletData.all_wallet_addresses,
        wallet_data_updated_at: walletData.wallet_data_updated_at,
        updated_at: new Date().toISOString()
      };

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .upsert(updateData, { onConflict: 'fid' })
        .select()
        .single();

      results.tests.database_update = {
        status: !updateError,
        profile: updatedProfile,
        error: updateError?.message,
        message: updateError ? `Database update failed: ${updateError.message}` : 'Database update successful'
      };
    }

    // Test Summary
    const passedTests = Object.values(results.tests).filter(test => test.status).length;
    const totalTests = Object.keys(results.tests).length;

    results.summary = {
      passed: passedTests,
      total: totalTests,
      success_rate: `${Math.round((passedTests / totalTests) * 100)}%`,
      overall_status: passedTests === totalTests ? 'ALL_TESTS_PASSED' : 'SOME_TESTS_FAILED'
    };

    console.log('🧪 Wallet integration test completed:', results.summary);

    return NextResponse.json({
      success: true,
      message: 'Wallet integration test completed',
      results
    });

  } catch (error) {
    console.error('❌ Error in wallet integration test:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

// POST endpoint for testing registration with wallet data
export async function POST(request) {
  try {
    const { fid, test_registration = false } = await request.json();

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    console.log('🧪 Testing wallet integration during registration for FID:', fid);

    // Simulate the registration process with wallet data
    const walletData = await fetchUserWalletData(fid);
    
    if (!walletData) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch wallet data for registration test',
        fid
      });
    }

    const registrationData = {
      fid,
      username: `test_user_${fid}`,
      display_name: `Test User ${fid}`,
      bio: 'Test registration with wallet data',
      pfp_url: null,
      has_notifications: false,
      notification_status_updated_at: new Date().toISOString(),
      // Wallet data
      custody_address: walletData.custody_address,
      verified_eth_addresses: walletData.verified_eth_addresses,
      verified_sol_addresses: walletData.verified_sol_addresses,
      primary_eth_address: walletData.primary_eth_address,
      primary_sol_address: walletData.primary_sol_address,
      all_wallet_addresses: walletData.all_wallet_addresses,
      wallet_data_updated_at: walletData.wallet_data_updated_at,
      updated_at: new Date().toISOString()
    };

    // Only actually update database if test_registration is true
    let dbResult = null;
    if (test_registration) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert(registrationData, { onConflict: 'fid' })
        .select()
        .single();

      dbResult = {
        success: !profileError,
        profile,
        error: profileError?.message
      };
    }

    return NextResponse.json({
      success: true,
      message: 'Registration with wallet data test',
      fid,
      wallet_data_fetched: true,
      wallet_address_count: walletData.all_wallet_addresses?.length || 0,
      registration_data: registrationData,
      database_result: dbResult,
      note: test_registration ? 'Database was updated' : 'Database was NOT updated (add test_registration: true to actually update)'
    });

  } catch (error) {
    console.error('❌ Error in registration wallet test:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 