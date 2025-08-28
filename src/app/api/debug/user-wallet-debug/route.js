import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkTokenBalanceDirectly } from '@/lib/blockchainAPI';
import { fetchUserWalletData } from '@/lib/walletUtils';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json({ error: 'FID parameter required' }, { status: 400 });
    }

    console.log(`🔍 Debugging wallet data for FID: ${fid}`);

    // 1. Check what's currently in the database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        fid,
        username,
        display_name,
        custody_address,
        verified_eth_addresses,
        verified_sol_addresses,
        primary_eth_address,
        primary_sol_address,
        all_wallet_addresses,
        wallet_data_updated_at
      `)
      .eq('fid', parseInt(fid))
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return NextResponse.json({ 
        error: 'Profile not found', 
        details: profileError 
      }, { status: 404 });
    }

    console.log('📊 Current profile data:', profile);

    // 2. Extract all wallet addresses from profile
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

    // Filter unique valid ETH addresses
    const uniqueWallets = [...new Set(walletAddresses)]
      .filter(addr => addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42);

    console.log(`💼 Extracted ${uniqueWallets.length} unique wallet addresses:`, uniqueWallets);

    // 3. Check token balance for these wallets
    let tokenBalance = 0;
    let balanceError = null;
    
    if (uniqueWallets.length > 0) {
      try {
        tokenBalance = await checkTokenBalanceDirectly(
          uniqueWallets,
          ['0x774EAeFE73Df7959496Ac92a77279A8D7d690b07'], // $MINTEDMERCH
          8453 // Base chain
        );
        console.log(`💰 Total token balance: ${tokenBalance}`);
      } catch (error) {
        console.error('❌ Error checking token balance:', error);
        balanceError = error.message;
      }
    }

    // 4. Fetch fresh wallet data from Neynar for comparison
    let freshWalletData = null;
    let neynarError = null;
    
    try {
      freshWalletData = await fetchUserWalletData(parseInt(fid));
      console.log('🔄 Fresh Neynar wallet data:', freshWalletData);
    } catch (error) {
      console.error('❌ Error fetching fresh Neynar data:', error);
      neynarError = error.message;
    }

    // 5. Compare fresh vs stored data
    let freshWallets = [];
    if (freshWalletData) {
      if (freshWalletData.custody_address) {
        freshWallets.push(freshWalletData.custody_address);
      }
      if (freshWalletData.verified_eth_addresses && Array.isArray(freshWalletData.verified_eth_addresses)) {
        freshWallets.push(...freshWalletData.verified_eth_addresses);
      }
      if (freshWalletData.all_wallet_addresses && Array.isArray(freshWalletData.all_wallet_addresses)) {
        freshWallets.push(...freshWalletData.all_wallet_addresses);
      }
      
      freshWallets = [...new Set(freshWallets)]
        .filter(addr => addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42);
    }

    // 6. Check balance with fresh wallet data
    let freshTokenBalance = 0;
    let freshBalanceError = null;
    
    if (freshWallets.length > 0) {
      try {
        freshTokenBalance = await checkTokenBalanceDirectly(
          freshWallets,
          ['0x774EAeFE73Df7959496Ac92a77279A8D7d690b07'], // $MINTEDMERCH
          8453 // Base chain
        );
        console.log(`💰 Fresh token balance: ${freshTokenBalance}`);
      } catch (error) {
        console.error('❌ Error checking fresh token balance:', error);
        freshBalanceError = error.message;
      }
    }

    return NextResponse.json({
      success: true,
      fid: parseInt(fid),
      debug: {
        storedProfile: {
          username: profile.username,
          displayName: profile.display_name,
          custodyAddress: profile.custody_address,
          verifiedEthAddresses: profile.verified_eth_addresses,
          allWalletAddresses: profile.all_wallet_addresses,
          walletDataUpdatedAt: profile.wallet_data_updated_at,
          extractedWallets: uniqueWallets,
          walletCount: uniqueWallets.length
        },
        tokenBalance: {
          stored: tokenBalance,
          error: balanceError
        },
        freshData: {
          neynarData: freshWalletData,
          extractedWallets: freshWallets,
          walletCount: freshWallets.length,
          tokenBalance: freshTokenBalance,
          neynarError,
          balanceError: freshBalanceError
        },
        comparison: {
          storedWalletCount: uniqueWallets.length,
          freshWalletCount: freshWallets.length,
          missingWallets: freshWallets.filter(addr => !uniqueWallets.includes(addr)),
          extraWallets: uniqueWallets.filter(addr => !freshWallets.includes(addr)),
          balanceDifference: freshTokenBalance - tokenBalance
        }
      }
    });

  } catch (error) {
    console.error('❌ Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
