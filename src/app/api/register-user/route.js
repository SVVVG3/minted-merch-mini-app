import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hasNotificationTokenInNeynar, sendWelcomeNotification } from '@/lib/neynar';
import { createWelcomeDiscountCode } from '@/lib/discounts';
import { fetchUserWalletData } from '@/lib/walletUtils';
import { checkBankrClubMembership } from '@/lib/bankrAPI';
import { createUserProfile } from '@/lib/supabase';
import { fetchUserProfile } from '@/lib/neynar';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';
import { getQuotientScoreForFid } from '@/lib/quotient';
import { calculateMojoScore } from '@/lib/mojoScore';

export async function POST(request) {
  try {
    const { fid, username, displayName, bio, pfpUrl } = await request.json();

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    // 🔒 SECURITY FIX: Verify user can only register/update their own profile
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Returns 401 or 403 error if auth fails

    console.log('Authenticated user registering profile:', { 
      fid, 
      username, 
      displayName,
      pfpUrl: pfpUrl ? 'provided' : 'null/missing'
    });

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

    // Initialize Bankr wallet data outside try block for broader scope
    let allBankrWalletData = {
      farcaster: null,
      x: null,
      combinedAddresses: {
        evmAddresses: [],
        solanaAddresses: [],
        accountIds: []
      }
    };

    try {
      // Enhanced Bankr Club membership checking for BOTH platforms
      let isBankrMember = false;
      let membershipSource = null;
      
      // 1. Check Farcaster username first with enhanced wallet data
      console.log('🔮 Checking Bankr Club via Farcaster username:', username);
      const { getBankrDataForFarcasterUser, getBankrDataForXUser } = await import('@/lib/bankrAPI');
      const farcasterWalletData = await getBankrDataForFarcasterUser(username);
      
      if (farcasterWalletData) {
        allBankrWalletData.farcaster = farcasterWalletData;
        
        console.log('💳 Farcaster Bankr wallet data:', {
          accountId: farcasterWalletData.accountId,
          hasEVM: !!farcasterWalletData.evmAddress,
          hasSolana: !!farcasterWalletData.solanaAddress,
          bankrClub: farcasterWalletData.bankrClub
        });

        // Add Farcaster addresses to combined list
        if (farcasterWalletData.evmAddress) {
          allBankrWalletData.combinedAddresses.evmAddresses.push(farcasterWalletData.evmAddress);
        }
        if (farcasterWalletData.solanaAddress) {
          allBankrWalletData.combinedAddresses.solanaAddresses.push(farcasterWalletData.solanaAddress);
        }
        if (farcasterWalletData.accountId) {
          allBankrWalletData.combinedAddresses.accountIds.push(farcasterWalletData.accountId);
        }

        if (farcasterWalletData.bankrClub) {
          isBankrMember = true;
          membershipSource = 'farcaster';
          console.log('✅ User is Bankr Club member via Farcaster username');
        }
      } else {
        console.log('💳 No Farcaster Bankr wallet data found');
      }

      // 2. ALWAYS check X username if available (regardless of Farcaster membership)
      if (walletData?.x_username) {
        console.log('🐦 Checking Bankr Club via X username:', walletData.x_username);
        
        const xWalletData = await getBankrDataForXUser(walletData.x_username);
        
        if (xWalletData) {
          allBankrWalletData.x = xWalletData;
          
          console.log('💳 X Bankr wallet data:', {
            accountId: xWalletData.accountId,
            hasEVM: !!xWalletData.evmAddress,
            hasSolana: !!xWalletData.solanaAddress,
            bankrClub: xWalletData.bankrClub
          });

          // Add X addresses to combined list
          if (xWalletData.evmAddress && !allBankrWalletData.combinedAddresses.evmAddresses.includes(xWalletData.evmAddress)) {
            allBankrWalletData.combinedAddresses.evmAddresses.push(xWalletData.evmAddress);
          }
          if (xWalletData.solanaAddress && !allBankrWalletData.combinedAddresses.solanaAddresses.includes(xWalletData.solanaAddress)) {
            allBankrWalletData.combinedAddresses.solanaAddresses.push(xWalletData.solanaAddress);
          }
          if (xWalletData.accountId && !allBankrWalletData.combinedAddresses.accountIds.includes(xWalletData.accountId)) {
            allBankrWalletData.combinedAddresses.accountIds.push(xWalletData.accountId);
          }

          if (xWalletData.bankrClub && !isBankrMember) {
            isBankrMember = true;
            membershipSource = 'x';
            console.log('✅ User is Bankr Club member via X username');
          }
        } else {
          console.log('💳 No X Bankr wallet data found');
        }
      }

      // Update membership data with final result and wallet addresses
      bankrMembershipData.bankr_club_member = isBankrMember;
      
      // Store combined Bankr wallet addresses (prioritize primary source)
      const primaryData = membershipSource === 'farcaster' ? allBankrWalletData.farcaster : allBankrWalletData.x;
      const hasAnyWalletData = allBankrWalletData.farcaster || allBankrWalletData.x;
      
      if (hasAnyWalletData) {
        // Use primary account ID, or first available
        bankrMembershipData.bankr_account_id = primaryData?.accountId || allBankrWalletData.combinedAddresses.accountIds[0] || null;
        
        // Use primary EVM address, or first available
        bankrMembershipData.bankr_evm_address = primaryData?.evmAddress || allBankrWalletData.combinedAddresses.evmAddresses[0] || null;
        
        // Use primary Solana address, or first available  
        bankrMembershipData.bankr_solana_address = primaryData?.solanaAddress || allBankrWalletData.combinedAddresses.solanaAddresses[0] || null;
        
        bankrMembershipData.bankr_wallet_data_updated_at = new Date().toISOString();
        
        console.log('💳 Storing combined Bankr wallet addresses in database:', {
          accountId: bankrMembershipData.bankr_account_id,
          evmAddress: bankrMembershipData.bankr_evm_address ? `${bankrMembershipData.bankr_evm_address.substring(0, 6)}...${bankrMembershipData.bankr_evm_address.substring(38)}` : null,
          solanaAddress: bankrMembershipData.bankr_solana_address ? `${bankrMembershipData.bankr_solana_address.substring(0, 6)}...${bankrMembershipData.bankr_solana_address.substring(38)}` : null,
          totalEVMAddresses: allBankrWalletData.combinedAddresses.evmAddresses.length,
          totalSolanaAddresses: allBankrWalletData.combinedAddresses.solanaAddresses.length,
          sources: [allBankrWalletData.farcaster ? 'farcaster' : null, allBankrWalletData.x ? 'x' : null].filter(Boolean)
        });
      } else {
        console.log('💳 No Bankr wallet data found to store');
      }
      
      console.log('🎯 Final Bankr Club membership status:', {
        username: username,
        x_username: walletData?.x_username,
        isMember: isBankrMember,
        source: membershipSource || 'not_found',
        checked_platforms: membershipSource ? [membershipSource] : ['farcaster', walletData?.x_username ? 'x' : null].filter(Boolean)
      });

      console.log('💾 Final bankrMembershipData to be stored:', bankrMembershipData);
        
    } catch (bankrError) {
      console.error('Error checking Bankr Club membership:', bankrError);
      // Don't fail registration if Bankr check fails
    }

    // Get existing profile to preserve certain fields if they exist
    // Also get staked_balance and token_balance for Mojo score calculation
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('notification_status_source, pfp_url, username, display_name, bio, staked_balance, token_balance')
      .eq('fid', fid)
      .single();

    // Create or update user profile with notification status and wallet data
    // IMPORTANT: Only overwrite fields if we have new valid values
    // This prevents null values from wiping out existing data
    // Priority for pfp_url: 1) Incoming from Farcaster SDK, 2) Neynar API, 3) Existing in DB
    const resolvedPfpUrl = pfpUrl || walletData?.pfp_url || existingProfile?.pfp_url || null;
    
    const profileData = {
      fid,
      username: username || existingProfile?.username || null,
      display_name: displayName || existingProfile?.display_name || null,
      bio: bio || existingProfile?.bio || null,
      // Use resolved pfp_url with fallback chain
      pfp_url: resolvedPfpUrl,
      has_notifications: hasNotifications, // ✅ Store notification status
      notification_status_updated_at: new Date().toISOString(),
      notification_status_source: existingProfile?.notification_status_source === 'farcaster_event' ? 'farcaster_event' : 'neynar_sync',
      updated_at: new Date().toISOString(),
      // Add Bankr Club membership data
      bankr_club_member: bankrMembershipData.bankr_club_member,
      x_username: bankrMembershipData.x_username,
      bankr_membership_updated_at: bankrMembershipData.bankr_membership_updated_at,
      // Add Bankr wallet address data
      bankr_account_id: bankrMembershipData.bankr_account_id || null,
      bankr_evm_address: bankrMembershipData.bankr_evm_address || null,
      bankr_solana_address: bankrMembershipData.bankr_solana_address || null,
      bankr_wallet_data_updated_at: bankrMembershipData.bankr_wallet_data_updated_at || null,
      // Add email field (will be populated later from order data via triggers)
      email: null, // Will be updated automatically when user places orders
      email_updated_at: null
    };

    // Log pfp_url resolution chain
    console.log('📷 Profile picture handling:', {
      fid,
      source1_farcasterSdk: pfpUrl ? 'provided' : 'null',
      source2_neynarApi: walletData?.pfp_url ? 'provided' : 'null',
      source3_existingDb: existingProfile?.pfp_url ? 'exists' : 'null',
      finalPfpUrl: resolvedPfpUrl ? 'set' : 'null',
      resolvedFrom: pfpUrl ? 'farcaster_sdk' : (walletData?.pfp_url ? 'neynar_api' : (existingProfile?.pfp_url ? 'existing_db' : 'none'))
    });

    // Add wallet data if available
    if (walletData) {
      profileData.custody_address = walletData.custody_address;
      profileData.verified_eth_addresses = walletData.verified_eth_addresses;
      profileData.verified_sol_addresses = walletData.verified_sol_addresses;
      profileData.primary_eth_address = walletData.primary_eth_address;
      profileData.primary_sol_address = walletData.primary_sol_address;
      
      // Start with Neynar wallet addresses
      let allWalletAddresses = [...(walletData.all_wallet_addresses || [])];
      
      // Add ALL Bankr wallet addresses to the main wallet list for token gating
      // Add primary addresses first
      if (bankrMembershipData.bankr_evm_address) {
        const bankrEvm = bankrMembershipData.bankr_evm_address.toLowerCase();
        if (!allWalletAddresses.includes(bankrEvm)) {
          allWalletAddresses.push(bankrEvm);
          console.log('💳 Added primary Bankr EVM address to all_wallet_addresses:', bankrMembershipData.bankr_evm_address);
        }
      }
      
      if (bankrMembershipData.bankr_solana_address) {
        const bankrSol = bankrMembershipData.bankr_solana_address.toLowerCase();
        if (!allWalletAddresses.includes(bankrSol)) {
          allWalletAddresses.push(bankrSol);
          console.log('💳 Added primary Bankr Solana address to all_wallet_addresses:', bankrMembershipData.bankr_solana_address);
        }
      }
      
      // Add ALL additional Bankr addresses from both Farcaster and X accounts
      if (allBankrWalletData && (allBankrWalletData.farcaster || allBankrWalletData.x)) {
        // Add all EVM addresses from combined data
        allBankrWalletData.combinedAddresses.evmAddresses.forEach(evmAddr => {
          const evmLower = evmAddr.toLowerCase();
          if (!allWalletAddresses.includes(evmLower)) {
            allWalletAddresses.push(evmLower);
            console.log('💳 Added additional Bankr EVM address to all_wallet_addresses:', evmAddr);
          }
        });
        
        // Add all Solana addresses from combined data
        allBankrWalletData.combinedAddresses.solanaAddresses.forEach(solAddr => {
          const solLower = solAddr.toLowerCase();
          if (!allWalletAddresses.includes(solLower)) {
            allWalletAddresses.push(solLower);
            console.log('💳 Added additional Bankr Solana address to all_wallet_addresses:', solAddr);
          }
        });
      }
      
      profileData.all_wallet_addresses = allWalletAddresses;
      profileData.wallet_data_updated_at = walletData.wallet_data_updated_at;
      
      console.log(`💼 Total wallet addresses for token gating: ${allWalletAddresses.length} (${walletData.all_wallet_addresses?.length || 0} Neynar + ${allWalletAddresses.length - (walletData.all_wallet_addresses?.length || 0)} Bankr)`);
      
      // UPDATED: Store X username from wallet data (overrides the earlier assignment)
      if (walletData.x_username) {
        profileData.x_username = walletData.x_username;
        console.log('📝 Storing X username from Neynar verified accounts:', walletData.x_username);
      }
      
      // Store Neynar user score (0-1, higher = more trustworthy user)
      if (walletData.neynar_score !== null && walletData.neynar_score !== undefined) {
        profileData.neynar_score = walletData.neynar_score;
        console.log('⭐ Storing Neynar user score:', walletData.neynar_score);
      }
    }

    // Fetch Quotient score (PageRank-based reputation metric)
    let quotientScore = null;
    try {
      quotientScore = await getQuotientScoreForFid(fid);
      if (quotientScore !== null) {
        profileData.quotient_score = quotientScore;
        console.log('📊 Storing Quotient score:', quotientScore);
      }
    } catch (quotientError) {
      console.log('⚠️ Could not fetch Quotient score:', quotientError.message);
      // Non-blocking - continue without Quotient score
    }

    // Calculate Mojo Score (composite reputation metric)
    try {
      console.log('🎯 Calculating Mojo Score for FID:', fid);
      
      // Get total purchase amount from orders
      const { data: ordersData } = await supabaseAdmin
        .from('orders')
        .select('amount_total')
        .eq('fid', fid);
      
      const totalPurchaseAmount = ordersData?.reduce((sum, order) => {
        return sum + (parseFloat(order.amount_total) || 0);
      }, 0) || 0;
      
      // Get check-in count from last 100 days
      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      
      const { count: checkInCount } = await supabaseAdmin
        .from('point_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_fid', fid)
        .eq('transaction_type', 'daily_checkin')
        .gte('created_at', hundredDaysAgo.toISOString());
      
      // Get approved mission submissions count
      const { count: approvedMissions } = await supabaseAdmin
        .from('bounty_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('ambassador_fid', fid)
        .eq('status', 'approved');
      
      // Get mint points from user_leaderboard
      const { data: leaderboardData } = await supabaseAdmin
        .from('user_leaderboard')
        .select('points_from_mints')
        .eq('user_fid', fid)
        .single();
      
      const mintPoints = leaderboardData?.points_from_mints || 0;
      
      console.log('📊 Mojo Score inputs:', {
        neynarScore: walletData?.neynar_score || 0,
        quotientScore: quotientScore || 0,
        stakedBalance: parseFloat(existingProfile?.staked_balance) || 0,
        totalBalance: parseFloat(existingProfile?.token_balance) || 0,
        totalPurchaseAmount,
        checkInCount: checkInCount || 0,
        approvedMissions: approvedMissions || 0,
        mintPoints: mintPoints
      });
      
      // Calculate Mojo Score
      const mojoResult = calculateMojoScore({
        neynarScore: walletData?.neynar_score || 0,
        quotientScore: quotientScore || 0,
        stakedBalance: parseFloat(existingProfile?.staked_balance) || 0,
        totalBalance: parseFloat(existingProfile?.token_balance) || 0,
        totalPurchaseAmount,
        checkInCount: checkInCount || 0,
        approvedMissions: approvedMissions || 0,
        mintPoints: mintPoints,
      });
      
      profileData.mojo_score = mojoResult.score;
      console.log('🎯 Mojo Score calculated:', mojoResult.score, 'Breakdown:', JSON.stringify(mojoResult.breakdown));
      
    } catch (mojoError) {
      console.log('⚠️ Could not calculate Mojo score:', mojoError.message);
      // Non-blocking - continue without Mojo score
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
    console.error('❌ Error in register-user:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      details: error.details,
      hint: error.hint,
      fullError: error
    });
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