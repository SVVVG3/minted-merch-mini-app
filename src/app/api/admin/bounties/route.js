// Admin API - Bounty Management
// GET: List all bounties with stats
// POST: Create new bounty

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendNewBountyNotification } from '@/lib/ambassadorNotifications';

// GET /api/admin/bounties - List all bounties
export const GET = withAdminAuth(async (request) => {
  try {
    console.log('📋 Admin fetching all bounties...');

    const { data: bounties, error } = await supabaseAdmin
      .from('bounties')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching bounties:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch bounties'
      }, { status: 500 });
    }

    // Get submission counts for each bounty
    const bountiesWithStats = await Promise.all(bounties.map(async (bounty) => {
      const { count: totalSubmissions, error: countError } = await supabaseAdmin
        .from('bounty_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('bounty_id', bounty.id);

      const { count: pendingSubmissions } = await supabaseAdmin
        .from('bounty_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('bounty_id', bounty.id)
        .eq('status', 'pending');

      return {
        ...bounty,
        total_submissions: totalSubmissions || 0,
        pending_submissions: pendingSubmissions || 0
      };
    }));

    console.log(`✅ Fetched ${bounties.length} bounties`);
    if (bounties.length > 0) {
      console.log('📊 Sample bounty data:', {
        id: bounties[0].id,
        title: bounties[0].title,
        reward_tokens: bounties[0].reward_tokens,
        reward_tokens_type: typeof bounties[0].reward_tokens
      });
    }

    return NextResponse.json({
      success: true,
      bounties: bountiesWithStats
    });

  } catch (error) {
    console.error('❌ Error in GET /api/admin/bounties:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

// POST /api/admin/bounties - Create new bounty
export const POST = withAdminAuth(async (request) => {
  try {
    const {
      title,
      description,
      requirements,
      proofRequirements,
      rewardTokens,
      maxCompletions,
      maxSubmissionsPerAmbassador,
      expiresAt,
      category,
      imageUrl,
      bountyType,
      targetCastUrl,
      targetCastHash,
      targetCastAuthorFid,
      targetAmbassadorFids
    } = await request.json();

    const adminFid = request.adminAuth?.fid;
    const isFarcasterBounty = ['farcaster_like', 'farcaster_recast', 'farcaster_comment', 'farcaster_like_recast', 'farcaster_engagement'].includes(bountyType);

    // Validation
    if (!title || !description) {
      return NextResponse.json({
        success: false,
        error: 'Title and description are required'
      }, { status: 400 });
    }

    // Different validation for Farcaster vs custom bounties
    if (isFarcasterBounty) {
      if (!targetCastUrl || !targetCastHash || !targetCastAuthorFid) {
        return NextResponse.json({
          success: false,
          error: 'Cast URL, hash, and author FID are required for Farcaster engagement bounties'
        }, { status: 400 });
      }
    } else {
      if (!requirements || !proofRequirements) {
        return NextResponse.json({
          success: false,
          error: 'Requirements and proof requirements are required for custom bounties'
        }, { status: 400 });
      }
    }

    if (!rewardTokens || rewardTokens <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Reward tokens must be greater than 0'
      }, { status: 400 });
    }

    if (!maxCompletions || maxCompletions <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Max completions must be greater than 0'
      }, { status: 400 });
    }

    if (maxSubmissionsPerAmbassador && maxSubmissionsPerAmbassador <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Max submissions per ambassador must be greater than 0 if provided'
      }, { status: 400 });
    }

    console.log(`➕ Admin creating new bounty: "${title}" (${bountyType || 'custom'})...`);

    // Auto-generate requirements and proof requirements for Farcaster bounties
    let finalRequirements = requirements;
    let finalProofRequirements = proofRequirements;

    if (isFarcasterBounty) {
      if (bountyType === 'farcaster_engagement') {
        finalRequirements = `Like, recast, AND comment on the specified Farcaster cast. All three actions are required and will be automatically verified.`;
        finalProofRequirements = `Click submit after you complete all three actions (like + recast + comment). Verification is instant via Neynar API.`;
      } else if (bountyType === 'farcaster_like_recast') {
        finalRequirements = `Like AND recast the specified Farcaster cast. Both actions are required and will be automatically verified.`;
        finalProofRequirements = `Click submit after you complete both actions (like + recast). Verification is instant via Neynar API.`;
      } else {
        const actionMap = {
          'farcaster_like': 'like',
          'farcaster_recast': 'recast',
          'farcaster_comment': 'comment on'
        };
        const action = actionMap[bountyType];
        finalRequirements = `${action.charAt(0).toUpperCase() + action.slice(1)} the specified Farcaster cast. Your engagement will be automatically verified.`;
        finalProofRequirements = `Click submit after you ${action} the cast. Verification is instant via Neynar API.`;
      }
    }

    const { data: bounty, error } = await supabaseAdmin
      .from('bounties')
      .insert({
        title,
        description,
        requirements: finalRequirements,
        proof_requirements: finalProofRequirements,
        reward_tokens: rewardTokens,
        max_completions: maxCompletions,
        max_submissions_per_ambassador: maxSubmissionsPerAmbassador || null,
        current_completions: 0,
        is_active: true,
        expires_at: expiresAt || null,
        created_by_admin_fid: adminFid || null,
        category: category || null,
        image_url: imageUrl || null,
        bounty_type: bountyType || 'custom',
        target_cast_url: targetCastUrl || null,
        target_cast_hash: targetCastHash || null,
        target_cast_author_fid: targetCastAuthorFid || null,
        target_ambassador_fids: targetAmbassadorFids || null
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating bounty:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create bounty'
      }, { status: 500 });
    }

    console.log(`✅ Bounty created: "${title}" (${rewardTokens} tokens, ${maxCompletions} max completions)`);

    // Send notification to all active ambassadors (don't fail if notification fails)
    try {
      const notificationResult = await sendNewBountyNotification(bounty);
      if (notificationResult.success) {
        console.log(`📬 Bounty notification sent to ${notificationResult.successCount}/${notificationResult.totalAmbassadors} ambassadors`);
      } else {
        console.error('⚠️ Failed to send bounty notifications:', notificationResult.error);
      }
    } catch (notificationError) {
      console.error('⚠️ Error sending bounty notifications (continuing anyway):', notificationError);
    }

    return NextResponse.json({
      success: true,
      bounty
    });

  } catch (error) {
    console.error('❌ Error in POST /api/admin/bounties:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

