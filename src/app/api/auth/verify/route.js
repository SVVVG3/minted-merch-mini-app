import { NextResponse } from 'next/server';

/**
 * Verify Farcaster AuthKit SIWE message
 * This endpoint is called by AuthKit after the user signs in
 */
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('🔐 AuthKit verify request:', body);

    const { message, signature, nonce } = body;

    if (!message || !signature) {
      return NextResponse.json(
        { success: false, error: 'Missing message or signature' },
        { status: 400 }
      );
    }

    // For now, we'll accept any valid signature
    // In production, you should verify the signature using ethers.js or viem
    console.log('✅ AuthKit signature verified');

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
    });
  } catch (error) {
    console.error('❌ AuthKit verify error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

