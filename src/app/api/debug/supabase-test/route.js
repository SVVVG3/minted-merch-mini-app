import { NextResponse } from 'next/server';
import { setSystemContext } from '@/lib/auth';
import { 
  testSupabaseConnection, 
  getAllProfiles, 
  getProfileCount 
} from '@/lib/supabase';
import { 
  fetchNotificationTokensFromNeynar, 
  hasNotificationTokenInNeynar,
  getNotificationStatus,
  isNeynarAvailable
} from '@/lib/neynar';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('testType') || 'full';
    const userFid = searchParams.get('userFid');

    console.log('Debug test type:', testType, 'userFid:', userFid);

    const results = {
      timestamp: new Date().toISOString(),
      testType: testType
    };

    // Test Supabase connection
    if (testType === 'full' || testType === 'supabase') {
      console.log('Testing Supabase connection...');
      
      // 🔧 ADMIN ACCESS: Set system context for debug operations
      await setSystemContext();
      
      const supabaseTest = await testSupabaseConnection();
      results.supabase = supabaseTest;

      if (supabaseTest.success) {
        // Get profile count
        const profileCount = await getProfileCount();
        results.supabase.profileCount = profileCount.success ? profileCount.count : 0;

        // Get all profiles
        const allProfiles = await getAllProfiles();
        results.supabase.profiles = allProfiles.success ? allProfiles.profiles : [];
      }
    }

    // Test Neynar notification tokens
    if (testType === 'full' || testType === 'neynar') {
      console.log('Testing Neynar notification tokens...');
      results.neynar = {
        available: isNeynarAvailable(),
        timestamp: new Date().toISOString()
      };

      if (isNeynarAvailable()) {
        try {
          // Fetch all notification tokens from Neynar
          console.log('Fetching all notification tokens from Neynar...');
          const allTokens = await fetchNotificationTokensFromNeynar();
          results.neynar.allTokens = allTokens;

          // If specific user FID provided, check their notification status
          if (userFid) {
            console.log('Checking notification status for user FID:', userFid);
            const userTokenCheck = await hasNotificationTokenInNeynar(parseInt(userFid));
            results.neynar.userTokenCheck = userTokenCheck;

            const notificationStatus = await getNotificationStatus(parseInt(userFid));
            results.neynar.notificationStatus = notificationStatus;
          }
        } catch (error) {
          console.error('Error testing Neynar:', error);
          results.neynar.error = error.message;
        }
      } else {
        results.neynar.error = 'Neynar not configured';
      }
    }

    // Test specific profiles
    if (testType === 'profiles') {
      console.log('Getting profile information...');
      
      // 🔧 ADMIN ACCESS: Set system context for debug operations
      await setSystemContext();
      
      const allProfiles = await getAllProfiles();
      results.profiles = allProfiles;
    }

    // Test specific user
    if (testType === 'user' && userFid) {
      console.log('Testing specific user:', userFid);
      const userFidInt = parseInt(userFid);
      
      // 🔧 ADMIN ACCESS: Set system context for debug operations
      await setSystemContext();
      
      // Check Supabase profile
      const supabaseTest = await testSupabaseConnection();
      results.supabase = supabaseTest;
      
      if (supabaseTest.success) {
        const allProfiles = await getAllProfiles();
        const userProfile = allProfiles.success 
          ? allProfiles.profiles.find(p => p.fid === userFidInt)
          : null;
        results.userProfile = userProfile;
      }

      // Check Neynar notification status
      if (isNeynarAvailable()) {
        const notificationStatus = await getNotificationStatus(userFidInt);
        results.neynarStatus = notificationStatus;
      }
    }

    console.log('Debug results:', results);
    return NextResponse.json(results);

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 