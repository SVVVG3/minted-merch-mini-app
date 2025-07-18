import { NextResponse } from 'next/server';
import { getAllPartners, createPartner } from '@/lib/partnerAuth';

// GET all partners (admin only)
export async function GET(request) {
  try {
    console.log('🤝 Fetching all partners for admin dashboard...');

    const result = await getAllPartners();

    if (!result.success) {
      console.error('❌ Failed to fetch partners:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    console.log(`✅ Retrieved ${result.partners.length} partners`);
    
    return NextResponse.json({
      success: true,
      data: result.partners
    });

  } catch (error) {
    console.error('❌ Error in GET /api/admin/partners:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch partners'
    }, { status: 500 });
  }
}

// POST create new partner (admin only)
export async function POST(request) {
  try {
    const { name, email, password, fid } = await request.json();

    console.log('🤝 Creating new partner:', { name, email, fid });

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Name, email, and password are required'
      }, { status: 400 });
    }

    // Validate FID if provided
    const validatedFid = fid && fid !== '' ? parseInt(fid) : null;
    if (fid && fid !== '' && isNaN(validatedFid)) {
      return NextResponse.json({
        success: false,
        error: 'FID must be a valid number'
      }, { status: 400 });
    }

    const result = await createPartner(email, password, name, validatedFid);

    if (!result.success) {
      console.error('❌ Failed to create partner:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    console.log('✅ Partner created successfully:', result.partner.email);
    
    return NextResponse.json({
      success: true,
      data: result.partner,
      message: 'Partner created successfully'
    });

  } catch (error) {
    console.error('❌ Error in POST /api/admin/partners:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create partner'
    }, { status: 500 });
  }
} 