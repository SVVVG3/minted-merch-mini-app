// Partner Farcaster Login API
// Authenticates partners using their Farcaster FID

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyFarcasterUser } from '@/lib/auth';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.PARTNER_JWT_SECRET || process.env.JWT_SECRET || 'partner-secret-key-change-in-production'
);

export async function POST(request) {
  try {
    // Get the Farcaster session token from the request
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Farcaster authentication required'
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the Farcaster token
    const authResult = await verifyFarcasterUser(token);
    
    if (!authResult.authenticated) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Farcaster session'
      }, { status: 401 });
    }

    const fid = authResult.fid;
    console.log(`🤝 Partner Farcaster login attempt for FID: ${fid}`);

    // Check if this FID is a registered partner
    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('id, name, email, fid, is_active, partner_type')
      .eq('fid', fid)
      .single();

    if (partnerError || !partner) {
      console.log(`❌ No partner found for FID ${fid}`);
      return NextResponse.json({
        success: false,
        error: 'No partner account linked to this Farcaster account'
      }, { status: 403 });
    }

    if (!partner.is_active) {
      return NextResponse.json({
        success: false,
        error: 'Partner account is inactive'
      }, { status: 403 });
    }

    console.log(`✅ Partner found: ${partner.name} (${partner.email})`);

    // Create a partner JWT token (must include type: 'partner' for verification)
    const partnerToken = await new SignJWT({
      type: 'partner', // Required by verifyPartnerToken
      id: partner.id,
      email: partner.email,
      name: partner.name,
      fid: partner.fid,
      partnerType: partner.partner_type
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    // Set the partner token cookie
    const response = NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        fid: partner.fid,
        partnerType: partner.partner_type
      }
    });

    response.cookies.set('partner-token', partnerToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('❌ Error in partner Farcaster login:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

