// Admin API - Individual Bounty Management
// PUT: Update bounty
// DELETE: Delete bounty (only if no submissions)

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';

// PUT /api/admin/bounties/[id] - Update bounty
export const PUT = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;
    const {
      title,
      description,
      requirements,
      proofRequirements,
      rewardTokens,
      maxCompletions,
      maxSubmissionsPerAmbassador,
      isActive,
      expiresAt,
      category,
      imageUrl
    } = await request.json();

    console.log(`✏️ Admin updating bounty ${id}...`);

    const updateData = { updated_at: new Date().toISOString() };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (proofRequirements !== undefined) updateData.proof_requirements = proofRequirements;
    if (rewardTokens !== undefined) {
      if (rewardTokens <= 0) {
        return NextResponse.json({
          success: false,
          error: 'Reward tokens must be greater than 0'
        }, { status: 400 });
      }
      updateData.reward_tokens = rewardTokens;
    }
    if (maxCompletions !== undefined) {
      if (maxCompletions <= 0) {
        return NextResponse.json({
          success: false,
          error: 'Max completions must be greater than 0'
        }, { status: 400 });
      }
      updateData.max_completions = maxCompletions;
    }
    if (maxSubmissionsPerAmbassador !== undefined) {
      if (maxSubmissionsPerAmbassador !== null && maxSubmissionsPerAmbassador <= 0) {
        return NextResponse.json({
          success: false,
          error: 'Max submissions per ambassador must be greater than 0 if provided'
        }, { status: 400 });
      }
      updateData.max_submissions_per_ambassador = maxSubmissionsPerAmbassador;
    }
    if (typeof isActive === 'boolean') updateData.is_active = isActive;
    if (expiresAt !== undefined) updateData.expires_at = expiresAt;
    if (category !== undefined) updateData.category = category;
    if (imageUrl !== undefined) updateData.image_url = imageUrl;

    const { data: bounty, error } = await supabaseAdmin
      .from('bounties')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating bounty:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update bounty'
      }, { status: 500 });
    }

    if (!bounty) {
      return NextResponse.json({
        success: false,
        error: 'Bounty not found'
      }, { status: 404 });
    }

    console.log(`✅ Bounty updated: ${id}`);

    return NextResponse.json({
      success: true,
      bounty
    });

  } catch (error) {
    console.error('❌ Error in PUT /api/admin/bounties/[id]:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

// DELETE /api/admin/bounties/[id] - Delete bounty
export const DELETE = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;

    console.log(`🗑️ Admin deleting bounty ${id}...`);

    // Check for existing submissions
    const { count: submissionCount, error: countError } = await supabaseAdmin
      .from('bounty_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('bounty_id', id);

    if (countError) {
      console.error('❌ Error checking submissions:', countError);
      return NextResponse.json({
        success: false,
        error: 'Failed to check bounty submissions'
      }, { status: 500 });
    }

    if (submissionCount > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete bounty with existing submissions (${submissionCount} found). Consider deactivating instead.`
      }, { status: 400 });
    }

    // Delete bounty
    const { error: deleteError } = await supabaseAdmin
      .from('bounties')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Error deleting bounty:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete bounty'
      }, { status: 500 });
    }

    console.log(`✅ Bounty deleted: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Bounty deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error in DELETE /api/admin/bounties/[id]:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

