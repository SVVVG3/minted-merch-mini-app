import { NextResponse } from 'next/server';
import { checkTokenBalanceDirectly } from '@/lib/blockchainAPI';
import { refreshUserTokenBalance, updateUserTokenBalance } from '@/lib/tokenBalanceCache';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = parseInt(searchParams.get('fid'));
    const forceRefresh = searchParams.get('force') === 'true';

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID parameter is required'
      }, { status: 400 });
    }

    console.log(`🔍 Testing token balance for FID ${fid} (force: ${forceRefresh})`);

    // Get user's wallet addresses from database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('fid, all_wallet_addresses, token_balance, token_balance_updated_at')
      .eq('fid', fid)
      .single();

    if (profileError) {
      return NextResponse.json({
        success: false,
        error: `Profile not found: ${profileError.message}`
      }, { status: 404 });
    }

    const walletAddresses = profile.all_wallet_addresses || [];
    console.log(`📱 Found ${walletAddresses.length} wallet addresses:`, walletAddresses);

    // Filter to only Ethereum addresses
    const ethAddresses = walletAddresses.filter(addr => 
      typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42
    );
    console.log(`🔗 Filtered to ${ethAddresses.length} Ethereum addresses:`, ethAddresses);

    let result = {
      fid,
      walletAddresses,
      ethAddresses,
      currentCachedBalance: profile.token_balance,
      lastUpdated: profile.token_balance_updated_at
    };

    if (ethAddresses.length === 0) {
      result.error = 'No valid Ethereum addresses found';
      result.directBalance = 0;
      result.success = false;
    } else {
      // Test direct blockchain call
      console.log('🔗 Testing direct blockchain call...');
      try {
        const directBalance = await checkTokenBalanceDirectly(
          ethAddresses,
          ['0x774EAeFE73Df7959496Ac92a77279A8D7d690b07'], // $MINTEDMERCH contract
          8453 // Base chain
        );
        
        result.directBalance = directBalance;
        result.directBalanceFormatted = (directBalance / Math.pow(10, 18)).toFixed(6);
        console.log(`✅ Direct balance: ${directBalance} (${result.directBalanceFormatted} tokens)`);

        // If force refresh or balance is different, update cache
        if (forceRefresh || directBalance !== profile.token_balance) {
          console.log(`💾 Updating cached balance with ${directBalance} tokens...`);
          const updateResult = await updateUserTokenBalance(fid, ethAddresses, directBalance);
          result.cacheUpdateResult = updateResult;
          result.newCachedBalance = directBalance;
        }

        result.success = true;
      } catch (error) {
        console.error('❌ Direct balance check failed:', error);
        result.directBalanceError = error.message;
        result.success = false;
      }
    }

    // Test the refresh function
    if (!forceRefresh) {
      console.log('🔄 Testing refresh function...');
      try {
        const refreshResult = await refreshUserTokenBalance(fid, walletAddresses);
        result.refreshResult = refreshResult;
      } catch (error) {
        console.error('❌ Refresh function failed:', error);
        result.refreshError = error.message;
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Debug test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
