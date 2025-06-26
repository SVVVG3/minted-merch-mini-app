import { NextResponse } from 'next/server';
import { 
  isSupabaseAvailable,
  getOrCreateProfile,
  storeNotificationToken,
  getNotificationToken,
  getUsersWithNotifications
} from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('testType') || 'connectivity';
    const userFid = parseInt(searchParams.get('userFid')) || 466111;

    console.log('=== SUPABASE DEBUG TEST ===');
    console.log('Test type:', testType);
    console.log('User FID:', userFid);

    const results = {
      timestamp: new Date().toISOString(),
      testType,
      userFid,
      supabaseAvailable: isSupabaseAvailable(),
      tests: {}
    };

    if (!isSupabaseAvailable()) {
      results.error = 'Supabase not configured - check environment variables';
      return NextResponse.json(results);
    }

    switch (testType) {
      case 'connectivity':
        results.tests.connectivity = await testConnectivity();
        break;
      
      case 'profile':
        results.tests.profile = await testProfile(userFid);
        break;
      
      case 'token':
        results.tests.token = await testNotificationToken(userFid);
        break;
      
      case 'full':
        results.tests.connectivity = await testConnectivity();
        results.tests.profile = await testProfile(userFid);
        results.tests.token = await testNotificationToken(userFid);
        results.tests.users = await testGetUsers();
        break;
      
      default:
        results.error = 'Unknown test type. Use: connectivity, profile, token, or full';
    }

    console.log('=== SUPABASE DEBUG RESULTS ===');
    console.log(JSON.stringify(results, null, 2));

    return NextResponse.json(results);

  } catch (error) {
    console.error('=== SUPABASE DEBUG ERROR ===');
    console.error('Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { testType, userFid, tokenData } = body;

    console.log('=== SUPABASE DEBUG POST TEST ===');
    console.log('Test type:', testType);
    console.log('User FID:', userFid);

    const results = {
      timestamp: new Date().toISOString(),
      testType,
      userFid,
      supabaseAvailable: isSupabaseAvailable()
    };

    if (!isSupabaseAvailable()) {
      results.error = 'Supabase not configured - check environment variables';
      return NextResponse.json(results);
    }

    switch (testType) {
      case 'create_profile':
        results.profileResult = await getOrCreateProfile(userFid, {
          username: `test_user_${userFid}`,
          display_name: 'Test User',
          bio: 'Test profile for debugging',
          pfp_url: 'https://example.com/avatar.png'
        });
        break;
      
      case 'store_token':
        if (!tokenData) {
          results.error = 'tokenData required for store_token test';
          break;
        }
        results.tokenResult = await storeNotificationToken(userFid, tokenData);
        break;
      
      case 'simulate_add':
        // Simulate the full flow of adding a Mini App with notifications
        results.profileResult = await getOrCreateProfile(userFid, {
          username: `user_${userFid}`,
          display_name: 'Simulated User',
          bio: null,
          pfp_url: null
        });
        
        if (results.profileResult.success) {
          results.tokenResult = await storeNotificationToken(userFid, {
            token: `test_token_${Date.now()}`,
            url: 'https://api.farcaster.xyz/v1/frame-notifications'
          });
        }
        break;
      
      default:
        results.error = 'Unknown POST test type. Use: create_profile, store_token, or simulate_add';
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('=== SUPABASE DEBUG POST ERROR ===');
    console.error('Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Test basic connectivity
async function testConnectivity() {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { 
      success: true, 
      message: 'Database connection successful',
      profileCount: data?.length || 0
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test profile operations
async function testProfile(userFid) {
  try {
    const result = await getOrCreateProfile(userFid, {
      username: `debug_user_${userFid}`,
      display_name: 'Debug User',
      bio: 'Created during debug test',
      pfp_url: null
    });
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test notification token operations
async function testNotificationToken(userFid) {
  try {
    // First, try to get existing token
    const getResult = await getNotificationToken(userFid);
    
    if (!getResult.success) {
      return { success: false, error: getResult.error, operation: 'get_token' };
    }
    
    const testToken = {
      token: `debug_token_${Date.now()}`,
      url: 'https://api.farcaster.xyz/v1/frame-notifications'
    };
    
    // Store a test token
    const storeResult = await storeNotificationToken(userFid, testToken);
    
    if (!storeResult.success) {
      return { success: false, error: storeResult.error, operation: 'store_token' };
    }
    
    // Get the token again to verify it was stored
    const verifyResult = await getNotificationToken(userFid);
    
    return {
      success: true,
      operations: {
        initial_get: getResult,
        store: storeResult,
        verify_get: verifyResult
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test getting users with notifications
async function testGetUsers() {
  try {
    const result = await getUsersWithNotifications();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
} 