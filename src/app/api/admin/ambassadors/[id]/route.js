// Admin API - Individual Ambassador Management
// PUT: Update ambassador (activate/deactivate, notes)
// DELETE: Remove ambassador

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';

// PUT /api/admin/ambassadors/[id] - Update ambassador
export const PUT = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;
    const { isActive, notes } = await request.json();

    console.log(`✏️ Admin updating ambassador ${id}...`);

    const updateData = {};
    if (typeof isActive === 'boolean') {
      updateData.is_active = isActive;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    updateData.updated_at = new Date().toISOString();

    const { data: ambassador, error } = await supabaseAdmin
      .from('ambassadors')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        profiles (
          fid,
          username,
          display_name,
          pfp_url
        )
      `)
      .single();

    if (error) {
      console.error('❌ Error updating ambassador:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update ambassador'
      }, { status: 500 });
    }

    if (!ambassador) {
      return NextResponse.json({
        success: false,
        error: 'Ambassador not found'
      }, { status: 404 });
    }

    console.log(`✅ Ambassador updated: ${id}`);

    return NextResponse.json({
      success: true,
      ambassador
    });

  } catch (error) {
    console.error('❌ Error in PUT /api/admin/ambassadors/[id]:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

// DELETE /api/admin/ambassadors/[id] - Remove ambassador
export const DELETE = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;

    console.log(`🗑️ Admin deleting ambassador ${id}...`);

    // Check for existing submissions
    const { count: submissionCount, error: countError } = await supabaseAdmin
      .from('bounty_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('ambassador_id', id);

    if (countError) {
      console.error('❌ Error checking submissions:', countError);
      return NextResponse.json({
        success: false,
        error: 'Failed to check ambassador submissions'
      }, { status: 500 });
    }

    if (submissionCount > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete ambassador with existing submissions (${submissionCount} found). Consider deactivating instead.`
      }, { status: 400 });
    }

    // Delete ambassador
    const { error: deleteError } = await supabaseAdmin
      .from('ambassadors')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Error deleting ambassador:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete ambassador'
      }, { status: 500 });
    }

    console.log(`✅ Ambassador deleted: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Ambassador deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error in DELETE /api/admin/ambassadors/[id]:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

