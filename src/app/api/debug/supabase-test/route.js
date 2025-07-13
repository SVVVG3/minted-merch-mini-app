import { NextResponse } from 'next/server';
import { setSystemContext } from '@/lib/auth';
import { 
  testSupabaseConnection, 
  getAllProfiles, 
  getProfileCount,
  supabase
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

    // Test discount codes with system context
    if (testType === 'discounts') {
      console.log('Testing discount codes with system context...');
      
      // 🔧 ADMIN ACCESS: Set system context for debug operations
      await setSystemContext();
      
      try {
        // Get all discounts
        const { data: allDiscounts, error: allError } = await supabase
          .from('discount_codes')
          .select('id, code, discount_type, discount_value, gating_type, auto_apply, discount_scope, created_at, expires_at')
          .order('created_at', { ascending: false })
          .limit(20);

        if (allError) {
          console.error('Error fetching discounts:', allError);
          results.discounts = { error: allError.message };
        } else {
          results.discounts = {
            count: allDiscounts.length,
            codes: allDiscounts
          };
        }

        // Get auto-apply discounts specifically
        const { data: autoApplyDiscounts, error: autoError } = await supabase
          .from('discount_codes')
          .select('*')
          .eq('auto_apply', true)
          .order('priority_level', { ascending: false });

        if (autoError) {
          console.error('Error fetching auto-apply discounts:', autoError);
          results.autoApplyDiscounts = { error: autoError.message };
        } else {
          results.autoApplyDiscounts = {
            count: autoApplyDiscounts.length,
            codes: autoApplyDiscounts
          };
        }

        // Get token-gated discounts
        const { data: tokenGatedDiscounts, error: tokenError } = await supabase
          .from('discount_codes')
          .select('*')
          .neq('gating_type', 'none')
          .order('priority_level', { ascending: false });

        if (tokenError) {
          console.error('Error fetching token-gated discounts:', tokenError);
          results.tokenGatedDiscounts = { error: tokenError.message };
        } else {
          results.tokenGatedDiscounts = {
            count: tokenGatedDiscounts.length,
            codes: tokenGatedDiscounts
          };
        }

      } catch (error) {
        console.error('Error in discount test:', error);
        results.discounts = { error: error.message };
      }
    }

    // Recreate user profile
    if (testType === 'recreate_profile' && userFid) {
      console.log('Recreating user profile for FID:', userFid);
      const userFidInt = parseInt(userFid);
      
      // 🔧 ADMIN ACCESS: Set system context for debug operations
      await setSystemContext();
      
      try {
        // First check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('fid', userFidInt)
          .single();

        if (existingProfile) {
          results.recreateProfile = {
            status: 'profile_already_exists',
            profile: existingProfile
          };
        } else {
          // Create new profile with default values
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              fid: userFidInt,
              username: `user_${userFidInt}`, // Default username
              display_name: `User ${userFidInt}`,
              has_notifications: false,
              bankr_club_member: false, // Default to false, will be updated by registration flow
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            results.recreateProfile = { error: createError.message };
          } else {
            results.recreateProfile = {
              status: 'profile_created',
              profile: newProfile
            };
          }
        }
      } catch (error) {
        console.error('Error in recreate profile:', error);
        results.recreateProfile = { error: error.message };
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