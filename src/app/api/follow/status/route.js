import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { neynarClient, isNeynarAvailable, checkUserNotificationStatus } from '@/lib/neynar';

// @mintedmerch FID - the account users need to follow
const MINTEDMERCH_FID = 466111;
// /mintedmerch channel ID
const MINTEDMERCH_CHANNEL_ID = 'mintedmerch';

/**
 * GET /api/follow/status
 * 
 * Check user's status for all follow tasks:
 * 1. Added mini app
 * 2. Enabled notifications
 * 3. Following @mintedmerch
 * 4. Following /mintedmerch channel
 * 
 * Also returns their existing reward claim status if any
 */
export async function GET(request) {
  try {
    // Authenticate user
    const fid = await getAuthenticatedFid(request);
    if (!fid) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`📋 Checking follow status for FID ${fid}`);

    // Check if user has already claimed
    const { data: existingClaim } = await supabaseAdmin
      .from('follow_rewards')
      .select('*')
      .eq('user_fid', fid)
      .single();

    // If already claimed, return that status
    if (existingClaim?.has_claimed) {
      return NextResponse.json({
        success: true,
        alreadyClaimed: true,
        claimedAt: existingClaim.claimed_at,
        claimTransactionHash: existingClaim.claim_transaction_hash,
        hasShared: existingClaim.has_shared
      });
    }

    // Check all tasks via Neynar API
    if (!isNeynarAvailable()) {
      return NextResponse.json(
        { error: 'Neynar API not configured' },
        { status: 500 }
      );
    }

    // 1. Check notification status (includes whether app is added)
    const notificationStatus = await checkUserNotificationStatus(fid);
    const hasNotifications = notificationStatus.hasNotifications || 
                            notificationStatus.hasFarcasterNotifications || 
                            notificationStatus.hasBaseNotifications;
    
    // 2 & 3. Check if following @mintedmerch account and /mintedmerch channel
    // Use bulk user lookup with viewer_context to check following status
    let isFollowingAccount = false;
    let isFollowingChannel = false;

    try {
      // Check following @mintedmerch account
      // Using fetchBulkUsers with viewer_fid returns viewer_context.following
      const userResponse = await neynarClient.fetchBulkUsers({
        fids: [MINTEDMERCH_FID],
        viewerFid: fid
      });

      if (userResponse?.users?.[0]?.viewer_context) {
        isFollowingAccount = userResponse.users[0].viewer_context.following === true;
      }
      console.log(`👤 Following @mintedmerch: ${isFollowingAccount}`);

    } catch (userError) {
      console.error('Error checking user follow status:', userError);
    }

    try {
      // Check following /mintedmerch channel
      // Using channel lookup with viewer_fid returns viewer_context.following
      const channelResponse = await neynarClient.lookupChannel({
        id: MINTEDMERCH_CHANNEL_ID,
        viewerFid: fid
      });

      if (channelResponse?.channel?.viewer_context) {
        isFollowingChannel = channelResponse.channel.viewer_context.following === true;
      }
      console.log(`📺 Following /mintedmerch channel: ${isFollowingChannel}`);

    } catch (channelError) {
      console.error('Error checking channel follow status:', channelError);
    }

    // For "has added app" - we check if notifications are enabled
    // (if they have notification tokens, they've added the app)
    const hasAddedApp = hasNotifications;

    // All tasks completed?
    const allTasksCompleted = hasAddedApp && hasNotifications && isFollowingAccount && isFollowingChannel;

    // Update or create record in database
    const updateData = {
      has_added_app: hasAddedApp,
      has_notifications: hasNotifications,
      has_followed_account: isFollowingAccount,
      has_followed_channel: isFollowingChannel,
      all_tasks_completed: allTasksCompleted,
      updated_at: new Date().toISOString()
    };

    // Set timestamps for newly completed tasks
    if (hasAddedApp && !existingClaim?.has_added_app) {
      updateData.app_added_at = new Date().toISOString();
    }
    if (hasNotifications && !existingClaim?.has_notifications) {
      updateData.notifications_enabled_at = new Date().toISOString();
    }
    if (isFollowingAccount && !existingClaim?.has_followed_account) {
      updateData.account_followed_at = new Date().toISOString();
    }
    if (isFollowingChannel && !existingClaim?.has_followed_channel) {
      updateData.channel_followed_at = new Date().toISOString();
    }

    // Get user's wallet for claim
    let walletAddress = existingClaim?.wallet_address;
    if (!walletAddress) {
      // Try to get wallet from profile
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('primary_eth_address, verified_eth_addresses, custody_address')
        .eq('fid', fid)
        .single();

      walletAddress = profile?.primary_eth_address || 
                     profile?.verified_eth_addresses?.[0] || 
                     profile?.custody_address;
    }

    if (existingClaim) {
      // Update existing record
      await supabaseAdmin
        .from('follow_rewards')
        .update(updateData)
        .eq('user_fid', fid);
    } else if (walletAddress) {
      // Create new record
      await supabaseAdmin
        .from('follow_rewards')
        .insert({
          user_fid: fid,
          wallet_address: walletAddress,
          ...updateData
        });
    }

    console.log(`✅ Follow status check complete for FID ${fid}:`, {
      hasAddedApp,
      hasNotifications,
      isFollowingAccount,
      isFollowingChannel,
      allTasksCompleted
    });

    return NextResponse.json({
      success: true,
      tasks: {
        hasAddedApp,
        hasNotifications,
        isFollowingAccount,
        isFollowingChannel
      },
      allTasksCompleted,
      canClaim: allTasksCompleted && !existingClaim?.has_claimed,
      alreadyClaimed: false,
      rewardAmount: '10000', // Display amount (10,000 tokens)
      walletAddress
    });

  } catch (error) {
    console.error('❌ Error checking follow status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}

