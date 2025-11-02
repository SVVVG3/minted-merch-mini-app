// Admin API: Get staking details for a user
// GET /api/admin/staking-details?fid=<user_fid>

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserStakingDetails } from '@/lib/stakingBalanceAPI';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    console.log(`📊 Admin: Fetching staking details for FID ${fid}`);

    // Get user's wallet addresses from database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, all_wallet_addresses, token_balance, wallet_balance, staked_balance, token_balance_updated_at')
      .eq('fid', fid)
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse wallet addresses
    const walletAddresses = Array.isArray(profile.all_wallet_addresses)
      ? profile.all_wallet_addresses
      : JSON.parse(profile.all_wallet_addresses || '[]');

    console.log(`📋 Found ${walletAddresses.length} wallet addresses for FID ${fid}`);

    // Get detailed staking information
    const stakingDetails = await getUserStakingDetails(walletAddresses);

    // Format response
    const response = {
      user: {
        fid: profile.fid,
        username: profile.username,
        display_name: profile.display_name,
        wallet_count: walletAddresses.length
      },
      balances: {
        total: profile.token_balance || 0,
        wallet: profile.wallet_balance || 0,
        staked: profile.staked_balance || 0,
        last_updated: profile.token_balance_updated_at
      },
      staking: {
        total_staked: stakingDetails.totalStaked,
        stake_count: stakingDetails.stakes.length,
        stakes: stakingDetails.stakes,
        error: stakingDetails.error || null
      },
      wallets: walletAddresses
    };

    console.log(`✅ Admin: Staking details retrieved for FID ${fid}`);
    console.log(`   Total: ${response.balances.total} | Wallet: ${response.balances.wallet} | Staked: ${response.balances.staked}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error in admin staking details endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

