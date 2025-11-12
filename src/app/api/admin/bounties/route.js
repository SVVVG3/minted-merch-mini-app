// Admin API - Bounty Management
// GET: List all bounties with stats
// POST: Create new bounty

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';

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
      imageUrl
    } = await request.json();

    const adminFid = request.adminAuth?.fid;

    // Validation
    if (!title || !description || !requirements || !proofRequirements) {
      return NextResponse.json({
        success: false,
        error: 'Title, description, requirements, and proof requirements are required'
      }, { status: 400 });
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

    console.log(`➕ Admin creating new bounty: "${title}"...`);

    const { data: bounty, error } = await supabaseAdmin
      .from('bounties')
      .insert({
        title,
        description,
        requirements,
        proof_requirements: proofRequirements,
        reward_tokens: rewardTokens,
        max_completions: maxCompletions,
        max_submissions_per_ambassador: maxSubmissionsPerAmbassador || null,
        current_completions: 0,
        is_active: true,
        expires_at: expiresAt || null,
        created_by_admin_fid: adminFid || null,
        category: category || null,
        image_url: imageUrl || null
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

