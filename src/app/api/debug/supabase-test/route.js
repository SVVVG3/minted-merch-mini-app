import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('testType') || 'connectivity';
  const userFid = parseInt(searchParams.get('userFid')) || 466111;

  const response = {
    timestamp: new Date().toISOString(),
    testType,
    userFid,
    supabaseAvailable: !!supabase,
    tests: {}
  };

  if (!supabase) {
    response.error = 'Supabase client not available';
    return NextResponse.json(response);
  }

  try {
    switch (testType) {
      case 'connectivity':
        response.tests.connectivity = await testConnectivity();
        break;
      
      case 'profile':
        response.tests.profile = await testProfile(userFid);
        break;
      
      case 'notifications':
        response.tests.notifications = await testNotifications(userFid);
        break;
      
      case 'full':
        response.tests.connectivity = await testConnectivity();
        response.tests.profile = await testProfile(userFid);
        response.tests.notifications = await testNotifications(userFid);
        break;
      
      default:
        response.error = 'Unknown test type. Use: connectivity, profile, notifications, or full';
    }
  } catch (error) {
    response.error = error.message;
    console.error('Debug test error:', error);
  }

  return NextResponse.json(response);
}

async function testConnectivity() {
  console.log('Testing Supabase connectivity...');
  
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      message: 'Database connection successful',
      profileCount: count
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testProfile(userFid) {
  console.log('Testing profile operations for FID:', userFid);
  
  try {
    // Test profile retrieval
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('fid', userFid)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return {
        success: false,
        error: fetchError.message
      };
    }

    const isNew = !profile;

    // If no profile exists, create one for testing
    if (isNew) {
      console.log('Creating test profile...');
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          fid: userFid,
          username: `test_user_${userFid}`,
          display_name: 'Test User',
          bio: 'Test bio',
          pfp_url: null,
          notifications_enabled: false
        })
        .select()
        .single();

      if (createError) {
        return {
          success: false,
          error: createError.message
        };
      }

      return {
        success: true,
        profile: newProfile,
        isNew: true
      };
    }

    return {
      success: true,
      profile: profile,
      isNew: false
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testNotifications(userFid) {
  console.log('Testing notification operations for FID:', userFid);
  
  try {
    const operations = {};

    // Test 1: Get current notification status
    const { data: currentProfile, error: getCurrentError } = await supabase
      .from('profiles')
      .select('notifications_enabled, notification_token, notification_url')
      .eq('fid', userFid)
      .single();

    operations.initial_get = {
      success: !getCurrentError,
      error: getCurrentError?.message,
      notificationsEnabled: currentProfile?.notifications_enabled || false,
      hasToken: !!currentProfile?.notification_token
    };

    if (getCurrentError && getCurrentError.code !== 'PGRST116') {
      return {
        success: false,
        error: getCurrentError.message,
        operations
      };
    }

    // Test 2: Enable notifications with a test token
    const testToken = `debug_token_${Date.now()}`;
    const { data: updatedProfile, error: enableError } = await supabase
      .from('profiles')
      .update({
        notifications_enabled: true,
        notification_token: testToken,
        notification_url: 'https://api.farcaster.xyz/v1/frame-notifications',
        updated_at: new Date().toISOString()
      })
      .eq('fid', userFid)
      .select()
      .single();

    operations.enable = {
      success: !enableError,
      error: enableError?.message,
      data: updatedProfile
    };

    if (enableError) {
      return {
        success: false,
        error: enableError.message,
        operations
      };
    }

    // Test 3: Verify the update worked
    const { data: verifyProfile, error: verifyError } = await supabase
      .from('profiles')
      .select('notifications_enabled, notification_token, notification_url')
      .eq('fid', userFid)
      .single();

    operations.verify = {
      success: !verifyError,
      error: verifyError?.message,
      notificationsEnabled: verifyProfile?.notifications_enabled,
      tokenMatches: verifyProfile?.notification_token === testToken
    };

    return {
      success: true,
      operations
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
} 