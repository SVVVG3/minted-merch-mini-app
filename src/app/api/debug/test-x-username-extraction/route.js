import { NextResponse } from 'next/server';
import { fetchUserWalletData } from '@/lib/walletUtils';
import { checkBankrClubMembership, lookupUserByXUsername } from '@/lib/bankrAPI';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const testFid = parseInt(searchParams.get('fid')) || 466111; // Default to your FID
  
  console.log('🧪 Testing X username extraction and Bankr Club membership checking for FID:', testFid);
  
  try {
    // 1. Fetch wallet data with enhanced X username extraction
    console.log('📊 Step 1: Fetching wallet data with X username extraction...');
    const walletData = await fetchUserWalletData(testFid);
    
    const result = {
      step1_wallet_data: {
        success: !!walletData,
        custody_address: walletData?.custody_address,
        verified_eth_count: walletData?.verified_eth_addresses?.length || 0,
        verified_sol_count: walletData?.verified_sol_addresses?.length || 0,
        total_addresses: walletData?.all_wallet_addresses?.length || 0,
        x_username: walletData?.x_username,
        verified_accounts_count: walletData?.verified_accounts?.length || 0,
        verified_accounts: walletData?.verified_accounts || []
      }
    };
    
    if (!walletData) {
      result.error = 'Could not fetch wallet data';
      return NextResponse.json(result);
    }
    
    // 2. Test Farcaster-based Bankr Club membership checking
    console.log('🔮 Step 2: Testing Farcaster-based Bankr Club membership...');
    try {
      // We need to get the username from somewhere - let's use a known test username
      const testUsername = 'svvvg3.eth'; // Your username
      const farcasterBankrResult = await checkBankrClubMembership(testUsername);
      
      result.step2_farcaster_bankr = {
        username: testUsername,
        success: farcasterBankrResult.success,
        found: farcasterBankrResult.found,
        isMember: farcasterBankrResult.isMember,
        error: farcasterBankrResult.error
      };
    } catch (error) {
      result.step2_farcaster_bankr = {
        error: error.message
      };
    }
    
    // 3. Test X-based Bankr Club membership checking (if X username available)
    console.log('🐦 Step 3: Testing X-based Bankr Club membership...');
    if (walletData.x_username) {
      try {
        const xBankrResult = await lookupUserByXUsername(walletData.x_username);
        
        result.step3_x_bankr = {
          x_username: walletData.x_username,
          success: xBankrResult.success,
          found: xBankrResult.found,
          isMember: xBankrResult.isBankrClubMember,
          error: xBankrResult.error
        };
      } catch (error) {
        result.step3_x_bankr = {
          x_username: walletData.x_username,
          error: error.message
        };
      }
    } else {
      result.step3_x_bankr = {
        message: 'No X username found in verified accounts',
        x_username: null
      };
    }
    
    // 4. Summary
    result.summary = {
      fid: testFid,
      has_x_username: !!walletData.x_username,
      x_username: walletData.x_username,
      bankr_member_via_farcaster: result.step2_farcaster_bankr?.isMember || false,
      bankr_member_via_x: result.step3_x_bankr?.isMember || false,
      overall_bankr_member: (result.step2_farcaster_bankr?.isMember || false) || (result.step3_x_bankr?.isMember || false),
      platforms_checked: [
        'farcaster',
        walletData.x_username ? 'x' : null
      ].filter(Boolean)
    };
    
    console.log('✅ X username extraction and Bankr Club membership test completed');
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in X username extraction test:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 