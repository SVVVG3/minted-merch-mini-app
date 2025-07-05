import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hasNotificationTokenInNeynar, sendWelcomeNotification } from '@/lib/neynar';
import { createWelcomeDiscountCode } from '@/lib/discounts';
import { fetchUserWalletData } from '@/lib/walletUtils';
import { checkBankrClubMembership } from '@/lib/bankrAPI';

export async function POST(request) {
  try {
    const { fid, username, displayName, bio, pfpUrl } = await request.json();

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    console.log('Registering user:', { fid, username, displayName });

    // Check if user has notifications enabled (check this FIRST)
    const hasNotifications = await hasNotificationTokenInNeynar(fid);
    console.log('User has notifications enabled:', hasNotifications);

    // Fetch wallet data from Neynar
    console.log('🔍 Fetching wallet data for user registration...');
    const walletData = await fetchUserWalletData(fid);
    if (walletData) {
      console.log('✅ Wallet data fetched successfully:', {
        custody_address: walletData.custody_address,
        eth_count: walletData.verified_eth_addresses?.length || 0,
        sol_count: walletData.verified_sol_addresses?.length || 0,
        total_addresses: walletData.all_wallet_addresses?.length || 0
      });
    } else {
      console.log('⚠️ Could not fetch wallet data for FID:', fid);
    }

    // Check Bankr Club membership
    console.log('🏦 Checking Bankr Club membership for user...');
    let bankrMembershipData = {
      bankr_club_member: false,
      x_username: null,
      bankr_membership_updated_at: new Date().toISOString()
    };

    try {
      const bankrResult = await checkBankrClubMembership(username);
      console.log('Bankr Club membership result:', {
        success: bankrResult.success,
        found: bankrResult.found,
        isMember: bankrResult.isMember
      });

      if (bankrResult.success) {
        bankrMembershipData.bankr_club_member = bankrResult.isMember;
        
        // Note: We don't have X username from Farcaster data, so we'll leave it null for now
        // In the future, we could potentially ask users to provide their X username
        
        console.log('✅ Bankr Club membership status updated:', {
          username: username,
          isMember: bankrResult.isMember,
          found: bankrResult.found
        });
      } else {
        console.log('⚠️ Could not check Bankr Club membership:', bankrResult.error);
      }
    } catch (bankrError) {
      console.error('Error checking Bankr Club membership:', bankrError);
      // Don't fail registration if Bankr check fails
    }

    // Create or update user profile with notification status and wallet data
    const profileData = {
      fid,
      username,
      display_name: displayName,
      bio: bio || null,
      pfp_url: pfpUrl,
      has_notifications: hasNotifications, // ✅ Store notification status
      notification_status_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Add Bankr Club membership data
      bankr_club_member: bankrMembershipData.bankr_club_member,
      x_username: bankrMembershipData.x_username,
      bankr_membership_updated_at: bankrMembershipData.bankr_membership_updated_at
    };

    // Add wallet data if available
    if (walletData) {
      profileData.custody_address = walletData.custody_address;
      profileData.verified_eth_addresses = walletData.verified_eth_addresses;
      profileData.verified_sol_addresses = walletData.verified_sol_addresses;
      profileData.primary_eth_address = walletData.primary_eth_address;
      profileData.primary_sol_address = walletData.primary_sol_address;
      profileData.all_wallet_addresses = walletData.all_wallet_addresses;
      profileData.wallet_data_updated_at = walletData.wallet_data_updated_at;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'fid'
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
    }

    console.log('User profile created/updated:', profile);

    // Generate welcome discount code for new users (regardless of notification status)
    let discountCode = null;
    try {
      const discountResult = await createWelcomeDiscountCode(fid);
      if (discountResult.success) {
        discountCode = discountResult.code;
        console.log('✅ Welcome discount code generated:', discountCode, 'isExisting:', discountResult.isExisting);
      } else {
        console.log('⚠️ Could not create discount code:', discountResult.error);
      }
    } catch (discountError) {
      console.error('Error generating discount code:', discountError);
      // Don't fail registration if discount code generation fails
    }

    // Send welcome notification if user has notifications enabled and hasn't received it yet
    let welcomeNotificationSent = false;
    if (hasNotifications && !profile.welcome_notification_sent) {
      console.log('Sending welcome notification to user with notifications enabled');
      
      try {
        const notificationResult = await sendWelcomeNotification(fid);
        console.log('Welcome notification result:', notificationResult);

        if (notificationResult.success) {
          // Mark welcome notification as sent
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              welcome_notification_sent: true,
              welcome_notification_sent_at: new Date().toISOString()
            })
            .eq('fid', fid);

          if (updateError) {
            console.error('Error updating welcome notification status:', updateError);
          } else {
            console.log('Welcome notification marked as sent for FID:', fid);
            welcomeNotificationSent = true;
          }
        }
      } catch (notificationError) {
        console.error('Error sending welcome notification:', notificationError);
        // Don't fail the registration if notification fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      profile,
      hasNotifications,
      welcomeNotificationSent,
      discountCode: discountCode, // Include discount code in response for debugging
      walletDataFetched: !!walletData, // Include wallet data status
      walletAddressCount: walletData?.all_wallet_addresses?.length || 0,
      // Add Bankr Club membership info for debugging
      bankrClubMember: bankrMembershipData.bankr_club_member,
      bankrMembershipChecked: true,
      bankrMembershipUpdatedAt: bankrMembershipData.bankr_membership_updated_at
    });

  } catch (error) {
    console.error('Error in register-user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle GET requests for testing
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userFid = parseInt(searchParams.get('userFid')) || 466111;
  
  return NextResponse.json({
    message: 'User registration endpoint',
    usage: 'POST with { userFid, userData, notificationToken }',
    testUserFid: userFid,
    timestamp: new Date().toISOString()
  });
} 