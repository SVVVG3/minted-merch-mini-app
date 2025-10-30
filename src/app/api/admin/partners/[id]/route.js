import { NextResponse } from 'next/server';
import { updatePartnerStatus } from '@/lib/partnerAuth';
import { withAdminAuth } from '@/lib/adminAuth';

// PATCH update partner status (admin only)
export const PATCH = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;
    const { is_active } = await request.json();

    console.log('🤝 Updating partner status:', { id, is_active });

    // Validate input
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Partner ID is required'
      }, { status: 400 });
    }

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'is_active must be a boolean'
      }, { status: 400 });
    }

    const result = await updatePartnerStatus(id, is_active);

    if (!result.success) {
      console.error('❌ Failed to update partner status:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    console.log('✅ Partner status updated successfully:', result.partner.email);
    
    return NextResponse.json({
      success: true,
      data: result.partner,
      message: 'Partner status updated successfully'
    });

  } catch (error) {
    console.error('❌ Error in PATCH /api/admin/partners/[id]:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update partner status'
    }, { status: 500 });
  }
}); 