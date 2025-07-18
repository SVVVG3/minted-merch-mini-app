import { NextResponse } from 'next/server';
import { authenticatePartner } from '@/lib/partnerAuth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required'
      }, { status: 400 });
    }

    // Authenticate partner
    const authResult = await authenticatePartner(email, password);

    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error
      }, { status: 401 });
    }

    // Set HTTP-only cookie for secure token storage
    const response = NextResponse.json({
      success: true,
      partner: authResult.partner,
      message: 'Login successful'
    });

    // Set secure cookie with JWT token
    response.cookies.set('partner-token', authResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    console.log('🔐 Partner login successful:', authResult.partner.email);
    return response;

  } catch (error) {
    console.error('❌ Partner login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Login failed'
    }, { status: 500 });
  }
} 