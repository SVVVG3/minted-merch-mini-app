import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hasNotificationTokenInNeynar, sendWelcomeNotification } from '@/lib/neynar';
import { createWelcomeDiscountCode } from '@/lib/discounts';
import { fetchUserWalletData } from '@/lib/walletUtils';
import { checkBankrClubMembership } from '@/lib/bankrAPI';
import { createUserProfile } from '@/lib/supabase';
import { fetchUserProfile } from '@/lib/neynar';

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
        total_addresses: walletData.all_wallet_addresses?.length || 0,
        x_username: walletData.x_username,
        verified_accounts_count: walletData.verified_accounts?.length || 0
      });
    } else {
      console.log('⚠️ Could not fetch wallet data for FID:', fid);
    }

    // Check Bankr Club membership for BOTH Farcaster and X usernames
    console.log('🏦 Checking Bankr Club membership for user...');
    let bankrMembershipData = {
      bankr_club_member: false,
      x_username: walletData?.x_username || null,
      bankr_membership_updated_at: new Date().toISOString()
    };

    try {
      // Enhanced Bankr Club membership checking for BOTH platforms
      let isBankrMember = false;
      let membershipSource = null;
      let bankrWalletData = null;
      
      // 1. Check Farcaster username first with enhanced wallet data
      console.log('🔮 Checking Bankr Club via Farcaster username:', username);
      const { getBankrDataForFarcasterUser } = await import('@/lib/bankrAPI');
      const farcasterWalletData = await getBankrDataForFarcasterUser(username);
      
      if (farcasterWalletData) {
        console.log('💳 Farcaster Bankr wallet data:', {
          accountId: farcasterWalletData.accountId,
          hasEVM: !!farcasterWalletData.evmAddress,
          hasSolana: !!farcasterWalletData.solanaAddress,
          bankrClub: farcasterWalletData.bankrClub
        });

        if (farcasterWalletData.bankrClub) {
          isBankrMember = true;
          membershipSource = 'farcaster';
          bankrWalletData = farcasterWalletData;
          console.log('✅ User is Bankr Club member via Farcaster username');
        }
      } else {
        console.log('💳 No Farcaster Bankr wallet data found');
      }

      // 2. If no membership via Farcaster AND we have X username, check X as well
      if (!isBankrMember && walletData?.x_username) {
        console.log('🐦 Checking Bankr Club via X username:', walletData.x_username);
        
        const { getBankrDataForXUser } = await import('@/lib/bankrAPI');
        const xWalletData = await getBankrDataForXUser(walletData.x_username);
        
        if (xWalletData) {
          console.log('💳 X Bankr wallet data:', {
            accountId: xWalletData.accountId,
            hasEVM: !!xWalletData.evmAddress,
            hasSolana: !!xWalletData.solanaAddress,
            bankrClub: xWalletData.bankrClub
          });

          if (xWalletData.bankrClub) {
            isBankrMember = true;
            membershipSource = 'x';
            bankrWalletData = xWalletData;
            console.log('✅ User is Bankr Club member via X username');
          }
        } else {
          console.log('💳 No X Bankr wallet data found');
        }
      }

      // Update membership data with final result and wallet addresses
      bankrMembershipData.bankr_club_member = isBankrMember;
      
      // Store Bankr wallet addresses if found
      if (bankrWalletData) {
        bankrMembershipData.bankr_account_id = bankrWalletData.accountId || null;
        bankrMembershipData.bankr_evm_address = bankrWalletData.evmAddress || null;
        bankrMembershipData.bankr_solana_address = bankrWalletData.solanaAddress || null;
        bankrMembershipData.bankr_wallet_data_updated_at = new Date().toISOString();
      }
      
      console.log('🎯 Final Bankr Club membership status:', {
        username: username,
        x_username: walletData?.x_username,
        isMember: isBankrMember,
        source: membershipSource || 'not_found',
        checked_platforms: membershipSource ? [membershipSource] : ['farcaster', walletData?.x_username ? 'x' : null].filter(Boolean)
      });
        
    } catch (bankrError) {
      console.error('Error checking Bankr Club membership:', bankrError);
      // Don't fail registration if Bankr check fails
    }

    // Get existing profile to preserve farcaster_event source if it exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('notification_status_source')
      .eq('fid', fid)
      .single();

    // Create or update user profile with notification status and wallet data
    const profileData = {
      fid,
      username,
      display_name: displayName,
      bio: bio || null,
      pfp_url: pfpUrl,
      has_notifications: hasNotifications, // ✅ Store notification status
      notification_status_updated_at: new Date().toISOString(),
      notification_status_source: existingProfile?.notification_status_source === 'farcaster_event' ? 'farcaster_event' : 'neynar_sync',
      updated_at: new Date().toISOString(),
      // Add Bankr Club membership data
      bankr_club_member: bankrMembershipData.bankr_club_member,
      x_username: bankrMembershipData.x_username,
      bankr_membership_updated_at: bankrMembershipData.bankr_membership_updated_at,
      // Add email field (will be populated later from order data via triggers)
      email: null, // Will be updated automatically when user places orders
      email_updated_at: null
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
      // UPDATED: Store X username from wallet data (overrides the earlier assignment)
      if (walletData.x_username) {
        profileData.x_username = walletData.x_username;
        console.log('📝 Storing X username from Neynar verified accounts:', walletData.x_username);
      }
    }

    const { data: profile, error: profileError } = await supabaseAdmin
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

    // Update user's token balance in background (don't block registration)
    if (walletData?.all_wallet_addresses?.length > 0) {
      console.log('💰 Updating token balance for user in background...');
      // Import and call token balance update function
      try {
        const { refreshUserTokenBalance } = await import('@/lib/tokenBalanceCache');
        refreshUserTokenBalance(fid, walletData.all_wallet_addresses)
          .then(result => {
            if (result.success) {
              console.log(`✅ Token balance updated for FID ${fid}: ${result.balance} tokens`);
            } else {
              console.warn(`⚠️ Failed to update token balance for FID ${fid}:`, result.error);
            }
          })
          .catch(error => {
            console.error(`❌ Error updating token balance for FID ${fid}:`, error);
          });
      } catch (error) {
        console.error('❌ Error importing token balance cache:', error);
      }
    } else {
      console.log('💰 No wallet addresses found, setting token balance to 0');
      try {
        const { updateUserTokenBalance } = await import('@/lib/tokenBalanceCache');
        updateUserTokenBalance(fid, [], 0)
          .then(result => {
            console.log(`✅ Token balance set to 0 for FID ${fid} (no wallets)`);
          })
          .catch(error => {
            console.error(`❌ Error setting token balance to 0 for FID ${fid}:`, error);
          });
      } catch (error) {
        console.error('❌ Error importing token balance cache:', error);
      }
    }

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
          const { error: updateError } = await supabaseAdmin
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
      // Enhanced Bankr Club membership info for debugging
      bankrClubMember: bankrMembershipData.bankr_club_member,
      bankrMembershipChecked: true,
      bankrMembershipUpdatedAt: bankrMembershipData.bankr_membership_updated_at,
      // ADDED: More detailed X username and verification info
      xUsername: walletData?.x_username || null,
      verifiedAccountsCount: walletData?.verified_accounts?.length || 0,
      bankrCheckedPlatforms: {
        farcaster: true,
        x: !!(walletData?.x_username), // Only checked if X username was available
      },
      // ADDED: Email field info for debugging
      email: profile?.email || null,
      emailUpdatedAt: profile?.email_updated_at || null,
      emailWillBeUpdatedFromOrders: true
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