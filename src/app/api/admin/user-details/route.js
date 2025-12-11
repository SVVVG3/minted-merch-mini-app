import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }

    console.log(`🔍 Fetching comprehensive user data for FID: ${fid}`);

    // Fetch user profile with all data
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('fid', fid)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Fetch leaderboard data
    const { data: leaderboard, error: leaderboardError } = await supabaseAdmin
      .from('user_leaderboard')
      .select('*')
      .eq('user_fid', fid)
      .single();

    if (leaderboardError && leaderboardError.code !== 'PGRST116') {
      console.error('Error fetching leaderboard data:', leaderboardError);
    }

    // Fetch user orders
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          product_id,
          product_title,
          product_data,
          quantity,
          price,
          variant_id,
          variant_title
        )
      `)
      .eq('fid', fid)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
    }

    // Fetch user's discount codes (codes they own)
    const { data: userDiscountCodes, error: userDiscountError } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .eq('fid', fid)
      .order('created_at', { ascending: false });

    if (userDiscountError) {
      console.error('Error fetching user discount codes:', userDiscountError);
    }

    // Fetch user's discount code usage (codes they used)
    const { data: discountUsage, error: discountUsageError } = await supabaseAdmin
      .from('discount_code_usage')
      .select(`
        *,
        discount_codes (
          code,
          discount_type,
          discount_value,
          code_type
        )
      `)
      .eq('fid', fid)
      .order('used_at', { ascending: false });

    if (discountUsageError) {
      console.error('Error fetching discount usage:', discountUsageError);
    }

    // Fetch raffle wins
    const { data: raffleWins, error: raffleWinsError } = await supabaseAdmin
      .from('raffle_winner_entries')
      .select(`
        *,
        raffle_winners (
          raffle_timestamp,
          raffle_criteria,
          total_eligible_users,
          total_winners
        )
      `)
      .eq('user_fid', fid)
      .order('created_at', { ascending: false });

    if (raffleWinsError) {
      console.error('Error fetching raffle wins:', raffleWinsError);
    }

    // Fetch point transactions
    const { data: pointTransactions, error: pointTransactionsError } = await supabaseAdmin
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to most recent 50 transactions

    if (pointTransactionsError) {
      console.error('Error fetching point transactions:', pointTransactionsError);
    }

    // Fetch mission submissions (interaction bounties only)
    const INTERACTION_BOUNTY_TYPES = ['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_like_recast', 'farcaster_engagement'];
    const { data: missionSubmissions, error: missionsError } = await supabaseAdmin
      .from('bounty_submissions')
      .select(`
        id,
        status,
        submitted_at,
        approved_at,
        bounty:bounties!inner (
          id,
          title,
          bounty_type,
          reward_tokens
        )
      `)
      .eq('ambassador_fid', fid)
      .in('bounty.bounty_type', INTERACTION_BOUNTY_TYPES)
      .order('submitted_at', { ascending: false });

    if (missionsError) {
      console.error('Error fetching mission submissions:', missionsError);
    }

    // Fetch mission payouts (ambassador_payouts where ambassador_id is NULL = mogul payouts)
    const { data: missionPayouts, error: payoutsError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select(`
        id,
        amount_tokens,
        status,
        transaction_hash,
        completed_at,
        submission_id
      `)
      .is('ambassador_id', null)
      .eq('submission:bounty_submissions!ambassador_payouts_submission_id_fkey.ambassador_fid', fid);

    // Alternative: get payouts via submission IDs if the above doesn't work
    let payoutMap = {};
    if (missionSubmissions && missionSubmissions.length > 0) {
      const submissionIds = missionSubmissions.map(s => s.id);
      const { data: payouts } = await supabaseAdmin
        .from('ambassador_payouts')
        .select('*')
        .in('submission_id', submissionIds);
      
      if (payouts) {
        payouts.forEach(p => {
          payoutMap[p.submission_id] = p;
        });
      }
    }

    // Enrich missions with payout data
    const enrichedMissions = (missionSubmissions || []).map(mission => ({
      ...mission,
      payout: payoutMap[mission.id] || null
    }));

    // Calculate mission stats
    const missionStats = {
      completed: enrichedMissions.filter(m => m.status === 'approved').length,
      pending: enrichedMissions.filter(m => m.status === 'pending').length,
      rejected: enrichedMissions.filter(m => m.status === 'rejected').length,
      totalEarned: enrichedMissions
        .filter(m => m.status === 'approved')
        .reduce((sum, m) => sum + (m.bounty?.reward_tokens || 0), 0)
    };

    // Calculate additional stats from orders
    const totalOrders = orders?.length || 0;
    const totalSpent = orders?.reduce((sum, order) => sum + (parseFloat(order.amount_total) || 0), 0) || 0;
    const totalDiscountSaved = discountUsage?.reduce((sum, usage) => sum + (parseFloat(usage.discount_amount) || 0), 0) || 0;

    // Group point transactions by type
    const pointStats = pointTransactions?.reduce((stats, transaction) => {
      const type = transaction.transaction_type;
      stats[type] = (stats[type] || 0) + transaction.points_earned;
      return stats;
    }, {}) || {};

    // Parse wallet addresses
    let walletAddresses = {
      custody: profile.custody_address,
      verified_eth: [],
      verified_sol: [],
      primary_eth: profile.primary_eth_address,
      primary_sol: profile.primary_sol_address,
      all_addresses: [],
      // Bankr wallet addresses
      bankr_account_id: profile.bankr_account_id,
      bankr_evm_address: profile.bankr_evm_address,
      bankr_solana_address: profile.bankr_solana_address,
      bankr_wallet_data_updated_at: profile.bankr_wallet_data_updated_at
    };

    try {
      walletAddresses.verified_eth = Array.isArray(profile.verified_eth_addresses) ? profile.verified_eth_addresses : JSON.parse(profile.verified_eth_addresses || '[]');
      walletAddresses.verified_sol = Array.isArray(profile.verified_sol_addresses) ? profile.verified_sol_addresses : JSON.parse(profile.verified_sol_addresses || '[]');
      walletAddresses.connected_eth = Array.isArray(profile.connected_eth_addresses) ? profile.connected_eth_addresses : JSON.parse(profile.connected_eth_addresses || '[]');
      walletAddresses.all_addresses = Array.isArray(profile.all_wallet_addresses) ? profile.all_wallet_addresses : JSON.parse(profile.all_wallet_addresses || '[]');
    } catch (error) {
      console.error('Error parsing wallet addresses:', error);
    }

    // Format response
    const userData = {
      // Basic profile info
      fid: profile.fid,
      username: profile.username,
      display_name: profile.display_name,
      bio: profile.bio,
      pfp_url: profile.pfp_url,
      email: profile.email,
      created_at: profile.created_at,
      updated_at: profile.updated_at,

      // Wallet addresses
      walletAddresses,

      // Bankr membership
      bankr_club_member: profile.bankr_club_member,
      x_username: profile.x_username,
      bankr_membership_updated_at: profile.bankr_membership_updated_at,

      // Notifications
      has_notifications: profile.has_notifications,
      notification_status_updated_at: profile.notification_status_updated_at,
      notification_status_source: profile.notification_status_source,

      // Token holdings
      token_balance: profile.token_balance,
      wallet_balance: profile.wallet_balance,
      staked_balance: profile.staked_balance,
      token_balance_updated_at: profile.token_balance_updated_at,

      // Leaderboard stats
      leaderboard: leaderboard || {
        total_points: 0,
        points_from_checkins: 0,
        points_from_purchases: 0,
        checkin_streak: 0,
        last_checkin_date: null,
        total_orders: 0,
        total_spent: 0
      },

      // Order statistics
      orderStats: {
        total_orders: totalOrders,
        total_spent: totalSpent,
        total_discount_saved: totalDiscountSaved
      },

      // Point statistics
      pointStats,

      // Orders (latest 10)
      recentOrders: orders?.slice(0, 10) || [],

      // Discount codes owned by user
      userDiscountCodes: userDiscountCodes || [],

      // Discount codes used by user
      discountUsage: discountUsage || [],

      // Raffle wins
      raffleWins: raffleWins || [],

      // Point transactions (latest 20)
      recentPointTransactions: pointTransactions?.slice(0, 20) || [],

      // Missions (interaction bounties)
      missions: enrichedMissions || [],
      missionStats: missionStats
    };

    console.log(`✅ Successfully fetched comprehensive data for user ${profile.username || fid}`);

    return NextResponse.json({
      success: true,
      data: userData
    });

  } catch (error) {
    console.error('Error in user details API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});