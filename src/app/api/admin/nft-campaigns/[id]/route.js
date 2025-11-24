import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

/**
 * GET /api/admin/nft-campaigns/[id]
 * Get campaign details (admin only)
 */
export const GET = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;

    const { data: campaign, error } = await supabaseAdmin
      .from('nft_mints')
      .select(`
        *,
        claims:nft_mint_claims(
          id,
          user_fid,
          minted_at,
          has_shared,
          has_claimed,
          claimed_at
        )
      `)
      .eq('id', id)
      .single();

    if (error || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      campaign
    });

  } catch (error) {
    console.error('❌ Error fetching campaign:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/nft-campaigns/[id]
 * Update campaign (admin only)
 */
export const PATCH = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;
    const updates = await request.json();

    console.log(`✏️  Updating campaign: ${id}`);

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.total_mints;
    delete updates.created_at;

    const { data: campaign, error } = await supabaseAdmin
      .from('nft_mints')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating campaign:', error);
      return NextResponse.json(
        { error: 'Failed to update campaign' },
        { status: 500 }
      );
    }

    console.log(`✅ Campaign updated: ${id}`);

    return NextResponse.json({
      success: true,
      campaign
    });

  } catch (error) {
    console.error('❌ Error in update campaign endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/nft-campaigns/[id]
 * Delete campaign (admin only)
 */
export const DELETE = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;

    console.log(`🗑️  Deleting campaign: ${id}`);

    const { error } = await supabaseAdmin
      .from('nft_mints')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting campaign:', error);
      return NextResponse.json(
        { error: 'Failed to delete campaign' },
        { status: 500 }
      );
    }

    console.log(`✅ Campaign deleted: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error in delete campaign endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

