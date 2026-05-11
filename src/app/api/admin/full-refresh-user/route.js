import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';
import { fetchUserWalletData } from '@/lib/walletUtils';
import { calculateMojoScore } from '@/lib/mojoScore';
import { getStakingTenureStart } from '@/lib/stakingBalanceAPI';
import { checkChatEligibility } from '@/lib/chatEligibility';
import { updateChatMemberBalance } from '@/lib/chatMemberDatabase';
import { updateUserTokenBalance } from '@/lib/tokenBalanceCache';

/**
 * POST /api/admin/full-refresh-user
 *
 * Performs the same full profile refresh that happens when a user opens the app:
 *   1. Fetches fresh wallet addresses + Neynar score from Neynar
 *   2. Checks Bankr Club membership (Farcaster + X username)
 *   3. Fetches staking tenure from Goldsky subgraph
 *   4. Recalculates Mojo score from all DB + on-chain inputs
 *   5. Refreshes $MINTEDMERCH token balance
 *   6. Updates chat member eligibility
 *
 * Body: { fid }
 * Requires admin auth.
 */
export const POST = withAdminAuth(async (request) => {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const { fid } = await request.json();

    if (!fid) {
      return NextResponse.json({ success: false, error: 'FID is required' }, { status: 400 });
    }

    console.log(`[${requestId}] 🔄 Starting full refresh for FID: ${fid}`);
    const startTime = Date.now();

    // ── 1. Load existing profile ───────────────────────────────────────────
    const { data: existingProfile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, bio, pfp_url, staked_balance, token_balance, staking_tenure_start')
      .eq('fid', fid)
      .single();

    if (profileFetchError || !existingProfile) {
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 });
    }

    // ── 2. Fresh wallet + Neynar score data ───────────────────────────────
    console.log(`[${requestId}] 🔍 Fetching wallet data from Neynar...`);
    const walletData = await fetchUserWalletData(fid);

    // ── 3. Bankr Club membership ──────────────────────────────────────────
    console.log(`[${requestId}] 🏦 Checking Bankr Club membership...`);
    let bankrMembershipData = {
      bankr_club_member: false,
      x_username: walletData?.x_username || null,
      bankr_membership_updated_at: new Date().toISOString()
    };
    let allBankrWalletData = {
      farcaster: null,
      x: null,
      combinedAddresses: { evmAddresses: [], solanaAddresses: [], accountIds: [] }
    };

    try {
      const { getBankrDataForFarcasterUser, getBankrDataForXUser } = await import('@/lib/bankrAPI');
      let isBankrMember = false;
      let membershipSource = null;

      const username = walletData?.username || existingProfile.username;
      if (username) {
        const farcasterWalletData = await getBankrDataForFarcasterUser(username);
        if (farcasterWalletData) {
          allBankrWalletData.farcaster = farcasterWalletData;
          if (farcasterWalletData.evmAddress) allBankrWalletData.combinedAddresses.evmAddresses.push(farcasterWalletData.evmAddress);
          if (farcasterWalletData.solanaAddress) allBankrWalletData.combinedAddresses.solanaAddresses.push(farcasterWalletData.solanaAddress);
          if (farcasterWalletData.accountId) allBankrWalletData.combinedAddresses.accountIds.push(farcasterWalletData.accountId);
          if (farcasterWalletData.bankrClub) { isBankrMember = true; membershipSource = 'farcaster'; }
        }
      }

      const xUsername = walletData?.x_username;
      if (xUsername) {
        const xWalletData = await getBankrDataForXUser(xUsername);
        if (xWalletData) {
          allBankrWalletData.x = xWalletData;
          if (xWalletData.evmAddress && !allBankrWalletData.combinedAddresses.evmAddresses.includes(xWalletData.evmAddress))
            allBankrWalletData.combinedAddresses.evmAddresses.push(xWalletData.evmAddress);
          if (xWalletData.solanaAddress && !allBankrWalletData.combinedAddresses.solanaAddresses.includes(xWalletData.solanaAddress))
            allBankrWalletData.combinedAddresses.solanaAddresses.push(xWalletData.solanaAddress);
          if (xWalletData.accountId && !allBankrWalletData.combinedAddresses.accountIds.includes(xWalletData.accountId))
            allBankrWalletData.combinedAddresses.accountIds.push(xWalletData.accountId);
          if (xWalletData.bankrClub && !isBankrMember) { isBankrMember = true; membershipSource = 'x'; }
        }
      }

      bankrMembershipData.bankr_club_member = isBankrMember;
      const primaryData = membershipSource === 'farcaster' ? allBankrWalletData.farcaster : allBankrWalletData.x;
      const hasAnyWalletData = allBankrWalletData.farcaster || allBankrWalletData.x;
      if (hasAnyWalletData) {
        bankrMembershipData.bankr_account_id = primaryData?.accountId || allBankrWalletData.combinedAddresses.accountIds[0] || null;
        bankrMembershipData.bankr_evm_address = primaryData?.evmAddress || allBankrWalletData.combinedAddresses.evmAddresses[0] || null;
        bankrMembershipData.bankr_solana_address = primaryData?.solanaAddress || allBankrWalletData.combinedAddresses.solanaAddresses[0] || null;
        bankrMembershipData.bankr_wallet_data_updated_at = new Date().toISOString();
      }
    } catch (bankrError) {
      console.warn(`[${requestId}] ⚠️ Bankr check failed (non-fatal):`, bankrError.message);
    }

    // ── 4. Build combined wallet address list ─────────────────────────────
    let allWalletAddresses = [...(walletData?.all_wallet_addresses || [])];
    if (bankrMembershipData.bankr_evm_address) {
      const lower = bankrMembershipData.bankr_evm_address.toLowerCase();
      if (!allWalletAddresses.includes(lower)) allWalletAddresses.push(lower);
    }
    if (bankrMembershipData.bankr_solana_address) {
      const lower = bankrMembershipData.bankr_solana_address.toLowerCase();
      if (!allWalletAddresses.includes(lower)) allWalletAddresses.push(lower);
    }
    allBankrWalletData.combinedAddresses.evmAddresses.forEach(addr => {
      const lower = addr.toLowerCase();
      if (!allWalletAddresses.includes(lower)) allWalletAddresses.push(lower);
    });
    allBankrWalletData.combinedAddresses.solanaAddresses.forEach(addr => {
      const lower = addr.toLowerCase();
      if (!allWalletAddresses.includes(lower)) allWalletAddresses.push(lower);
    });

    // ── 5. Build profile update object ────────────────────────────────────
    const profileData = {
      fid,
      username: walletData?.username || existingProfile.username,
      display_name: walletData?.display_name || existingProfile.display_name,
      bio: walletData?.bio || existingProfile.bio,
      pfp_url: walletData?.pfp_url || existingProfile.pfp_url,
      updated_at: new Date().toISOString(),
      bankr_club_member: bankrMembershipData.bankr_club_member,
      x_username: bankrMembershipData.x_username,
      bankr_membership_updated_at: bankrMembershipData.bankr_membership_updated_at,
      bankr_account_id: bankrMembershipData.bankr_account_id || null,
      bankr_evm_address: bankrMembershipData.bankr_evm_address || null,
      bankr_solana_address: bankrMembershipData.bankr_solana_address || null,
      bankr_wallet_data_updated_at: bankrMembershipData.bankr_wallet_data_updated_at || null,
      all_wallet_addresses: allWalletAddresses,
    };

    if (walletData) {
      profileData.custody_address = walletData.custody_address;
      profileData.verified_eth_addresses = walletData.verified_eth_addresses;
      profileData.verified_sol_addresses = walletData.verified_sol_addresses;
      profileData.primary_eth_address = walletData.primary_eth_address;
      profileData.primary_sol_address = walletData.primary_sol_address;
      profileData.wallet_data_updated_at = walletData.wallet_data_updated_at;
      if (walletData.x_username) profileData.x_username = walletData.x_username;
      if (walletData.neynar_score != null) profileData.neynar_score = walletData.neynar_score;
    }

    // ── 6. Live token + staked balance fetch (synchronous for admin refresh) ─
    // Unlike the user-facing app-open flow (where this runs in the background
    // after Mojo is already calculated), here we fetch fresh on-chain balances
    // first so the Mojo score uses current values, not last-session's cache.
    console.log(`[${requestId}] 💰 Fetching live token + staked balances from chain...`);
    let liveStakedBalance = parseFloat(existingProfile.staked_balance) || 0;
    let liveTotalBalance = parseFloat(existingProfile.token_balance) || 0;
    try {
      const ethAddresses = allWalletAddresses.filter(
        a => typeof a === 'string' && a.startsWith('0x') && a.length === 42
      );
      if (ethAddresses.length > 0) {
        const balanceResult = await updateUserTokenBalance(fid, ethAddresses);
        if (balanceResult.success) {
          // updateUserTokenBalance writes wallet_balance + staked_balance + token_balance to DB
          // and returns the combined total as `balance`
          liveTotalBalance = balanceResult.balance;
          // Re-read staked_balance from what was just written to DB
          const { data: freshProfile } = await supabaseAdmin
            .from('profiles')
            .select('staked_balance, wallet_balance')
            .eq('fid', fid)
            .single();
          liveStakedBalance = parseFloat(freshProfile?.staked_balance) || 0;
          console.log(`[${requestId}] 💰 Live balances — staked: ${liveStakedBalance}, total: ${liveTotalBalance}`);
        }
      }
    } catch (balanceError) {
      console.warn(`[${requestId}] ⚠️ Live balance fetch failed, using cached values:`, balanceError.message);
    }

    // ── 7. Mojo score (using live balances) ───────────────────────────────
    console.log(`[${requestId}] 🎯 Calculating Mojo score...`);
    try {
      const { data: ordersData } = await supabaseAdmin
        .from('orders').select('amount_total').eq('fid', fid);
      const totalPurchaseAmount = ordersData?.reduce((s, o) => s + (parseFloat(o.amount_total) || 0), 0) || 0;

      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      const hundredDaysAgoDate = hundredDaysAgo.toISOString().split('T')[0];

      const { count: oldCheckInCount } = await supabaseAdmin
        .from('point_transactions').select('*', { count: 'exact', head: true })
        .eq('user_fid', fid).eq('transaction_type', 'daily_checkin')
        .gte('created_at', hundredDaysAgo.toISOString());

      const { data: spinDaysData } = await supabaseAdmin
        .from('spin_winnings').select('spin_date')
        .eq('user_fid', fid).gte('spin_date', hundredDaysAgoDate);
      const uniqueSpinDays = new Set(spinDaysData?.map(s => s.spin_date) || []).size;
      const checkInCount = (oldCheckInCount || 0) + uniqueSpinDays;

      const { count: approvedMissions } = await supabaseAdmin
        .from('bounty_submissions').select('*', { count: 'exact', head: true })
        .eq('ambassador_fid', fid).eq('status', 'approved');

      const { data: leaderboardData } = await supabaseAdmin
        .from('user_leaderboard').select('points_from_mints').eq('user_fid', fid).single();
      const mintPoints = leaderboardData?.points_from_mints || 0;

      // Staking tenure from Goldsky
      let tenureStartTimestamp = existingProfile.staking_tenure_start ?? null;
      let tenureFetched = false;
      try {
        tenureStartTimestamp = await getStakingTenureStart(allWalletAddresses);
        tenureFetched = true;
      } catch (tenureError) {
        console.warn(`[${requestId}] ⚠️ Staking tenure fetch failed (using cached):`, tenureError.message);
      }

      const mojoResult = calculateMojoScore({
        neynarScore: walletData?.neynar_score || 0,
        stakedBalance: liveStakedBalance,   // ← fresh from chain
        totalBalance: liveTotalBalance,      // ← fresh from chain
        tenureStartTimestamp,
        totalPurchaseAmount,
        checkInCount,
        approvedMissions: approvedMissions || 0,
        mintPoints,
      });

      profileData.mojo_score = mojoResult.score;
      if (tenureFetched) profileData.staking_tenure_start = tenureStartTimestamp;
      console.log(`[${requestId}] 🎯 Mojo: ${mojoResult.score} | Tenure start: ${tenureStartTimestamp}`);
    } catch (mojoError) {
      console.warn(`[${requestId}] ⚠️ Mojo score calculation failed (non-fatal):`, mojoError.message);
    }

    // ── 7. Upsert profile ─────────────────────────────────────────────────
    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileData, { onConflict: 'fid' });

    if (upsertError) {
      console.error(`[${requestId}] ❌ Profile upsert failed:`, upsertError);
      return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
    }

    // ── 8. Refresh token balance + chat eligibility ───────────────────────
    console.log(`[${requestId}] 💰 Refreshing token balance and chat eligibility...`);
    const eligibility = await checkChatEligibility(allWalletAddresses, fid);
    await updateChatMemberBalance(fid, eligibility.tokenBalance, 'success');

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ✅ Full refresh complete for FID ${fid} in ${duration}ms`);

    return NextResponse.json({
      success: true,
      fid,
      username: profileData.username,
      duration,
      updates: {
        neynarScore: profileData.neynar_score ?? null,
        mojoScore: profileData.mojo_score ?? null,
        tokenBalance: eligibility.tokenBalance,
        eligible: eligibility.eligible,
        bankrClubMember: profileData.bankr_club_member,
        walletCount: allWalletAddresses.length,
        stakingTenureStart: profileData.staking_tenure_start ?? null,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[${requestId}] ❌ Full refresh error:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
