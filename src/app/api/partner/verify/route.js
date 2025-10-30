import { NextResponse } from 'next/server';
import { verifyPartnerToken, getPartnerById } from '@/lib/partnerAuth';

export async function GET(request) {
  try {
    // Get token from cookie
    const token = request.cookies.get('partner-token')?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'No authentication token found'
      }, { status: 401 });
    }

    // Verify token (now async with jose)
    const decoded = await verifyPartnerToken(token);

    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired token'
      }, { status: 401 });
    }

    // Get fresh partner data from database
    const partnerResult = await getPartnerById(decoded.id);

    if (!partnerResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Partner not found or inactive'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      partner: partnerResult.partner,
      message: 'Token is valid'
    });

  } catch (error) {
    console.error('❌ Partner token verification error:', error);
    return NextResponse.json({
      success: false,
      error: 'Token verification failed'
    }, { status: 500 });
  }
} 