import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkChatEligibility } from '@/lib/chatEligibility';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { fid } = await request.json();
    
    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }

    console.log(`🔄 Starting individual balance update for FID: ${fid}`);
    const startTime = Date.now();

    // Get user's wallet addresses from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, custody_address, verified_eth_addresses, all_wallet_addresses')
      .eq('fid', fid)
      .single();

    if (profileError || !profile) {
      console.log(`❌ No profile found for FID: ${fid}`);
      return NextResponse.json({
        success: false,
        error: 'User profile not found'
      }, { status: 404 });
    }

    // Extract wallet addresses
    const walletAddresses = [];
    
    if (profile.custody_address) {
      walletAddresses.push(profile.custody_address);
    }
    
    if (profile.verified_eth_addresses && Array.isArray(profile.verified_eth_addresses)) {
      walletAddresses.push(...profile.verified_eth_addresses);
    }
    
    if (profile.all_wallet_addresses && Array.isArray(profile.all_wallet_addresses)) {
      walletAddresses.push(...profile.all_wallet_addresses);
    }

    // Filter valid ETH addresses
    const validWallets = [...new Set(walletAddresses)]
      .filter(addr => addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42);

    if (validWallets.length === 0) {
      console.log(`❌ No valid wallet addresses for FID: ${fid}`);
      return NextResponse.json({
        success: false,
        error: 'No valid wallet addresses found for this user'
      }, { status: 400 });
    }

    console.log(`💰 Found ${validWallets.length} wallet addresses for FID ${fid}`);

    // Check token eligibility (this will update both profiles and chat member databases)
    const eligibility = await checkChatEligibility(validWallets, fid);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Individual balance update completed for FID ${fid} in ${duration}ms`);
    console.log(`📊 Result: ${eligibility.tokenBalance} tokens, eligible: ${eligibility.eligible}`);

    return NextResponse.json({
      success: true,
      fid: fid,
      username: profile.username || profile.display_name || `User ${fid}`,
      tokenBalance: eligibility.tokenBalance,
      eligible: eligibility.eligible,
      requiredBalance: eligibility.requiredBalance,
      walletCount: validWallets.length,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in individual balance update:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});
